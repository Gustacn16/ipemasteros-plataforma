import "server-only";
import type { CategoriaConversaWhatsapp, TipoMensagemWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventoConversas, EventoMensagens, MensagemMotor } from "../esquemas/motor";
import { categoriaInicial, chaveTelefone, decidirGuardar, dentroDoHistorico, HORAS_PROVISORIO, variantesTelefone } from "../regras/captura";

const MAX_TEXTO = 4000;

type Conversa = {
  id: string;
  jid: string;
  tipo: "grupo" | "individual";
  numeroId: string | null;
  nome: string | null;
  contatoId: string | null;
  categoria: CategoriaConversaWhatsapp;
  monitorada: boolean;
  provisoriaAte: Date | null;
};

type Contato = { id: string; telefone: string | null; lid: string | null; nomeExibido: string | null; alunoId: string | null; usuarioId: string | null };

const CAMPOS_CONVERSA = {
  id: true, jid: true, tipo: true, numeroId: true, nome: true, contatoId: true, categoria: true, monitorada: true, provisoriaAte: true,
} as const;
const CAMPOS_CONTATO = { id: true, telefone: true, lid: true, nomeExibido: true, alunoId: true, usuarioId: true } as const;

const tipoDoJid = (jid: string): "grupo" | "individual" => (jid.endsWith("@g.us") ? "grupo" : "individual");

/** Telefone de um jid individual (sem o sufixo de aparelho ":N"); null para grupo, lid ou formato estranho. */
function telefoneDoJid(jid: string | undefined): string | null {
  if (!jid?.endsWith("@s.whatsapp.net")) return null;
  const usuario = jid.slice(0, jid.indexOf("@")).split(":")[0]!;
  return /^\d{10,15}$/.test(usuario) ? usuario : null;
}

const lidDoJid = (jid: string | undefined): string | null => (jid?.endsWith("@lid") && jid.length <= 40 ? jid : null);

const soDigitos = (v: string | null) => v?.replace(/\D/g, "") ?? null;

const codigoErro = (e: unknown) => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);

/** Índice chave do telefone → ids, montado no código (sem LIKE no banco) e reaproveitado por 60 s. */
type IndiceTelefones = { alunos: Map<string, string[]>; usuarios: Map<string, string[]>; em: number };
const VALIDADE_INDICE_MS = 60_000;
let indiceTelefones: IndiceTelefones | null = null;

/** Descarta o índice de telefones de alunos e usuários (testes e cadastros novos). */
export function esquecerTelefonesCadastrados(): void {
  indiceTelefones = null;
}

function indexar(linhas: { id: string; tel: string | null }[]): Map<string, string[]> {
  const mapa = new Map<string, string[]>();
  for (const l of linhas) {
    const chave = chaveTelefone(soDigitos(l.tel));
    if (!chave) continue;
    const ids = mapa.get(chave);
    if (ids) ids.push(l.id);
    else mapa.set(chave, [l.id]);
  }
  return mapa;
}

async function telefonesCadastrados(): Promise<IndiceTelefones> {
  if (indiceTelefones && Date.now() - indiceTelefones.em < VALIDADE_INDICE_MS) return indiceTelefones;
  // No MySQL da Hostinger o LIKE (endsWith) com parâmetro dá "Illegal mix of collations" (1267).
  // O telefone de aluno e usuário é guardado em formatos variados, então a comparação de chave é feita aqui.
  const [alunos, usuarios] = await Promise.all([
    prisma.aluno.findMany({ where: { telefone: { not: null } }, select: { id: true, telefone: true } }),
    prisma.usuario.findMany({ where: { whatsapp: { not: null } }, select: { id: true, whatsapp: true } }),
  ]);
  indiceTelefones = {
    alunos: indexar(alunos.map((a) => ({ id: a.id, tel: a.telefone }))),
    usuarios: indexar(usuarios.map((u) => ({ id: u.id, tel: u.whatsapp }))),
    em: Date.now(),
  };
  return indiceTelefones;
}

/** Aluno e usuário com a mesma chave de telefone. Só liga quando há exatamente um. */
export async function ligacoesDoTelefone(chave: string): Promise<{ alunoId: string | null; usuarioId: string | null }> {
  const indice = await telefonesCadastrados();
  const alunos = indice.alunos.get(chave) ?? [];
  const usuarios = indice.usuarios.get(chave) ?? [];
  return {
    alunoId: alunos.length === 1 ? alunos[0]! : null,
    usuarioId: usuarios.length === 1 ? usuarios[0]! : null,
  };
}

