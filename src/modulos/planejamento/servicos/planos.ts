import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosMetaAvulsa, DadosPremissaProduto, DadosPremissasFunil, DadosTurma } from "../esquemas/planejamento";
import { INDICADORES_PADRAO, PREMISSAS_FUNIL_PADRAO, type IndicadorPadrao } from "../regras/indicadores-padrao";
import type { ParametrosFonte } from "../regras/fontes";
import { dataDoMes, mesDaData, mesesDoAno } from "../regras/meses";
import { exigir, hojeSp, reaisDe } from "./acesso";
import { mudarPlano, premissasFunilDe } from "./fechamento";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function listarAnos(ator: UsuarioAtual): Promise<number[]> {
  exigir(ator, "planejamento:lancar");
  const planos = await prisma.planoAnual.findMany({ orderBy: { ano: "asc" }, select: { ano: true } });
  return planos.map((p) => p.ano);
}

export async function idDoPlano(ano: number): Promise<string | null> {
  const p = await prisma.planoAnual.findUnique({ where: { ano }, select: { id: true } });
  return p?.id ?? null;
}

/** Plano para as telas de cadastro: premissas, turmas e metas avulsas, com os produtos para escolher. */
export async function obterCadastroDoPlano(ator: UsuarioAtual, ano: number) {
  exigir(ator, "planejamento:ver");
  const plano = await prisma.planoAnual.findUnique({
    where: { ano },
    include: {
      premissas: { include: { produto: { select: { nome: true } } } },
      turmas: { where: { excluidoEm: null }, orderBy: [{ mesAbertura: "asc" }, { codigo: "asc" }], include: { produto: { select: { nome: true } } } },
      metasAvulsas: { orderBy: { mes: "asc" }, include: { produto: { select: { nome: true } } } },
    },
  });
  if (!plano) return null;
  const usados = new Set([...plano.premissas, ...plano.turmas, ...plano.metasAvulsas].map((x) => x.produtoId));
  const produtos = await prisma.produto.findMany({
    where: { excluidoEm: null, OR: [{ ativo: true }, { id: { in: [...usados] } }] },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, tipo: true, duracaoMeses: true },
  });
  return {
    id: plano.id,
    ano: plano.ano,
    premissasFunil: premissasFunilDe(plano),
    premissas: plano.premissas
      .map((p) => ({
        produtoId: p.produtoId,
        produto: p.produto.nome,
        contratoMedio: p.contratoMedio.toFixed(2),
        alunosPorTurma: p.alunosPorTurma,
        janelaVendasMeses: p.janelaVendasMeses,
        duracaoMeses: p.duracaoMeses,
      }))
      .sort((a, b) => a.produto.localeCompare(b.produto, "pt-BR")),
    turmas: plano.turmas.map((t) => ({
      id: t.id,
      produtoId: t.produtoId,
      produto: t.produto.nome,
      codigo: t.codigo,
      mesAbertura: mesDaData(t.mesAbertura),
      alunos: t.alunos,
      contratoMedio: t.contratoMedio?.toFixed(2) ?? null,
      janelaVendasMeses: t.janelaVendasMeses,
      duracaoMeses: t.duracaoMeses,
      observacoes: t.observacoes,
    })),
    metasAvulsas: plano.metasAvulsas.map((a) => ({
      produtoId: a.produtoId,
      produto: a.produto.nome,
      mes: mesDaData(a.mes),
      alunos: a.alunos,
      valor: a.valor.toFixed(2),
    })),
    produtos,
  };
}
export type CadastroDoPlano = NonNullable<Awaited<ReturnType<typeof obterCadastroDoPlano>>>;

