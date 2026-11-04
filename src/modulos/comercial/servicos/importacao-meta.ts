import "server-only";
import { prisma } from "@/lib/prisma";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { centavosDoGasto, lerLeads, periodosImportacao, podeIniciarImportacao } from "../regras/meta-ads";
import { type ClienteMeta, ErroMeta, criarClienteMeta } from "./meta-graph";

/** A chave funciona, mas o usuário do sistema não tem contas de anúncio atribuídas. */
export const MENSAGEM_SEM_CONTAS =
  "Nenhuma conta de anúncio encontrada para esta chave. No Business Manager, atribua as contas de anúncio ao usuário do sistema.";
const MAX_TIPOS_IGNORADOS = 20;
const LIMITE_EM_ANDAMENTO_MS = 30 * 60_000;
const dataDoDia = (dia: string) => new Date(`${dia}T00:00:00Z`);
const inteiro = (v: string | undefined) => Math.trunc(Number(v ?? 0)) || 0;
/** Período coberto pela importação (do dia mais antigo ao mais recente pedido). */
const periodoDe = (dias: string[]) =>
  dias.length ? { desde: dataDoDia([...dias].sort()[0]!), ate: dataDoDia([...dias].sort().at(-1)!) } : {};

type Resultado = { status: "concluida" | "falhou" | "recusada"; registros: number; erro?: string };

/** Mensagem segura para guardar: só `ErroMeta` (já em português, sem a chave); o resto vira genérico. */
const mensagemDe = (erro: unknown) => (erro instanceof ErroMeta ? erro.message : "Erro inesperado na importação.");

type Opcoes = { origem: "agendada" | "manual"; usuarioId?: string; agora?: Date; cliente?: ClienteMeta };
type Inicio = { status: "iniciada"; importacaoId: string; cliente: ClienteMeta; agora: Date } | Resultado;

/**
 * Importa contas, campanhas e números diários do Meta Ads (spec Meta Ads, seção 5).
 * Idempotente: tudo é `upsert`. Um erro numa conta não impede as outras.
 */
export async function importarMetaAds(o: Opcoes): Promise<Resultado> {
  const inicio = await iniciarImportacao(o);
  return inicio.status === "iniciada" ? executarImportacao(inicio) : inicio;
}

/**
 * Parte rápida: confere a configuração e a regra de uma por vez e cria o registro
 * "em andamento". "Atualizar agora" chama só esta parte na resposta e roda
 * `executarImportacao` depois (`after`), porque a primeira carga pode levar minutos.
 */
export async function iniciarImportacao(o: Opcoes): Promise<Inicio> {
  const agora = o.agora ?? new Date();
  const token = process.env.META_ACCESS_TOKEN;
  if (!o.cliente && !token) {
    await prisma.importacaoAnuncios.create({
      data: { origem: o.origem, status: "falhou", finalizadoEm: agora, erro: "Integração não configurada.", iniciadaPorId: o.usuarioId },
    });
    return { status: "falhou", registros: 0, erro: "Integração não configurada." };
  }
  const cliente = o.cliente ?? criarClienteMeta(token!);

  // Uma importação por vez (spec 5.5).
  const emAndamento = await prisma.importacaoAnuncios.findFirst({ where: { status: "em_andamento" }, orderBy: { iniciadoEm: "desc" } });
  const vez = podeIniciarImportacao(emAndamento, agora);
  if (!vez.pode) return { status: "recusada", registros: 0, erro: "Já existe uma importação em andamento." };
  if (vez.expirada) {
    // Todas as que ficaram presas (processo reiniciado no meio, por exemplo).
    await prisma.importacaoAnuncios.updateMany({
      where: { status: "em_andamento", iniciadoEm: { lt: new Date(agora.getTime() - LIMITE_EM_ANDAMENTO_MS) } },
      data: { status: "falhou", finalizadoEm: agora, erro: "Interrompida." },
    });
  }

  const importacao = await prisma.importacaoAnuncios.create({ data: { origem: o.origem, iniciadaPorId: o.usuarioId } });
  return { status: "iniciada", importacaoId: importacao.id, cliente, agora };
}

