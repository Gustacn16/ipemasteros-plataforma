// Atualização do Instagram (spec C2a, regras 5.7 a 5.15). A orquestração não fala
// com o banco diretamente: recebe um `RepositorioInstagram` (o de produção fica em
// `repositorio-instagram.ts`), o que permite testá-la sem Prisma.
import { ErroMeta } from "@/lib/meta-graph";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { inicioDoDiaSaoPaulo } from "@/modulos/tarefas/regras/relatorio";
import {
  CODIGOS_LIMITE,
  DIAS_POSTS_RECENTES,
  INICIO_HISTORICO_INSTAGRAM,
  MENSAGEM_SEM_CONTA_INSTAGRAM,
  type NumerosConta,
  type NumerosMidia,
  type TipoMidia,
  codigoDoPermalink,
  dividirPeriodoConta,
  juntarNumerosConta,
  escolherPublicacao,
  lerInsightsConta,
  lerInsightsMidia,
  periodosConta,
  podeIniciarAtualizacao,
  tipoDaMidia,
} from "../regras/instagram";
import { type ClienteInstagram, type MidiaMeta, criarClienteInstagram } from "./instagram-graph";

export type TipoAtualizacao = "completa" | "stories";
export type OrigemAtualizacao = "agendada" | "manual";
export type ResultadoAtualizacao = { status: "concluida" | "falhou" | "recusada"; registros: number; erro?: string };

export type DadosConta = { idExterno: string; usuario: string; nome: string | null; paginaId: string; fotoUrl: string | null };
export type DadosMidia = {
  idExterno: string;
  tipo: TipoMidia;
  legenda: string | null;
  permalink: string;
  codigo: string;
  miniaturaUrl: string | null;
  publicadoEm: Date;
};

/** O que a atualização lê e grava no banco. */
export type RepositorioInstagram = {
  emAndamento(tipo: TipoAtualizacao): Promise<{ iniciadoEm: Date } | null>;
  marcarInterrompidas(tipo: TipoAtualizacao, antesDe: Date): Promise<void>;
  criarAtualizacao(d: {
    tipo: TipoAtualizacao;
    origem: OrigemAtualizacao;
    usuarioId?: string;
    iniciadoEm?: Date;
    status?: "falhou";
    finalizadoEm?: Date;
    erro?: string;
  }): Promise<{ id: string }>;
  fecharAtualizacao(
    id: string,
    d: { status: "concluida" | "falhou"; finalizadoEm: Date; registros: number; erro: string | null },
  ): Promise<void>;
  /** Upsert por `idExterno`, sem mexer em `canalId` nem em `ativa` (regra 5.1). */
  salvarContas(contas: DadosConta[]): Promise<void>;
  contasParaImportar(): Promise<{ id: string; idExterno: string }[]>;
  temMidias(contaId: string): Promise<boolean>;
  /** Já tem a linha `mes` de janeiro de 2026, a última gravada na carga inicial. */
  temHistoricoConta(contaId: string): Promise<boolean>;
  /** Upsert por `idExterno`; o post visto de novo deixa de estar removido. Devolve o id de cada um. */
  salvarMidias(contaId: string, midias: DadosMidia[]): Promise<Map<string, string>>;
  /** Posts (não stories) publicados desde `desde` que não estão em `vistos` recebem `removidaEm` (regra 5.11). */
  marcarRemovidas(contaId: string, desde: Date, vistos: string[], agora: Date): Promise<number>;
  /** Posts (não stories, não removidos) cujos números serão pedidos: primeiro os sem `metricasEm`. */
  midiasParaNumeros(contaId: string, o: { desde: Date; todas: boolean }): Promise<{ id: string; idExterno: string; tipo: TipoMidia }[]>;
  salvarNumerosMidia(id: string, numeros: NumerosMidia, agora: Date): Promise<void>;
  salvarLinhaConta(contaId: string, periodo: "dia" | "mes", dia: string, numeros: NumerosConta): Promise<void>;
  salvarSeguidores(contaId: string, dia: string, seguidores: number): Promise<void>;
  midiasSemLigacao(contaId: string): Promise<{ id: string; codigo: string }[]>;
  /** Publicações sem post ligado, no canal da conta, com a etapa do conteúdo. */
  publicacoesCandidatas(contaId: string): Promise<{ id: string; url: string | null; etapa: string }[]>;
  /** Liga e aplica a regra 5.14 (publicação publicada, números copiados, etapa recalculada). */
  ligar(midiaId: string, publicacaoId: string): Promise<void>;
  /** Copia os números de todos os posts ligados da conta para as publicações. */
  copiarNumerosLigados(contaId: string): Promise<void>;
};