/** Contato pela chave: busca por igualdade nos formatos possíveis do telefone e confere a chave aqui. */
export async function contatoPorChave(chave: string): Promise<Contato | null> {
  const candidatos = await prisma.contatoWhatsapp.findMany({
    where: { telefone: { in: variantesTelefone(chave) } },
    select: CAMPOS_CONTATO,
  });
  return candidatos.find((c) => chaveTelefone(c.telefone) === chave) ?? null;
}

/** Contato resolvido; `apagado` é o contato do lid que acabou de ser juntado nele (sumiu do banco). */
type Resolvido = { contato: Contato; apagado?: Contato };

/**
 * Junta o contato do lid (`b`) no do telefone (`a`), numa transação. O lid é único: `b` sai antes de `a` receber o lid.
 * Se outro lote já juntou `b` (o `deleteMany` não apaga nada), sai sem mudar nada e devolve o contato do telefone achado de novo.
 */
async function juntarContatos(a: Contato, b: Contato, chave: string, nome: string | null, trocarNome: boolean): Promise<Resolvido> {
  const juntado = await prisma.$transaction(async (tx) => {
    await tx.mensagemWhatsapp.updateMany({ where: { contatoId: b.id }, data: { contatoId: a.id } });
    await tx.conversaWhatsapp.updateMany({ where: { contatoId: b.id }, data: { contatoId: a.id } });
    const { count } = await tx.contatoWhatsapp.deleteMany({ where: { id: b.id } });
    if (count === 0) return null;
    const mudancas: Partial<Omit<Contato, "id">> = { lid: b.lid };
    if (!a.alunoId && !a.usuarioId) {
      mudancas.alunoId = b.alunoId;
      mudancas.usuarioId = b.usuarioId;
    }
    const nomeNovo = nome ?? b.nomeExibido;
    if (nomeNovo && nomeNovo !== a.nomeExibido && (trocarNome || !a.nomeExibido)) mudancas.nomeExibido = nomeNovo;
    return tx.contatoWhatsapp.update({ where: { id: a.id }, data: mudancas, select: CAMPOS_CONTATO });
  });
  if (juntado) return { contato: juntado, apagado: b };
  const achado = await contatoPorChave(chave);
  // Sem o contato do telefone, o P2025 faz `contatoDe` resolver tudo de novo.
  if (!achado) throw Object.assign(new Error("Contato do telefone sumiu durante a junção."), { code: "P2025" });
  return { contato: achado, apagado: b };
}

async function resolverContato(
  lid: string | null,
  telefone: string | null,
  nome: string | null,
  trocarNome: boolean,
): Promise<Resolvido> {
  const chave = chaveTelefone(telefone);
  const porLid = lid ? await prisma.contatoWhatsapp.findUnique({ where: { lid }, select: CAMPOS_CONTATO }) : null;
  const porTelefone = chave ? await contatoPorChave(chave) : null;
  // Se o lid e o telefone apontam para contatos diferentes, vale o do telefone (é o que liga ao aluno):
  // o do lid é juntado a ele, para o apagamento por telefone alcançar também as mensagens do lid.
  // Só junta se o contato do lid não tem outro telefone; se tem, nenhum lid muda.
  if (chave && porLid && porTelefone && porLid.id !== porTelefone.id
    && (!porLid.telefone || chaveTelefone(porLid.telefone) === chave)) {
    return juntarContatos(porTelefone, porLid, chave, nome, trocarNome);
  }
  const contato = porTelefone ?? porLid;
  if (!contato) {
    const ligado = chave ? await ligacoesDoTelefone(chave) : { alunoId: null, usuarioId: null };
    return {
      contato: await prisma.contatoWhatsapp.create({
        data: { telefone: chave ? telefone : null, lid, nomeExibido: nome, ...ligado },
        select: CAMPOS_CONTATO,
      }),
    };
  }
  const mudancas: Partial<Omit<Contato, "id">> = {};
  if (nome && nome !== contato.nomeExibido && (trocarNome || !contato.nomeExibido)) mudancas.nomeExibido = nome;
  if (lid && !contato.lid && !porLid) mudancas.lid = lid;
  if (chave && !contato.telefone) {
    // Contato que só tinha lid ganha o telefone e, com ele, a ligação com aluno/usuário.
    mudancas.telefone = telefone;
    if (!contato.alunoId && !contato.usuarioId) Object.assign(mudancas, await ligacoesDoTelefone(chave));
  }
  if (Object.keys(mudancas).length === 0) return { contato };
  return { contato: await prisma.contatoWhatsapp.update({ where: { id: contato.id }, data: mudancas, select: CAMPOS_CONTATO }) };
}