/** Parte lenta: lê a Meta e grava tudo, fechando o registro criado em `iniciarImportacao`. */
export async function executarImportacao({
  importacaoId,
  cliente,
  agora,
}: {
  importacaoId: string;
  cliente: ClienteMeta;
  agora: Date;
}): Promise<Resultado> {
  const importacao = { id: importacaoId };
  const hoje = diaEmSaoPaulo(agora);
  const dias: string[] = [];

  let registros = 0;
  const erros: string[] = [];
  const ignorados = new Set<string>();
  try {
    const contas = await cliente.listarContas();
    if (contas.length === 0) erros.push(MENSAGEM_SEM_CONTAS);
    for (const c of contas) {
      await prisma.contaAnuncio.upsert({
        where: { idExterno: c.id },
        create: { idExterno: c.id, nome: c.name, moeda: c.currency },
        // `ativa` é escolha do admin: não muda na importação.
        update: { nome: c.name, moeda: c.currency },
      });
    }
    const ativas = await prisma.contaAnuncio.findMany({ where: { ativa: true, idExterno: { in: contas.map((c) => c.id) } } });

    for (const conta of ativas) {
      // Cada conta refaz o histórico desde 2026-01-01 até terminar uma carga completa sem erro;
      // depois, só os últimos 7 dias. Conta nova também recebe o histórico.
      const periodos = periodosImportacao({ temDados: conta.historicoCompletoEm !== null, hoje });
      for (const p of periodos) dias.push(p.desde, p.ate);
      try {
        const campanhas = await cliente.listarCampanhas(conta.idExterno);
        const idPorExterno = new Map<string, string>();
        for (const camp of campanhas) {
          const salva = await prisma.campanhaAnuncio.upsert({
            where: { idExterno: camp.id },
            create: { idExterno: camp.id, contaId: conta.id, nome: camp.name, status: camp.status, objetivo: camp.objective ?? null },
            // A atribuição a produto é feita na tela e nunca é sobrescrita aqui.
            update: { contaId: conta.id, nome: camp.name, status: camp.status, objetivo: camp.objective ?? null },
            select: { id: true },
          });
          idPorExterno.set(camp.id, salva.id);
        }

        for (const periodo of periodos) {
          const linhas = await cliente.listarInsights(conta.idExterno, periodo.desde, periodo.ate);
          for (const l of linhas) {
            let campanhaId = idPorExterno.get(l.campaign_id);
            if (!campanhaId) {
              // Campanha excluída na Meta, mas com números no período.
              const nova = await prisma.campanhaAnuncio.upsert({
                where: { idExterno: l.campaign_id },
                create: { idExterno: l.campaign_id, contaId: conta.id, nome: `Campanha ${l.campaign_id}`, status: "DESCONHECIDO" },
                update: {},
                select: { id: true },
              });
              campanhaId = nova.id;
              idPorExterno.set(l.campaign_id, campanhaId);
            }
            const leads = lerLeads(l.actions);
            for (const t of leads.ignorados) ignorados.add(t);
            const numeros = {
              investimento: (centavosDoGasto(l.spend) / 100).toFixed(2),
              impressoes: inteiro(l.impressions),
              alcance: inteiro(l.reach),
              cliques: inteiro(l.clicks),
              leadsFormulario: leads.leadsFormulario,
              leadsSite: leads.leadsSite,
              conversasIniciadas: leads.conversasIniciadas,
            };
            const data = dataDoDia(l.date_start);
            await prisma.metricaDiariaAnuncio.upsert({
              where: { campanhaId_data: { campanhaId, data } },
              create: { campanhaId, data, ...numeros },
              update: numeros,
            });
            registros++;
          }
        }
        if (conta.historicoCompletoEm === null) {
          await prisma.contaAnuncio.update({ where: { id: conta.id }, data: { historicoCompletoEm: agora } });
        }
      } catch (erro) {
        erros.push(`${conta.nome} (${conta.idExterno}): ${mensagemDe(erro)}`);
      }
    }
  } catch (erro) {
    const mensagem = mensagemDe(erro);
    await prisma.importacaoAnuncios.update({
      where: { id: importacao.id },
      data: { status: "falhou", finalizadoEm: new Date(), registros, erro: mensagem, ...periodoDe(dias) },
    });
    return { status: "falhou", registros, erro: mensagem };
  }

  const tipos = [...ignorados].slice(0, MAX_TIPOS_IGNORADOS);
  const detalhes = [...erros, ...(tipos.length ? [`Tipos de resultado não contados como lead: ${tipos.join(", ")}`] : [])];
  await prisma.importacaoAnuncios.update({
    where: { id: importacao.id },
    data: {
      status: "concluida",
      finalizadoEm: new Date(),
      registros,
      erro: detalhes.length ? detalhes.join("\n") : null,
      ...periodoDe(dias),
    },
  });
  return { status: "concluida", registros, erro: erros.length ? erros.join("\n") : undefined };
}

/** Situação para a tela da integração: configuração, contas e últimas importações. */
export async function situacaoIntegracao() {
  const [contas, importacoes] = await Promise.all([
    prisma.contaAnuncio.findMany({ orderBy: { nome: "asc" }, select: { id: true, idExterno: true, nome: true, moeda: true, ativa: true } }),
    prisma.importacaoAnuncios.findMany({ orderBy: { iniciadoEm: "desc" }, take: 10 }),
  ]);
  return {
    configurada: Boolean(process.env.META_ACCESS_TOKEN),
    contas,
    importacoes: importacoes.map((i) => ({
      id: i.id,
      origem: i.origem,
      status: i.status,
      iniciadoEm: i.iniciadoEm.toISOString(),
      finalizadoEm: i.finalizadoEm?.toISOString() ?? null,
      desde: i.desde?.toISOString().slice(0, 10) ?? null,
      ate: i.ate?.toISOString().slice(0, 10) ?? null,
      registros: i.registros,
      erro: i.erro,
    })),
  };
}
export type SituacaoIntegracao = Awaited<ReturnType<typeof situacaoIntegracao>>;

export async function definirContaAtiva(contaId: string, ativa: boolean) {
  await prisma.contaAnuncio.update({ where: { id: contaId }, data: { ativa } });
}
