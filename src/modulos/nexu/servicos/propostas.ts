import "server-only";
import { z } from "zod";
import type { Prisma, TipoPropostaNexu } from "@/generated/prisma/client";
import { tratarErroAcao } from "@/lib/acoes";
import { registrarAuditoria } from "@/lib/auditoria";
import { formatarReais } from "@/lib/dinheiro";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { criarEvento } from "@/modulos/agenda/servicos/eventos";
import { valorTotal, vendedorPermitido } from "@/modulos/comercial/regras/venda";
import { criarVenda } from "@/modulos/comercial/servicos/vendas";
import { criarConteudo } from "@/modulos/conteudo/servicos/conteudos";
import { exigirLista, exigirTarefa, podeEditarTarefa, usuariosAtribuiveis } from "@/modulos/tarefas/servicos/acesso";
import { adicionarItemChecklist } from "@/modulos/tarefas/servicos/detalhes";
import { criarTarefa, mudarStatus } from "@/modulos/tarefas/servicos/tarefas";
import {
  CAMPOS_IGNORADOS,
  esquemaProposta,
  esquemaPropostaChecklist,
  esquemaPropostaCriarTarefa,
  esquemaPropostaEvento,
  esquemaPropostaMudarStatus,
  esquemaPropostaPost,
  esquemaPropostaVenda,
  type DadosProposta,
  type EntradaProposta,
} from "../esquemas/propostas";
import type { PropostaVisivel } from "../tipos";
import { anexarMensagens } from "./conversas";

// Propostas do Nexu: a ferramenta só grava a proposta pendente. A ação roda aqui, em confirmarProposta,
// como a pessoa que confirma (o serviço do módulo refaz a checagem de permissão).

export type { PropostaVisivel } from "../tipos";

export const ERRO_JA_DECIDIDA = "Esta proposta já foi decidida.";
const ERRO_INESPERADO = "Não foi possível concluir.";
const ERRO_DADOS_INVALIDOS = "Os dados da proposta não são mais válidos.";
const TAMANHO_RESUMO = 500;
const TAMANHO_ERRO = 500;
const MAX_OPCOES = 30;

/** Permissão do módulo exigida para propor cada tipo (spec, seção 6). */
export const PERMISSAO_DO_TIPO: Record<TipoPropostaNexu, Permissao> = {
  criar_tarefa: "tarefas:usar",
  mudar_status_tarefa: "tarefas:usar",
  adicionar_checklist: "tarefas:usar",
  // Todo evento criado pela agenda é institucional (criarEvento exige editar_institucional). Ruling R11.
  criar_evento: "agenda:editar_institucional",
  criar_post: "conteudo:usar",
  registrar_venda: "comercial:registrar_venda",
};

const ESQUEMA_DO_TIPO = {
  criar_tarefa: esquemaPropostaCriarTarefa,
  mudar_status_tarefa: esquemaPropostaMudarStatus,
  adicionar_checklist: esquemaPropostaChecklist,
  criar_evento: esquemaPropostaEvento,
  criar_post: esquemaPropostaPost,
  registrar_venda: esquemaPropostaVenda,
} satisfies Record<TipoPropostaNexu, z.ZodObject>;

const selecaoVisivel = { id: true, tipo: true, resumo: true, status: true, erro: true, resultadoUrl: true } as const;

function visivel(p: Pick<PropostaVisivel, keyof typeof selecaoVisivel>): PropostaVisivel {
  return { id: p.id, tipo: p.tipo, resumo: p.resumo, status: p.status, erro: p.erro, resultadoUrl: p.resultadoUrl };
}

/** "2026-11-21" → "21/11". */
const diaCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
/** "2026-11-21" → "21/11/2026". */
const diaLongo = (d: string) => `${diaCurto(d)}/${d.slice(0, 4)}`;

/** Lista curta de opções ("id (nome)") para o modelo corrigir o id na próxima chamada. */
function opcoes(itens: { id: string; nome: string }[]): string {
  if (!itens.length) return "nenhuma opção disponível";
  const lista = itens.slice(0, MAX_OPCOES).map((i) => `${i.id} (${i.nome})`);
  return `opções: ${lista.join("; ")}${itens.length > MAX_OPCOES ? `; e mais ${itens.length - MAX_OPCOES}` : ""}`;
}