type DadosContato = { jid?: string; telefone?: string | null; nome?: string | null };

/** Avisado quando o contato `apagado` (do lid) foi juntado em `ficou` (do telefone). */
type AoJuntar = (apagado: Contato, ficou: Contato) => void;

/**
 * Contato pelo lid ou pela chave do telefone; null quando não há nenhum dos dois.
 * `trocarNome` falso (histórico): o nome só preenche quem está sem nome, para não voltar a um nome antigo.
 */
async function contatoDe(dados: DadosContato, trocarNome = true, aoJuntar?: AoJuntar): Promise<Contato | null> {
  const lid = lidDoJid(dados.jid);
  const telefone = dados.telefone ?? telefoneDoJid(dados.jid);
  const nome = dados.nome?.trim().slice(0, 100) || null;
  if (!lid && !chaveTelefone(telefone)) return null;
  let r: Resolvido;
  try {
    r = await resolverContato(lid, telefone, nome, trocarNome);
  } catch (e) {
    // Outro lote criou (P2002) ou juntou/apagou (P2025) o mesmo contato no meio do caminho: busca de novo.
    const codigo = codigoErro(e);
    if (codigo !== "P2002" && codigo !== "P2025") throw e;
    r = await resolverContato(lid, telefone, nome, trocarNome);
  }
  if (r.apagado) aoJuntar?.(r.apagado, r.contato);
  return r.contato;
}

export async function obterOuCriarContato(dados: DadosContato): Promise<string> {
  const contato = await contatoDe(dados);
  if (!contato) throw new Error("Contato sem lid nem telefone.");
  return contato.id;
}

/**
 * Cria o grupo sem duplicar: dois lotes do motor (um de cada número da empresa no grupo) podem chegar
 * juntos. `chaveGrupo` (= jid nos grupos, nula nos individuais) é única no banco, então o INSERT IGNORE
 * de um dos dois não faz nada e os dois leem o mesmo grupo em seguida.
 */
async function criarGrupo(jid: string, nome: string | null): Promise<Conversa> {
  await prisma.conversaWhatsapp.createMany({ data: [{ jid, chaveGrupo: jid, tipo: "grupo", nome }], skipDuplicates: true });
  return (await prisma.conversaWhatsapp.findUnique({ where: { chaveGrupo: jid }, select: CAMPOS_CONVERSA }))!;
}

/** Grupos (de qualquer número) e individuais deste número, pelo jid. */
async function carregarConversas(numeroId: string, jids: string[]): Promise<Map<string, Conversa>> {
  const lista = await prisma.conversaWhatsapp.findMany({
    where: { jid: { in: [...new Set(jids)] }, OR: [{ tipo: "grupo" }, { numeroId }] },
    select: CAMPOS_CONVERSA,
  });
  return new Map(lista.map((c) => [c.jid, c]));
}

/** Conversa do jid: do cache do lote, ou criada agora (grupo com trava; individual com o contato e a categoria inicial). */
async function obterConversa(
  numeroId: string,
  jid: string,
  tipo: "grupo" | "individual",
  nome: string | null,
  cache: Map<string, Conversa>,
  aoJuntar?: AoJuntar,
): Promise<Conversa> {
  const existente = cache.get(jid);
  if (existente) return existente;
  let conversa: Conversa;
  if (tipo === "grupo") {
    conversa = await criarGrupo(jid, nome);
  } else {
    // Nome de chat (lista do histórico) só preenche contato sem nome; quem troca o nome é a mensagem ao vivo.
    const contato = await contatoDe({ jid, nome }, false, aoJuntar);
    // INSERT IGNORE pelo único (numeroId, jid): se outro lote criou antes, fica a dele.
    await prisma.conversaWhatsapp.createMany({
      data: [{
        jid, tipo: "individual", numeroId, nome, contatoId: contato?.id ?? null,
        categoria: categoriaInicial({ alunoId: contato?.alunoId ?? null, usuarioId: contato?.usuarioId ?? null }),
      }],
      skipDuplicates: true,
    });
    conversa = (await prisma.conversaWhatsapp.findUnique({ where: { numeroId_jid: { numeroId, jid } }, select: CAMPOS_CONVERSA }))!;
  }
  cache.set(jid, conversa);
  return conversa;
}

