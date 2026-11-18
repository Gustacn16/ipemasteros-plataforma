import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { iaConfigurada } from "@/lib/ia/cliente";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosConcorrente, DadosPagina } from "../esquemas/configuracao";
import { iniciarColeta } from "./coleta";
import { gastoEspiaoDoMes } from "./gastos";

const MAX_CONCORRENTES = 10;
const MAX_PAGINAS = 10;

function exigirConfigurar(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "espiao:configurar")) throw new ErroPermissao("espiao:configurar");
}

async function conferirLimiteConcorrentes(ignorarId?: string) {
  const ativos = await prisma.concorrente.count({ where: { ativo: true, excluidoEm: null, ...(ignorarId ? { id: { not: ignorarId } } : {}) } });
  if (ativos >= MAX_CONCORRENTES) throw new ErroNegocio(`Limite de ${MAX_CONCORRENTES} concorrentes ativos`);
}

const dadosDoConcorrente = (d: DadosConcorrente) => ({
  nome: d.nome,
  instagram: d.instagram ?? null,
  site: d.site ?? null,
  observacoes: d.observacoes ?? null,
  ativo: d.ativo,
});

export async function criarConcorrente(ator: UsuarioAtual, d: DadosConcorrente): Promise<string> {
  exigirConfigurar(ator);
  if (d.ativo) await conferirLimiteConcorrentes();
  const c = await prisma.concorrente.create({ data: dadosDoConcorrente(d), select: { id: true } });
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.concorrente_criado", entidade: "concorrente", entidadeId: c.id, diff: dadosDoConcorrente(d) });
  return c.id;
}

async function exigirConcorrente(id: string) {
  const c = await prisma.concorrente.findFirst({ where: { id, excluidoEm: null }, select: { id: true } });
  if (!c) throw new ErroNegocio("Concorrente não encontrado.");
}

export async function editarConcorrente(ator: UsuarioAtual, id: string, d: DadosConcorrente): Promise<void> {
  exigirConfigurar(ator);
  await exigirConcorrente(id);
  if (d.ativo) await conferirLimiteConcorrentes(id);
  await prisma.concorrente.update({ where: { id }, data: dadosDoConcorrente(d) });
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.concorrente_alterado", entidade: "concorrente", entidadeId: id, diff: dadosDoConcorrente(d) });
}

export async function excluirConcorrente(ator: UsuarioAtual, id: string): Promise<void> {
  exigirConfigurar(ator);
  await exigirConcorrente(id);
  await prisma.concorrente.update({ where: { id }, data: { excluidoEm: new Date(), ativo: false } });
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.concorrente_excluido", entidade: "concorrente", entidadeId: id });
}

export async function salvarPagina(ator: UsuarioAtual, concorrenteId: string, d: DadosPagina & { id?: string }): Promise<string> {
  exigirConfigurar(ator);
  await exigirConcorrente(concorrenteId);
  let id = d.id;
  if (id) {
    const existe = await prisma.paginaConcorrente.findFirst({ where: { id, concorrenteId, excluidoEm: null }, select: { id: true } });
    if (!existe) throw new ErroNegocio("Página não encontrada.");
    await prisma.paginaConcorrente.update({ where: { id }, data: { url: d.url, rotulo: d.rotulo, ativa: d.ativa } });
  } else {
    const total = await prisma.paginaConcorrente.count({ where: { concorrenteId, excluidoEm: null } });
    if (total >= MAX_PAGINAS) throw new ErroNegocio(`Limite de ${MAX_PAGINAS} páginas por concorrente`);
    id = (await prisma.paginaConcorrente.create({ data: { concorrenteId, url: d.url, rotulo: d.rotulo, ativa: d.ativa }, select: { id: true } })).id;
  }
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.pagina_alterada", entidade: "pagina_concorrente", entidadeId: id, diff: { url: d.url, rotulo: d.rotulo, ativa: d.ativa } });
  return id;
}