function exigirPermissaoDoTipo(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

/** Troca o "Não encontrado." do módulo por uma mensagem que diz o que faltou. */
async function ouErro<T>(promessa: Promise<T>, mensagem: string): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroNegocio) throw new ErroNegocio(mensagem);
    throw erro;
  }
}

/** Confere que os ids citados existem e podem ser usados pela pessoa, e monta o resumo legível. */
async function resumir(ator: UsuarioAtual, d: DadosProposta): Promise<string> {
  switch (d.tipo) {
    case "criar_tarefa": {
      if (!podeEditarTarefa(ator)) throw new ErroPermissao("tarefas:criar");
      const lista = await ouErro(exigirLista(ator, d.listaId), "Lista não encontrada ou sem acesso. Peça à pessoa o nome da lista.");
      const ids = [...new Set(d.responsaveis ?? [])];
      const nomes: string[] = [];
      if (ids.length) {
        const atribuiveis = await usuariosAtribuiveis(lista.espacoId);
        const porId = new Map(atribuiveis.map((u) => [u.id, u.nome]));
        if (ids.some((id) => !porId.has(id))) {
          throw new ErroNegocio(`Responsável inválido: só membros do espaço da lista (use buscar_pessoas); ${opcoes(atribuiveis)}.`);
        }
        nomes.push(...ids.map((id) => porId.get(id)!));
      }
      return [
        `Criar tarefa: ${d.titulo}`,
        nomes.length ? `${nomes.length > 1 ? "Responsáveis" : "Responsável"}: ${nomes.join(", ")}` : null,
        d.dataEntrega ? `Prazo: ${diaCurto(d.dataEntrega)}` : null,
        `Lista: ${lista.nome}`,
        d.subtarefas?.length ? `Subtarefas: ${d.subtarefas.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "mudar_status_tarefa": {
      const tarefa = await ouErro(exigirTarefa(ator, d.tarefaId), "Tarefa não encontrada ou sem acesso. Use buscar_tarefas.");
      const status = await prisma.statusLista.findMany({
        where: { listaId: tarefa.listaId },
        orderBy: { ordem: "asc" },
        select: { id: true, nome: true },
      });
      const novo = status.find((s) => s.id === d.statusId);
      if (!novo) throw new ErroNegocio(`Status inválido para esta tarefa; ${opcoes(status)}.`);
      if (novo.id === tarefa.statusId) throw new ErroNegocio(`A tarefa já está em "${novo.nome}".`);
      return `Mudar status: ${tarefa.titulo} → ${novo.nome}`;
    }
    case "adicionar_checklist": {
      const tarefa = await ouErro(exigirTarefa(ator, d.tarefaId), "Tarefa não encontrada ou sem acesso. Use buscar_tarefas.");
      return `Adicionar ao checklist de "${tarefa.titulo}": ${d.texto}`;
    }
    case "criar_evento": {
      const tipos = await prisma.tipoEvento.findMany({
        where: { ativo: true },
        orderBy: { ordem: "asc" },
        select: { id: true, nome: true },
      });
      const tipo = tipos.find((t) => t.id === d.tipoId);
      if (!tipo) throw new ErroNegocio(`Tipo de evento inválido; ${opcoes(tipos)}.`);
      const datas = d.dataInicio === d.dataFim ? diaCurto(d.dataInicio) : `${diaCurto(d.dataInicio)} a ${diaCurto(d.dataFim)}`;
      const horas = d.horaInicio ? ` ${d.horaInicio}${d.horaFim ? `–${d.horaFim}` : ""}` : "";
      return [
        `Criar evento: ${d.titulo}`,
        tipo.nome,
        `${datas}${horas}`,
        d.turma ? `Turma: ${d.turma}` : null,
        d.local ? `Local: ${d.local}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "criar_post": {
      const ativo = {
        ativo: true,
        canal: { ativo: true, excluidoEm: null, marca: { excluidoEm: null } },
      } satisfies Prisma.FormatoCanalWhereInput;
      const selecao = {
        id: true,
        nome: true,
        canal: { select: { id: true, marcaId: true, plataforma: true, marca: { select: { nome: true } } } },
      };
      const formato = await prisma.formatoCanal.findFirst({ where: { id: d.formatoId, ...ativo }, select: selecao });
      const nomeFormato = (f: NonNullable<typeof formato>) => `${f.canal.marca.nome} · ${f.canal.plataforma} · ${f.nome}`;
      if (!formato) {
        const todos = await prisma.formatoCanal.findMany({ where: ativo, take: MAX_OPCOES + 1, select: selecao });
        throw new ErroNegocio(`Formato inválido; ${opcoes(todos.map((f) => ({ id: f.id, nome: nomeFormato(f) })))}.`);
      }
      const extras = [...new Set(d.canalIds)].filter((c) => c !== formato.canal.id);
      if (extras.length) {
        const canais = await prisma.canal.findMany({
          where: { marcaId: formato.canal.marcaId, ativo: true, excluidoEm: null },
          select: { id: true, plataforma: true },
        });
        const validos = new Set(canais.map((c) => c.id));
        if (extras.some((c) => !validos.has(c))) {
          throw new ErroNegocio(
            `Canal inválido: use canais ativos da mesma marca; ${opcoes(canais.map((c) => ({ id: c.id, nome: c.plataforma })))}.`,
          );
        }
      }
      return [
        `Criar post: ${d.titulo}`,
        nomeFormato(formato),
        d.dataPublicacao ? `Publicação: ${diaCurto(d.dataPublicacao.toISOString().slice(0, 10))}` : null,
        "Legenda em rascunho",
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "registrar_venda": {
      // Vendedor só registra no próprio nome; a equipe comercial pode registrar para outros (regra do módulo).
      if (!vendedorPermitido(ator, d.vendedorId)) throw new ErroPermissao("comercial:gerenciar_vendas");
      const produto = await prisma.produto.findFirst({
        where: { id: d.produtoId, ativo: true, excluidoEm: null },
        select: { id: true, nome: true },
      });
      if (!produto) throw new ErroNegocio("Produto indisponível: use a ferramenta produtos para ver os ativos.");
      if (d.ofertaId) {
        const ofertas = await prisma.ofertaProduto.findMany({ where: { produtoId: produto.id }, select: { id: true, nome: true } });
        if (!ofertas.some((o) => o.id === d.ofertaId)) throw new ErroNegocio(`Oferta não pertence ao produto; ${opcoes(ofertas)}.`);
      }
      if (d.canalId) {
        const canais = await prisma.canalVenda.findMany({
          where: { ativo: true },
          orderBy: { ordem: "asc" },
          select: { id: true, nome: true },
        });
        if (!canais.some((c) => c.id === d.canalId)) throw new ErroNegocio(`Canal de venda inválido; ${opcoes(canais)}.`);
      }
      const vendedor = await prisma.usuario.findFirst({
        where: { id: d.vendedorId, ativo: true, papel: { in: ["comercial", "gestor", "admin"] } },
        select: { nome: true },
      });
      if (!vendedor) throw new ErroNegocio("Vendedor inválido: use buscar_pessoas e escolha alguém do comercial.");
      return [
        `Registrar venda: ${produto.nome}`,
        `Cliente: ${d.nomeCliente}`,
        `Vendedor: ${vendedor.nome}`,
        `Total: ${formatarReais(valorTotal(d.entrada, d.numeroParcelas, d.valorParcela))}`,
        `Data: ${diaLongo(d.dataVenda)}`,
        `Pagamento: ${d.metodoPagamento}`,
      ].join(" · ");
    }
  }
}

/** A entrada que fica gravada: só os campos do tipo, nunca os ignorados (ex.: WhatsApp do cliente). */
function dadosParaGravar(entrada: EntradaProposta): Prisma.InputJsonValue {
  const campos = ESQUEMA_DO_TIPO[entrada.tipo].shape as Record<string, unknown>;
  const ignorados: readonly string[] = CAMPOS_IGNORADOS;
  return Object.fromEntries(
    Object.entries(entrada).filter(([k, v]) => k in campos && !ignorados.includes(k) && v !== undefined),
  ) as Prisma.InputJsonValue;
}

function primeiroProblema(erro: z.ZodError): string {
  const p = erro.issues[0];
  return `${p?.path.length ? `${p.path.join(".")}: ` : ""}${p?.message ?? "inválido"}`;
}

/**
 * Valida a proposta, confere permissão e ids (lista, pessoas, produto…), monta o resumo e grava `pendente`.
 * Nada é executado aqui. Id inválido vira ErroNegocio (erro da ferramenta), nunca uma proposta.
 */
export async function criarProposta(
  ator: UsuarioAtual,
  ctx: { conversaId: string; toolUseId: string },
  entrada: EntradaProposta,
): Promise<PropostaVisivel> {
  const parse = esquemaProposta.safeParse(entrada);
  if (!parse.success) throw new ErroNegocio(`Dados inválidos: ${primeiroProblema(parse.error)}`);
  const dados = parse.data;
  exigirPermissaoDoTipo(ator, PERMISSAO_DO_TIPO[dados.tipo]);
  const resumo = (await resumir(ator, dados)).slice(0, TAMANHO_RESUMO);

  const proposta = await prisma.propostaNexu.create({
    data: {
      conversaId: ctx.conversaId,
      usuarioId: ator.id,
      toolUseId: ctx.toolUseId,
      tipo: dados.tipo,
      dados: dadosParaGravar(entrada),
      resumo,
    },
    select: selecaoVisivel,
  });
  return visivel(proposta);
}

/** Tira o discriminador `tipo` antes de passar os dados ao serviço do módulo. */
function semTipo<T extends { tipo: string }>(d: T): Omit<T, "tipo"> {
  const copia: Partial<T> = { ...d };
  delete copia.tipo;
  return copia as Omit<T, "tipo">;
}

const diaParaData = (d: string) => new Date(`${d}T00:00:00Z`);

/** Link da tarefa. Roda depois que a ação já aconteceu no módulo, então nunca lança: na dúvida, "Minhas tarefas". */
async function urlDaTarefa(tarefaId: string): Promise<string> {
  try {
    const tarefa = await prisma.tarefa.findUnique({ where: { id: tarefaId }, select: { listaId: true } });
    return tarefa ? `/tarefas/listas/${tarefa.listaId}?tarefa=${tarefaId}` : "/tarefas/minhas";
  } catch {
    return "/tarefas/minhas";
  }
}

/** Roda a ação no serviço do módulo, como `ator`. Devolve o id e o link do que foi criado/alterado. */
async function executarNoModulo(ator: UsuarioAtual, d: DadosProposta): Promise<{ resultadoId: string; resultadoUrl: string }> {
  switch (d.tipo) {
    case "criar_tarefa": {
      const tarefa = await criarTarefa(ator, {
        listaId: d.listaId,
        titulo: d.titulo,
        descricao: d.descricao || null,
        dataEntrega: d.dataEntrega ? diaParaData(d.dataEntrega) : null,
        responsaveis: d.responsaveis ?? [],
        subtarefas: d.subtarefas ?? [],
      });
      return { resultadoId: tarefa.id, resultadoUrl: `/tarefas/listas/${d.listaId}?tarefa=${tarefa.id}` };
    }
    case "mudar_status_tarefa":
      await mudarStatus(ator, d.tarefaId, d.statusId);
      return { resultadoId: d.tarefaId, resultadoUrl: await urlDaTarefa(d.tarefaId) };
    case "adicionar_checklist":
      await adicionarItemChecklist(ator, d.tarefaId, d.texto);
      return { resultadoId: d.tarefaId, resultadoUrl: await urlDaTarefa(d.tarefaId) };
    case "criar_evento": {
      const criado = await criarEvento(ator, semTipo(d));
      return { resultadoId: criado.id, resultadoUrl: `/agenda?evento=${criado.id}` };
    }
    case "criar_post": {
      const conteudo = await criarConteudo(ator, {
        titulo: d.titulo,
        formatoId: d.formatoId,
        canalIds: d.canalIds,
        dataPublicacao: d.dataPublicacao,
        etapa: "ideia",
        legenda: d.legenda,
      });
      return { resultadoId: conteudo.id, resultadoUrl: `/conteudo/itens/${conteudo.id}` };
    }
    case "registrar_venda": {
      const criada = await criarVenda(ator, semTipo(d));
      // Vendas não têm página própria: o link vai para a lista.
      return { resultadoId: criada.id, resultadoUrl: "/comercial/vendas" };
    }
  }
}

function nomeDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : typeof erro;
}

/** Mensagem amigável da falha. Erro inesperado vai para o log só com o id da proposta. */
function mensagemDaFalha(erro: unknown, propostaId: string): string {
  if (erro instanceof z.ZodError) return ERRO_DADOS_INVALIDOS;
  try {
    return tratarErroAcao(erro).mensagem ?? ERRO_INESPERADO;
  } catch {
    console.error("[nexu] proposta falhou", { propostaId, erro: nomeDoErro(erro) });
    return ERRO_INESPERADO;
  }
}

/** pendente → `status`, só para o dono. Se já saiu de pendente (ou não é dele), recusa. */
async function tirarDePendente(ator: UsuarioAtual, id: string, data: Prisma.PropostaNexuUpdateManyMutationInput) {
  const { count } = await prisma.propostaNexu.updateMany({ where: { id, usuarioId: ator.id, status: "pendente" }, data });
  if (count === 0) throw new ErroNegocio(ERRO_JA_DECIDIDA);
  return prisma.propostaNexu.findUniqueOrThrow({ where: { id } });
}

/**
 * Confirma a proposta: pendente → executando (atômico, evita confirmar duas vezes), revalida os dados e chama
 * o serviço do módulo como quem confirma. Termina em `confirmada` (com link e auditoria) ou `falhou`.
 * A decisão entra na conversa como mensagem da pessoa, para o modelo saber o que aconteceu.
 */
export async function confirmarProposta(ator: UsuarioAtual, id: string): Promise<PropostaVisivel> {
  const proposta = await tirarDePendente(ator, id, { status: "executando" });
  let resultado: { resultadoId: string; resultadoUrl: string };
  try {
    const dados = esquemaProposta.parse({ ...(proposta.dados as object), tipo: proposta.tipo });
    resultado = await executarNoModulo(ator, dados);
  } catch (erro) {
    const texto = mensagemDaFalha(erro, id).slice(0, TAMANHO_ERRO);
    const falhou = await prisma.propostaNexu.update({
      where: { id },
      data: { status: "falhou", erro: texto, decididaEm: new Date() },
    });
    await anexarMensagens(proposta.conversaId, [{ papel: "usuario", conteudo: `[A proposta falhou: ${texto}]` }]);
    return visivel(falhou);
  }

  // A ação já aconteceu no módulo: daqui em diante um erro não pode virar "falhou".
  const { resultadoId, resultadoUrl } = resultado;
  const confirmada = await prisma.$transaction(async (tx) => {
    const atualizada = await tx.propostaNexu.update({
      where: { id },
      data: { status: "confirmada", erro: null, resultadoId, resultadoUrl, decididaEm: new Date() },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "nexu.proposta_confirmada",
        entidade: "PropostaNexu",
        entidadeId: id,
        diff: { tipo: proposta.tipo, resultadoId },
      },
      tx,
    );
    return atualizada;
  });
  await anexarMensagens(proposta.conversaId, [{ papel: "usuario", conteudo: `[Confirmei a proposta: ${proposta.resumo}]` }]);
  return visivel(confirmada);
}

/** Recusa a proposta (pendente → recusada) e registra a decisão na conversa. */
export async function recusarProposta(ator: UsuarioAtual, id: string): Promise<PropostaVisivel> {
  const proposta = await tirarDePendente(ator, id, { status: "recusada", decididaEm: new Date() });
  await anexarMensagens(proposta.conversaId, [{ papel: "usuario", conteudo: `[Recusei a proposta: ${proposta.resumo}]` }]);
  return visivel(proposta);
}
