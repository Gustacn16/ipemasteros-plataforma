import "server-only";
import type { CategoriaConversaWhatsapp, TipoMensagemWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventoConversas, EventoMensagens, MensagemMotor } from "../esquemas/motor";
import { categoriaInicial, chaveTelefone, decidirGuardar, dentroDoHistorico, HORAS_PROVISORIO } from "../regras/captura";

const MAX_TEXTO = 4000;
/** Segundos esperando a trava do grupo; passou disso, o lote falha e o motor reenvia. */
const ESPERA_TRAVA_S = 10;

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

/**
 * Aluno e usuário com a mesma chave de telefone. O telefone deles é guardado em formatos variados,
 * então a busca no banco pega quem termina com os mesmos 8 últimos dígitos e a comparação de chave
 * é feita aqui. Só liga quando há exatamente um.
 */
async function ligacoes(chave: string): Promise<{ alunoId: string | null; usuarioId: string | null }> {
  const fim = chave.slice(-8);
  const [alunos, usuarios] = await Promise.all([
    prisma.aluno.findMany({ where: { telefone: { endsWith: fim } }, select: { id: true, telefone: true } }),
    prisma.usuario.findMany({ where: { whatsapp: { endsWith: fim } }, select: { id: true, whatsapp: true } }),
  ]);
  const alunosIguais = alunos.filter((a) => chaveTelefone(soDigitos(a.telefone)) === chave);
  const usuariosIguais = usuarios.filter((u) => chaveTelefone(soDigitos(u.whatsapp)) === chave);
  return {
    alunoId: alunosIguais.length === 1 ? alunosIguais[0]!.id : null,
    usuarioId: usuariosIguais.length === 1 ? usuariosIguais[0]!.id : null,
  };
}

async function contatoPorChave(chave: string): Promise<Contato | null> {
  const candidatos = await prisma.contatoWhatsapp.findMany({
    where: { telefone: { endsWith: chave.slice(-8) } },
    select: CAMPOS_CONTATO,
  });
  return candidatos.find((c) => chaveTelefone(c.telefone) === chave) ?? null;
}

async function resolverContato(lid: string | null, telefone: string | null, nome: string | null): Promise<Contato> {
  const chave = chaveTelefone(telefone);
  const porLid = lid ? await prisma.contatoWhatsapp.findUnique({ where: { lid }, select: CAMPOS_CONTATO }) : null;
  const porTelefone = chave ? await contatoPorChave(chave) : null;
  // Se o lid e o telefone apontam para contatos diferentes, vale o do telefone (é o que liga ao aluno).
  const contato = porTelefone ?? porLid;
  if (!contato) {
    const ligado = chave ? await ligacoes(chave) : { alunoId: null, usuarioId: null };
    return prisma.contatoWhatsapp.create({
      data: { telefone: chave ? telefone : null, lid, nomeExibido: nome, ...ligado },
      select: CAMPOS_CONTATO,
    });
  }
  const mudancas: Partial<Omit<Contato, "id">> = {};
  if (nome && nome !== contato.nomeExibido) mudancas.nomeExibido = nome;
  if (lid && !contato.lid && !porLid) mudancas.lid = lid;
  if (chave && !contato.telefone) {
    // Contato que só tinha lid ganha o telefone e, com ele, a ligação com aluno/usuário.
    mudancas.telefone = telefone;
    if (!contato.alunoId && !contato.usuarioId) Object.assign(mudancas, await ligacoes(chave));
  }
  if (Object.keys(mudancas).length === 0) return contato;
  return prisma.contatoWhatsapp.update({ where: { id: contato.id }, data: mudancas, select: CAMPOS_CONTATO });
}

/** Contato pelo lid ou pela chave do telefone; null quando não há nenhum dos dois. */
async function contatoDe(dados: { jid?: string; telefone?: string | null; nome?: string | null }): Promise<Contato | null> {
  const lid = lidDoJid(dados.jid);
  const telefone = dados.telefone ?? telefoneDoJid(dados.jid);
  const nome = dados.nome?.trim().slice(0, 100) || null;
  if (!lid && !chaveTelefone(telefone)) return null;
  try {
    return await resolverContato(lid, telefone, nome);
  } catch (e) {
    // Outro lote criou o mesmo contato no meio do caminho (telefone e lid são únicos): busca de novo.
    if (codigoErro(e) === "P2002") return resolverContato(lid, telefone, nome);
    throw e;
  }
}