const LIMITE_EM_ANDAMENTO_MS = 30 * 60_000;
/** Erros de chave ou permissão: não adianta seguir com os outros posts. */
const CODIGOS_FATAIS = [190, 10, 200];

const ehLimite = (e: unknown) =>
  e instanceof ErroMeta && e.codigo !== undefined && (CODIGOS_LIMITE as readonly number[]).includes(e.codigo);
const ehFatal = (e: unknown) => e instanceof ErroMeta && e.codigo !== undefined && CODIGOS_FATAIS.includes(e.codigo);
/** Mensagem segura para guardar: só `ErroMeta` (já em português, sem a chave); o resto vira genérico. */
const mensagemDe = (e: unknown) => (e instanceof ErroMeta ? e.message : "Erro inesperado na atualização.");

function dadosDaMidia(m: MidiaMeta): DadosMidia {
  const tipo = tipoDaMidia(m);
  return {
    idExterno: m.id,
    tipo,
    legenda: m.caption ?? null,
    permalink: m.permalink,
    // Sem código reconhecível (link fora do padrão), o id da Meta evita ligações erradas.
    codigo: codigoDoPermalink(m.permalink) ?? m.id,
    miniaturaUrl: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? null,
    publicadoEm: new Date(m.timestamp),
  };
}

type Opcoes = {
  tipo: TipoAtualizacao;
  origem: OrigemAtualizacao;
  usuarioId?: string;
  agora?: Date;
  cliente?: ClienteInstagram;
  repo: RepositorioInstagram;
};
export type InicioAtualizacao = {
  status: "iniciada";
  atualizacaoId: string;
  cliente: ClienteInstagram;
  agora: Date;
  tipo: TipoAtualizacao;
  origem: OrigemAtualizacao;
};

/**
 * Parte rápida: confere a configuração e a trava do tipo e cria o registro "em andamento".
 * "Atualizar agora" chama só esta parte na resposta e roda `executarAtualizacao` depois (`after`).
 */
export async function iniciarAtualizacao(o: Opcoes): Promise<InicioAtualizacao | ResultadoAtualizacao> {
  const agora = o.agora ?? new Date();
  const token = process.env.META_ACCESS_TOKEN;
  if (!o.cliente && !token) {
    const erro = "Integração não configurada.";
    await o.repo.criarAtualizacao({ tipo: o.tipo, origem: o.origem, usuarioId: o.usuarioId, status: "falhou", finalizadoEm: agora, erro });
    return { status: "falhou", registros: 0, erro };
  }
  const cliente = o.cliente ?? criarClienteInstagram(token!);

  const vez = podeIniciarAtualizacao(await o.repo.emAndamento(o.tipo), agora);
  if (!vez.pode) return { status: "recusada", registros: 0, erro: "Já existe uma atualização em andamento." };
  if (vez.expirada) await o.repo.marcarInterrompidas(o.tipo, new Date(agora.getTime() - LIMITE_EM_ANDAMENTO_MS));

  const { id } = await o.repo.criarAtualizacao({ tipo: o.tipo, origem: o.origem, usuarioId: o.usuarioId, iniciadoEm: agora });
  return { status: "iniciada", atualizacaoId: id, cliente, agora, tipo: o.tipo, origem: o.origem };
}