/** Registra que o número está nos grupos (idempotente). */
async function registrarNosGrupos(numeroId: string, conversas: Iterable<Conversa>): Promise<void> {
  const ids = [...new Set([...conversas].filter((c) => c.tipo === "grupo").map((c) => c.id))];
  if (ids.length === 0) return;
  await prisma.numeroNoGrupo.createMany({ data: ids.map((conversaId) => ({ numeroId, conversaId })), skipDuplicates: true });
}

/** Conversas que o motor listou para o número: cria as que faltam e atualiza o nome. */
export async function aplicarConversas(numeroId: string, conversas: EventoConversas["conversas"], agora: Date): Promise<void> {
  void agora;
  if (conversas.length === 0) return;
  const cache = await carregarConversas(numeroId, conversas.map((c) => c.jid));
  const usadas: Conversa[] = [];
  for (const c of conversas) {
    const nome = c.nome?.trim().slice(0, 120) || null;
    // O tipo vem do jid; o `tipo` do motor que não bate é ignorado.
    const conversa = await obterConversa(numeroId, c.jid, tipoDoJid(c.jid), nome, cache);
    if (nome && nome !== conversa.nome) {
      await prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { nome } });
      conversa.nome = nome;
    }
    usadas.push(conversa);
  }
  await registrarNosGrupos(numeroId, usadas);
}

/** Telefones (por chave) dos números da empresa não excluídos. */
async function chavesDaEmpresa(): Promise<Set<string>> {
  const numeros = await prisma.numeroWhatsapp.findMany({ where: { excluidoEm: null, telefone: { not: null } }, select: { telefone: true } });
  return new Set(numeros.map((n) => chaveTelefone(n.telefone)).filter((c): c is string => c !== null));
}

/** Autor da mensagem: o informado pelo motor; em conversa individual sem autor, quem não é a empresa é o contato da conversa. */
function dadosDoAutor(m: MensagemMotor, conversa: Conversa): DadosContato | null {
  if (m.autorJid || m.autorTelefone) return { jid: m.autorJid, telefone: m.autorTelefone ?? null, nome: m.autorNome ?? null };
  if (conversa.tipo === "individual" && !m.deMim) return { jid: conversa.jid, nome: m.autorNome ?? null };
  return null;
}

/**
 * Cache que vale para uma chamada inteira do motor (vários eventos de mensagens): contatos já
 * resolvidos e telefones da empresa. Quem aplica um `conectado` no meio do lote apaga `empresa`.
 */
export type ContextoCaptura = {
  contatos: Map<string, Contato | null>;
  empresa?: Set<string>;
  /** lid → jid do telefone do contato (null: o contato não tem telefone ou não existe). */
  jidDoLid?: Map<string, string | null>;
  /** Contatos do lid juntados no meio da chamada: id apagado → id que ficou. */
  juntados: Map<string, string>;
};

type LinhaMensagem = {
  conversaId: string;
  idExterno: string;
  numeroId: string;
  contatoId: string | null;
  deMim: boolean;
  tipo: TipoMensagemWhatsapp;
  texto: string | null;
  respondeAIdExterno: string | null;
  enviadaEm: Date;
};

/**
 * Mensagens de um lote do motor. Do histórico, só as dos últimos 30 dias. Cada conversa decide se
 * guarda, guarda como provisória (marca `provisoriaAte` = agora + 48 h se ainda não tem) ou descarta.
 * Reaplicar o mesmo lote não duplica nada (único por conversa e idExterno).
 */