/** Liga os indicadores padrão às contas e canais que já existem (Instagram e conteúdos). */
async function fontesIniciais(tx: Prisma.TransactionClient): Promise<Map<string, { fonte: string; parametros: ParametrosFonte }>> {
  const [contas, canais] = await Promise.all([
    tx.contaInstagram.findMany({ where: { ativa: true }, select: { id: true, usuario: true, nome: true } }),
    tx.canal.findMany({
      where: { ativo: true, excluidoEm: null, plataforma: { in: ["instagram", "youtube"] } },
      select: { id: true, plataforma: true, marca: { select: { nome: true } }, formatos: { where: { ativo: true }, select: { id: true, nome: true } } },
    }),
  ]);
  const mapa = new Map<string, { fonte: string; parametros: ParametrosFonte }>();
  const conta = (trecho: string) => contas.find((c) => semAcento(`${c.usuario} ${c.nome ?? ""}`).includes(trecho));
  const ipe = conta("ipemaster");
  const pedro = conta("pedro");
  if (ipe) {
    mapa.set("Seguidores Instagram IPEMaster", { fonte: "instagram_seguidores", parametros: { contaId: ipe.id } });
    mapa.set("Alcance no mês", { fonte: "instagram_alcance", parametros: { contaId: ipe.id } });
  }
  if (pedro) mapa.set("Seguidores Pedro Prado", { fonte: "instagram_seguidores", parametros: { contaId: pedro.id } });
  const daMarca = (plataforma: string) => canais.find((c) => c.plataforma === plataforma && semAcento(c.marca.nome).includes("ipemaster"));
  const insta = daMarca("instagram");
  if (insta) {
    const reels = insta.formatos.filter((f) => semAcento(f.nome).includes("reel"));
    const outros = insta.formatos.filter((f) => !semAcento(f.nome).includes("reel") && !semAcento(f.nome).includes("stor"));
    if (outros.length) mapa.set("Posts no feed — IPEMaster", { fonte: "conteudos_publicados", parametros: { canalId: insta.id, formatoIds: outros.map((f) => f.id) } });
    if (reels.length) mapa.set("Reels / vídeos curtos", { fonte: "conteudos_publicados", parametros: { canalId: insta.id, formatoIds: reels.map((f) => f.id) } });
  }
  const yt = daMarca("youtube");
  if (yt) mapa.set("Vídeos no YouTube", { fonte: "conteudos_publicados", parametros: { canalId: yt.id } });
  return mapa;
}

export async function criarPlano(ator: UsuarioAtual, ano: number) {
  exigir(ator, "planejamento:editar");
  if (await idDoPlano(ano)) throw new ErroNegocio(`Já existe um plano para ${ano}.`);
  const p = PREMISSAS_FUNIL_PADRAO;
  return prisma.$transaction(async (tx) => {
    const plano = await tx.planoAnual.create({
      data: {
        ano,
        convLeadAgendada: p.convLeadAgendada,
        comparecimento: p.comparecimento,
        convReuniaoVenda: p.convReuniaoVenda,
        custoPorLead: reaisDe(p.custoPorLeadCentavos),
        comissaoPct: p.comissaoPct,
        tetoCacPct: p.tetoCacPct,
        criadoPorId: ator.id,
      },
      select: { id: true },
    });
    const fontes = await fontesIniciais(tx);
    for (const [ordem, i] of INDICADORES_PADRAO.entries()) await criarIndicadorPadrao(tx, plano.id, ano, ordem + 1, i, fontes.get(i.nome));
    await registrarAuditoria({ usuarioId: ator.id, acao: "planejamento.plano_criado", entidade: "PlanoAnual", entidadeId: plano.id, diff: { ano } }, tx);
    return plano;
  });
}

async function criarIndicadorPadrao(
  tx: Prisma.TransactionClient,
  planoId: string,
  ano: number,
  ordem: number,
  i: IndicadorPadrao,
  fonte: { fonte: string; parametros: ParametrosFonte } | undefined,
) {
  const { metaMensalInicial, ...dados } = i;
  await tx.indicadorPlano.create({
    data: {
      ...dados,
      planoId,
      ordem,
      fonte: fonte?.fonte ?? i.fonte,
      fonteParametros: fonte ? (fonte.parametros as Prisma.InputJsonValue) : undefined,
      metas: metaMensalInicial === null ? undefined : { create: mesesDoAno(ano).map((m) => ({ mes: dataDoMes(m), valor: metaMensalInicial })) },
    },
  });
}

async function garantirProduto(produtoId: string) {
  const p = await prisma.produto.findFirst({ where: { id: produtoId, excluidoEm: null }, select: { id: true } });
  if (!p) throw new ErroNegocio("Produto não encontrado.");
}