export async function obterOuCriarContato(dados: { jid?: string; telefone?: string | null; nome?: string | null }): Promise<string> {
  const contato = await contatoDe(dados);
  if (!contato) throw new Error("Contato sem lid nem telefone.");
  return contato.id;
}

/**
 * Cria o grupo sem duplicar. O banco não garante grupo único por jid (o único é (numeroId, jid) e o
 * grupo tem numeroId nulo, que o MySQL não compara), e dois lotes do motor — um de cada número da
 * empresa que está no grupo — podem chegar juntos. Por isso, numa transação READ COMMITTED:
 *  1. GET_LOCK('wag:<jid>') — só uma transação por jid segue daqui (a trava é da conexão, que a
 *     transação interativa mantém fixa; é solta no finally);
 *  2. confere com SELECT ... FOR UPDATE: a leitura travada vê o último dado gravado e, se a transação
 *     anterior já soltou a trava mas ainda não confirmou a criação, espera por ela;
 *  3. só então cria.
 */
async function criarGrupo(jid: string, nome: string | null): Promise<Conversa> {
  const trava = `wag:${jid}`; // jid tem até 60 caracteres; o nome da trava cabe nos 64 do MySQL
  return prisma.$transaction(
    async (tx) => {
      const [r] = await tx.$queryRaw<{ ok: number | bigint | null }[]>`SELECT GET_LOCK(${trava}, ${ESPERA_TRAVA_S}) AS ok`;
      if (Number(r?.ok) !== 1) throw new Error("Não foi possível travar o grupo.");
      try {
        const [existente] = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM conversas_whatsapp WHERE jid = ${jid} AND tipo = 'grupo' LIMIT 1 FOR UPDATE`;
        if (existente) return (await tx.conversaWhatsapp.findUnique({ where: { id: existente.id }, select: CAMPOS_CONVERSA }))!;
        return tx.conversaWhatsapp.create({ data: { jid, tipo: "grupo", nome }, select: CAMPOS_CONVERSA });
      } finally {
        await tx.$queryRaw`SELECT RELEASE_LOCK(${trava})`;
      }
    },
    { isolationLevel: "ReadCommitted" },
  );
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
): Promise<Conversa> {
  const existente = cache.get(jid);
  if (existente) return existente;
  let conversa: Conversa;
  if (tipo === "grupo") {
    conversa = await criarGrupo(jid, nome);
  } else {
    const contato = await contatoDe({ jid, nome });
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
    const conversa = await obterConversa(numeroId, c.jid, c.tipo, nome, cache);
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
function dadosDoAutor(m: MensagemMotor, conversa: Conversa): { jid?: string; telefone?: string | null; nome?: string | null } | null {
  if (m.autorJid || m.autorTelefone) return { jid: m.autorJid, telefone: m.autorTelefone ?? null, nome: m.autorNome ?? null };
  if (conversa.tipo === "individual" && !m.deMim) return { jid: conversa.jid, nome: m.autorNome ?? null };
  return null;
}

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
): Promise<{ salvas: number; descartadas: number }> {
  const validas = origem === "historico" ? mensagens.filter((m) => dentroDoHistorico(new Date(m.enviadaEm), agora)) : mensagens;
  let descartadas = mensagens.length - validas.length;
  if (validas.length === 0) return { salvas: 0, descartadas };

  const cache = await carregarConversas(numeroId, validas.map((m) => m.jid));
  const empresa = await chavesDaEmpresa();
  const contatos = new Map<string, Contato | null>();
  const linhas: LinhaMensagem[] = [];
  const tocadas = new Map<string, { conversa: Conversa; provisoria: boolean; ultima: Date }>();

  for (const m of validas) {
    const conversa = await obterConversa(numeroId, m.jid, tipoDoJid(m.jid), null, cache);
    const decisao = decidirGuardar(conversa, origem);
    if (decisao === "descartar") {
      descartadas++;
      continue;
    }
    const dados = dadosDoAutor(m, conversa);
    let autor: Contato | null = null;
    if (dados) {
      const chaveCache = `${dados.jid ?? ""}|${dados.telefone ?? ""}|${dados.nome ?? ""}`;
      if (!contatos.has(chaveCache)) contatos.set(chaveCache, await contatoDe(dados));
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