export async function aplicarMensagens(
  numeroId: string,
  origem: "historico" | "ao_vivo",
  mensagens: EventoMensagens["mensagens"],
  agora: Date,
  contexto: ContextoCaptura = { contatos: new Map(), juntados: new Map() },
): Promise<{ salvas: number; descartadas: number }> {
  const validas = origem === "historico" ? mensagens.filter((m) => dentroDoHistorico(new Date(m.enviadaEm), agora)) : mensagens;
  let descartadas = mensagens.length - validas.length;
  if (validas.length === 0) return { salvas: 0, descartadas };

  // Mensagem própria em chat @lid de contato com telefone vai para a conversa do telefone.
  const jidDoLid = (contexto.jidDoLid ??= new Map());
  const jidDe = new Map<MensagemMotor, string>();
  for (const m of validas) {
    let jid = m.jid;
    if (m.deMim && tipoDoJid(jid) === "individual" && lidDoJid(jid)) {
      if (!jidDoLid.has(jid)) {
        const c = await prisma.contatoWhatsapp.findUnique({ where: { lid: jid }, select: { telefone: true } });
        const tel = soDigitos(c?.telefone ?? null);
        jidDoLid.set(jid, tel && chaveTelefone(tel) ? `${tel}@s.whatsapp.net` : null);
      }
      jid = jidDoLid.get(jid) ?? jid;
    }
    jidDe.set(m, jid);
  }

  const cache = await carregarConversas(numeroId, [...jidDe.values()]);
  const empresa = (contexto.empresa ??= await chavesDaEmpresa());
  const contatos = contexto.contatos;
  const juntados = contexto.juntados;
  // O contato do lid juntado some do banco: quem apontava para ele (cache e linhas deste lote) passa ao que ficou.
  const aoJuntar: AoJuntar = (apagado, ficou) => {
    for (const [de, para] of juntados) if (para === apagado.id) juntados.set(de, ficou.id);
    juntados.set(apagado.id, ficou.id);
    for (const [chave, c] of contatos) if (c?.id === apagado.id) contatos.set(chave, ficou);
    if (apagado.lid) jidDoLid.delete(apagado.lid);
  };
  const linhas: LinhaMensagem[] = [];
  const tocadas = new Map<string, { conversa: Conversa; provisoria: boolean; ultima: Date }>();

  for (const m of validas) {
    const jid = jidDe.get(m)!;
    const conversa = await obterConversa(numeroId, jid, tipoDoJid(jid), null, cache, aoJuntar);
    const decisao = decidirGuardar(conversa, origem);
    if (decisao === "descartar") {
      descartadas++;
      continue;
    }
    const dados = dadosDoAutor(m, conversa);
    let autor: Contato | null = null;
    if (dados) {
      // A origem entra na chave: ao vivo troca o nome, histórico não.
      const chaveCache = `${origem}|${dados.jid ?? ""}|${dados.telefone ?? ""}|${dados.nome ?? ""}`;
      if (!contatos.has(chaveCache)) contatos.set(chaveCache, await contatoDe(dados, origem === "ao_vivo", aoJuntar));
      autor = contatos.get(chaveCache)!;
    }
    const chaveAutor = chaveTelefone(autor?.telefone);
    const enviadaEm = new Date(m.enviadaEm);
    linhas.push({
      conversaId: conversa.id,
      idExterno: m.idExterno,
      numeroId,
      contatoId: autor?.id ?? null,
      deMim: m.deMim || (chaveAutor !== null && empresa.has(chaveAutor)),
      tipo: m.tipo,
      texto: m.texto?.slice(0, MAX_TEXTO) ?? null,
      respondeAIdExterno: m.respondeA ?? null,
      enviadaEm,
    });
    const t = tocadas.get(conversa.id) ?? { conversa, provisoria: false, ultima: enviadaEm };
    t.provisoria ||= decisao === "provisoria";
    if (enviadaEm > t.ultima) t.ultima = enviadaEm;
    tocadas.set(conversa.id, t);
  }

  for (const l of linhas) if (l.contatoId) l.contatoId = juntados.get(l.contatoId) ?? l.contatoId;
  const { count } = linhas.length
    ? await prisma.mensagemWhatsapp.createMany({ data: linhas, skipDuplicates: true })
    : { count: 0 };

  for (const { conversa, provisoria, ultima } of tocadas.values()) {
    if (provisoria && !conversa.provisoriaAte) {
      await prisma.conversaWhatsapp.updateMany({
        where: { id: conversa.id, provisoriaAte: null },
        data: { provisoriaAte: new Date(agora.getTime() + HORAS_PROVISORIO * 3_600_000) },
      });
    }
    await prisma.conversaWhatsapp.updateMany({
      where: { id: conversa.id, OR: [{ ultimaMensagemEm: null }, { ultimaMensagemEm: { lt: ultima } }] },
      data: { ultimaMensagemEm: ultima },
    });
  }
  await registrarNosGrupos(numeroId, cache.values());
  return { salvas: count, descartadas };
}