export async function salvarPremissasFunil(ator: UsuarioAtual, planoId: string, d: DadosPremissasFunil) {
  exigir(ator, "planejamento:editar");
  await mudarPlano(planoId, hojeSp(), (tx) =>
    tx.planoAnual.update({
      where: { id: planoId },
      data: {
        convLeadAgendada: d.convLeadAgendada,
        comparecimento: d.comparecimento,
        convReuniaoVenda: d.convReuniaoVenda,
        custoPorLead: reaisDe(d.custoPorLeadCentavos),
        comissaoPct: d.comissaoPct,
        tetoCacPct: d.tetoCacPct,
      },
    }),
  );
}

export async function salvarPremissaProduto(ator: UsuarioAtual, planoId: string, d: DadosPremissaProduto) {
  exigir(ator, "planejamento:editar");
  await garantirProduto(d.produtoId);
  const dados = {
    contratoMedio: reaisDe(d.contratoMedio),
    alunosPorTurma: d.alunosPorTurma,
    janelaVendasMeses: d.janelaVendasMeses,
    duracaoMeses: d.duracaoMeses,
  };
  await mudarPlano(planoId, hojeSp(), (tx) =>
    tx.premissaProdutoPlano.upsert({
      where: { planoId_produtoId: { planoId, produtoId: d.produtoId } },
      create: { planoId, produtoId: d.produtoId, ...dados },
      update: dados,
    }),
  );
}

export async function removerPremissaProduto(ator: UsuarioAtual, planoId: string, produtoId: string) {
  exigir(ator, "planejamento:editar");
  await mudarPlano(planoId, hojeSp(), (tx) => tx.premissaProdutoPlano.deleteMany({ where: { planoId, produtoId } }));
}

/** Cria (id nulo) ou edita uma turma do plano. */
export async function salvarTurma(ator: UsuarioAtual, planoId: string, id: string | null, d: DadosTurma) {
  exigir(ator, "planejamento:editar");
  await garantirProduto(d.produtoId);
  const dados = {
    produtoId: d.produtoId,
    codigo: d.codigo,
    mesAbertura: dataDoMes(d.mesAbertura),
    alunos: d.alunos,
    contratoMedio: d.contratoCentavos === null ? null : reaisDe(d.contratoCentavos),
    janelaVendasMeses: d.janelaVendasMeses,
    duracaoMeses: d.duracaoMeses,
    observacoes: d.observacoes,
  };
  await mudarPlano(planoId, hojeSp(), async (tx) => {
    if (!id) return tx.turmaPlano.create({ data: { ...dados, planoId } });
    const r = await tx.turmaPlano.updateMany({ where: { id, planoId, excluidoEm: null }, data: dados });
    if (r.count === 0) throw new ErroNegocio("Turma não encontrada.");
  });
}

export async function excluirTurma(ator: UsuarioAtual, planoId: string, id: string) {
  exigir(ator, "planejamento:editar");
  await mudarPlano(planoId, hojeSp(), async (tx) => {
    const r = await tx.turmaPlano.updateMany({ where: { id, planoId, excluidoEm: null }, data: { excluidoEm: new Date() } });
    if (r.count === 0) throw new ErroNegocio("Turma não encontrada.");
    await registrarAuditoria({ usuarioId: ator.id, acao: "planejamento.turma_excluida", entidade: "TurmaPlano", entidadeId: id }, tx);
  });
}

/** Meta avulsa de um produto no mês. Alunos e valor vazios (ou zero) apagam. */
export async function salvarMetaAvulsa(ator: UsuarioAtual, planoId: string, d: DadosMetaAvulsa) {
  exigir(ator, "planejamento:editar");
  await garantirProduto(d.produtoId);
  const chave = { planoId_produtoId_mes: { planoId, produtoId: d.produtoId, mes: dataDoMes(d.mes) } };
  const alunos = d.alunos ?? 0;
  const valor = d.valor ?? 0;
  await mudarPlano(planoId, hojeSp(), async (tx) => {
    if (alunos === 0 && valor === 0) return tx.metaAvulsaPlano.deleteMany({ where: { planoId, produtoId: d.produtoId, mes: dataDoMes(d.mes) } });
    return tx.metaAvulsaPlano.upsert({
      where: chave,
      create: { planoId, produtoId: d.produtoId, mes: dataDoMes(d.mes), alunos, valor: reaisDe(valor) },
      update: { alunos, valor: reaisDe(valor) },
    });
  });
}