export async function excluirPagina(ator: UsuarioAtual, paginaId: string): Promise<void> {
  exigirConfigurar(ator);
  const p = await prisma.paginaConcorrente.findFirst({ where: { id: paginaId, excluidoEm: null }, select: { id: true } });
  if (!p) throw new ErroNegocio("Página não encontrada.");
  await prisma.paginaConcorrente.update({ where: { id: paginaId }, data: { excluidoEm: new Date(), ativa: false } });
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.pagina_alterada", entidade: "pagina_concorrente", entidadeId: paginaId, diff: { excluida: true } });
}

export async function salvarTetoEspiao(ator: UsuarioAtual, tetoMicroUsd: number): Promise<void> {
  exigirConfigurar(ator);
  await prisma.configuracaoIa.upsert({
    where: { id: "unica" },
    update: { limiteEspiaoMicroUsd: tetoMicroUsd, atualizadoPorId: ator.id },
    create: { id: "unica", modelo: "claude-haiku-5-5", limiteMensalMicroUsd: 20_000_000, perguntasPorDia: 50, limiteEspiaoMicroUsd: tetoMicroUsd, atualizadoPorId: ator.id },
  });
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.teto_alterado", entidade: "configuracao_ia", entidadeId: "unica", diff: { limiteEspiaoMicroUsd: tetoMicroUsd } });
}

const MOTIVOS = {
  em_andamento: "Já existe uma coleta em andamento.",
  recente: "A última coleta é recente.",
  sem_concorrentes: "Cadastre pelo menos um concorrente ativo.",
} as const;

export async function coletarAgora(ator: UsuarioAtual): Promise<void> {
  exigirConfigurar(ator);
  const r = await iniciarColeta({ origem: "manual", usuarioId: ator.id });
  if (!r.iniciou) throw new ErroNegocio(MOTIVOS[r.motivo ?? "em_andamento"]);
  await registrarAuditoria({ usuarioId: ator.id, acao: "espiao.coleta_manual", entidade: "coleta_espiao", entidadeId: r.coletaId ?? undefined });
}

/** Tudo o que a tela de configuração mostra. */
export async function situacaoConfiguracao(ator: UsuarioAtual) {
  exigirConfigurar(ator);
  const [concorrentes, contaInstagram, config, gastoMes, coletas] = await Promise.all([
    prisma.concorrente.findMany({
      where: { excluidoEm: null },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: {
        id: true, nome: true, instagram: true, site: true, observacoes: true, ativo: true,
        paginas: { where: { excluidoEm: null }, orderBy: { rotulo: "asc" }, select: { id: true, url: true, rotulo: true, ativa: true, legivel: true, ultimaCapturaEm: true } },
      },
    }),
    prisma.contaInstagram.findFirst({ where: { ativa: true }, select: { usuario: true } }),
    obterConfiguracaoIa(),
    gastoEspiaoDoMes(),
    prisma.coletaEspiao.findMany({ orderBy: { iniciadaEm: "desc" }, take: 10, select: { id: true, origem: true, status: true, iniciadaEm: true, finalizadaEm: true, erros: true } }),
  ]);
  return {
    concorrentes,
    chaves: {
      meta: Boolean(process.env.META_ACCESS_TOKEN) && Boolean(contaInstagram),
      contaInstagram: contaInstagram?.usuario ?? null,
      groq: Boolean(process.env.GROQ_API_KEY),
      ia: iaConfigurada(),
      transcricao: process.env.ESPIAO_TRANSCRICAO !== "desligada",
    },
    tetoMicroUsd: config.limiteEspiaoMicroUsd,
    gastoMesMicroUsd: gastoMes,
    coletas: coletas.map((c) => ({ ...c, erros: Array.isArray(c.erros) ? c.erros.length : 0 })),
  };
}
export type SituacaoConfiguracao = Awaited<ReturnType<typeof situacaoConfiguracao>>;