/** Contadores e avisos de uma rodada. */
type Rodada = { registros: number; postsSemNumeros: number; avisos: string[]; parouNoLimite: boolean };

/** Parte lenta: lê a Meta e grava tudo, fechando o registro criado em `iniciarAtualizacao`. */
export async function executarAtualizacao(inicio: InicioAtualizacao & { repo: RepositorioInstagram }): Promise<ResultadoAtualizacao> {
  const { repo, cliente, agora } = inicio;
  const r: Rodada = { registros: 0, postsSemNumeros: 0, avisos: [], parouNoLimite: false };
  try {
    if (inicio.tipo === "completa") {
      const contas = await cliente.listarContas();
      if (contas.length === 0) throw new ErroMeta(MENSAGEM_SEM_CONTA_INSTAGRAM);
      await repo.salvarContas(contas);
    }
    for (const conta of await repo.contasParaImportar()) {
      if (inicio.tipo === "completa") await atualizarConta(repo, cliente, conta, agora, inicio.origem === "manual", r);
      await atualizarStories(repo, cliente, conta, agora, r);
      await ligarAutomaticamente(repo, conta.id);
      await repo.copiarNumerosLigados(conta.id);
    }
  } catch (erro) {
    const mensagem = mensagemDe(erro);
    await repo.fecharAtualizacao(inicio.atualizacaoId, {
      status: "falhou",
      finalizadoEm: new Date(),
      registros: r.registros,
      erro: mensagem,
    });
    return { status: "falhou", registros: r.registros, erro: mensagem };
  }

  if (r.postsSemNumeros > 0)
    r.avisos.unshift(`${r.postsSemNumeros} ${r.postsSemNumeros === 1 ? "post" : "posts"} sem números nesta atualização.`);
  const erro = r.avisos.length ? r.avisos.join("\n") : null;
  await repo.fecharAtualizacao(inicio.atualizacaoId, { status: "concluida", finalizadoEm: new Date(), registros: r.registros, erro });
  return { status: "concluida", registros: r.registros, ...(erro ? { erro } : {}) };
}

/** Avisa do limite uma vez só e marca a rodada para não pedir mais nada à Meta. */
function pararNoLimite(r: Rodada, erro: unknown) {
  if (!r.parouNoLimite) r.avisos.push(mensagemDe(erro));
  r.parouNoLimite = true;
}

async function atualizarConta(
  repo: RepositorioInstagram,
  cliente: ClienteInstagram,
  conta: { id: string; idExterno: string },
  agora: Date,
  todas: boolean,
  r: Rodada,
) {
  const hoje = diaEmSaoPaulo(agora);
  const primeiraVezPosts = !(await repo.temMidias(conta.id));
  const recentes = inicioDoDiaSaoPaulo(somarDias(hoje, -DIAS_POSTS_RECENTES));
  const desde = primeiraVezPosts ? inicioDoDiaSaoPaulo(INICIO_HISTORICO_INSTAGRAM) : recentes;

  // Posts (regra 5.3) e removidos (5.11).
  const midias = (await cliente.listarMidias(conta.idExterno, desde)).map(dadosDaMidia);
  await repo.salvarMidias(conta.id, midias);
  r.registros += midias.length;
  await repo.marcarRemovidas(
    conta.id,
    recentes,
    midias.map((m) => m.idExterno),
    agora,
  );

  // Números dos posts (5.5): primeiro os que ainda não têm, para continuar uma carga interrompida.
  for (const m of await repo.midiasParaNumeros(conta.id, { desde: recentes, todas })) {
    try {
      await repo.salvarNumerosMidia(m.id, lerInsightsMidia(await cliente.insightsMidia(m.idExterno, m.tipo)), agora);
      r.registros++;
    } catch (erro) {
      if (ehFatal(erro)) throw erro;
      if (ehLimite(erro)) return pararNoLimite(r, erro);
      r.postsSemNumeros++;
    }
  }

  // Números da conta (5.6). Janeiro de 2026 é gravado por último: se faltar, a carga inicial é refeita.
  const { dias, meses } = periodosConta({ hoje, primeiraVez: !(await repo.temHistoricoConta(conta.id)) });
  const pedidos = [
    ...dias.map((dia) => ({ periodo: "dia" as const, dia, desde: dia, ate: dia })),
    ...[...meses].reverse().map((m) => ({ periodo: "mes" as const, dia: m.desde, desde: m.desde, ate: m.ate })),
  ];
  // Uma métrica recusada derrubaria todos os dias: vira um aviso só, com a contagem.
  let periodosSemNumeros = 0;
  let primeiroErro = "";
  for (const p of pedidos) {
    try {
      await repo.salvarLinhaConta(conta.id, p.periodo, p.dia, await numerosDoPeriodo(cliente, conta.idExterno, p.desde, p.ate));
      r.registros++;
    } catch (erro) {
      if (ehFatal(erro)) throw erro;
      if (ehLimite(erro)) return pararNoLimite(r, erro);
      if (periodosSemNumeros++ === 0) primeiroErro = mensagemDe(erro);
    }
  }
  if (periodosSemNumeros > 0)
    r.avisos.push(
      `Números da conta: ${periodosSemNumeros} ${periodosSemNumeros === 1 ? "período" : "períodos"} sem números (${primeiroErro}).`,
    );

  const seguidores = await cliente.seguidores(conta.idExterno);
  if (seguidores !== null) await repo.salvarSeguidores(conta.id, hoje, seguidores);
}

/** Números da conta num período; mês de 31 dias vai em dois pedidos (a Meta aceita no máximo 30 dias). */
async function numerosDoPeriodo(cliente: ClienteInstagram, contaId: string, desde: string, ate: string): Promise<NumerosConta> {
  const { principal, extra } = dividirPeriodoConta(desde, ate);
  const base = lerInsightsConta(await cliente.insightsConta(contaId, principal.desde, principal.ate));
  return extra ? juntarNumerosConta(base, lerInsightsConta(await cliente.insightsConta(contaId, extra, extra))) : base;
}

async function atualizarStories(
  repo: RepositorioInstagram,
  cliente: ClienteInstagram,
  conta: { id: string; idExterno: string },
  agora: Date,
  r: Rodada,
) {
  if (r.parouNoLimite) return;
  const stories = (await cliente.listarStories(conta.idExterno)).map(dadosDaMidia);
  const ids = await repo.salvarMidias(conta.id, stories);
  r.registros += stories.length;
  for (const s of stories) {
    try {
      await repo.salvarNumerosMidia(ids.get(s.idExterno)!, lerInsightsMidia(await cliente.insightsMidia(s.idExterno, "story")), agora);
      r.registros++;
    } catch (erro) {
      if (ehFatal(erro)) throw erro;
      if (ehLimite(erro)) return pararNoLimite(r, erro);
      r.postsSemNumeros++;
    }
  }
}

/** Ligação automática (regra 5.12): cada publicação é usada uma vez só. */
async function ligarAutomaticamente(repo: RepositorioInstagram, contaId: string) {
  let candidatas = await repo.publicacoesCandidatas(contaId);
  for (const m of await repo.midiasSemLigacao(contaId)) {
    const publicacaoId = escolherPublicacao(m.codigo, candidatas);
    if (!publicacaoId) continue;
    await repo.ligar(m.id, publicacaoId);
    candidatas = candidatas.filter((c) => c.id !== publicacaoId);
  }
}

/** Atualização completa ou de stories com o repositório do banco (usada pelo cron). */
export async function atualizarInstagram(o: Omit<Opcoes, "repo">): Promise<ResultadoAtualizacao> {
  const { repositorioPrisma } = await import("./repositorio-instagram");
  const inicio = await iniciarAtualizacao({ ...o, repo: repositorioPrisma });
  return inicio.status === "iniciada" ? executarAtualizacao({ ...inicio, repo: repositorioPrisma }) : inicio;
}
