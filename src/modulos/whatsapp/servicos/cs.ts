import "server-only";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { mediana } from "../regras/atendimento";
import { chaveTelefone, variantesTelefone } from "../regras/captura";
import { DIAS_SEM_CONTATO, situacaoVendaCs, type SituacaoVendaCs } from "../regras/cs";

const ESCOPO = "whatsapp:ver_equipe";

export type VendaCs = {
  id: string;
  produto: string;
  cliente: string;
  criadoEm: Date;
  situacao: SituacaoVendaCs;
  primeiroContatoEm: Date | null;
  segundos: number | null;
  conversaId: string | null;
};

function exigirPermissao(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
}

/** Filtro das conversas individuais de números `cs` não excluídos. */
const conversaCs = { tipo: "individual" as const, numero: { time: "cs" as const, excluidoEm: null } };

/**
 * Vendas de [max(inicio, csDesde), fim) com a situação da CS. null se não há número `cs`.
 * Consultas em lote: números, vendas, contatos, envios e conversas — nunca uma por venda.
 */
async function carregarVendasCs(inicio: Date, fim: Date, agora: Date): Promise<VendaCs[] | null> {
  const numeros = await prisma.numeroWhatsapp.findMany({
    where: { time: "cs", excluidoEm: null },
    select: { id: true, timeDesde: true },
  });
  if (numeros.length === 0) return null;
  const desdes = numeros.map((n) => n.timeDesde?.getTime()).filter((t): t is number => t != null);
  const desde = new Date(Math.max(inicio.getTime(), desdes.length ? Math.min(...desdes) : inicio.getTime()));
  if (desde >= fim) return [];

  const vendas = await prisma.venda.findMany({
    where: { excluidoEm: null, criadoEm: { gte: desde, lt: fim } },
    select: { id: true, nomeCliente: true, whatsappCliente: true, criadoEm: true, produto: { select: { nome: true } } },
  });
  if (vendas.length === 0) return [];

  const chaveDa = new Map(vendas.map((v) => [v.id, chaveTelefone(v.whatsappCliente?.replace(/\D/g, "") ?? null)]));
  const chaves = [...new Set([...chaveDa.values()].filter((c): c is string => c != null))];
  const variantes = [...new Set(chaves.flatMap(variantesTelefone))];

  const contatosDaChave = new Map<string, string[]>();
  if (variantes.length > 0) {
    const contatos = await prisma.contatoWhatsapp.findMany({ where: { telefone: { in: variantes } }, select: { id: true, telefone: true } });
    for (const c of contatos) {
      const chave = chaveTelefone(c.telefone);
      if (!chave) continue;
      contatosDaChave.set(chave, [...(contatosDaChave.get(chave) ?? []), c.id]);
    }
  }
  const contatoIds = [...new Set([...contatosDaChave.values()].flat())];

  const enviosDoContato = new Map<string, { enviadaEm: Date; conversaId: string }[]>();
  const conversaRecente = new Map<string, { id: string; em: number }>();
  if (contatoIds.length > 0) {
    const menorVenda = new Date(Math.min(...vendas.map((v) => v.criadoEm.getTime())));
    const envios = await prisma.mensagemWhatsapp.findMany({
      where: { deMim: true, enviadaEm: { gte: menorVenda }, conversa: { ...conversaCs, contatoId: { in: contatoIds } } },
      select: { enviadaEm: true, conversaId: true, conversa: { select: { contatoId: true } } },
      orderBy: [{ enviadaEm: "asc" }, { id: "asc" }],
    });
    for (const e of envios) {
      const contatoId = e.conversa.contatoId;
      if (!contatoId) continue;
      const lista = enviosDoContato.get(contatoId) ?? [];
      lista.push({ enviadaEm: e.enviadaEm, conversaId: e.conversaId });
      enviosDoContato.set(contatoId, lista);
    }
    const conversas = await prisma.conversaWhatsapp.findMany({
      where: { ...conversaCs, contatoId: { in: contatoIds } },
      select: { id: true, contatoId: true, ultimaMensagemEm: true },
      orderBy: [{ ultimaMensagemEm: "desc" }, { id: "asc" }],
    });
    for (const c of conversas) {
      if (c.contatoId && !conversaRecente.has(c.contatoId)) conversaRecente.set(c.contatoId, { id: c.id, em: c.ultimaMensagemEm?.getTime() ?? 0 });
    }
  }

  return vendas.map((v): VendaCs => {
    const chave = chaveDa.get(v.id) ?? null;
    const ids = chave ? (contatosDaChave.get(chave) ?? []) : [];
    const envios = ids.flatMap((id) => enviosDoContato.get(id) ?? []).sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime());
    const r = situacaoVendaCs(v.criadoEm, chave != null, envios.map((e) => e.enviadaEm), agora);
    let conversaId: string | null = null;
    if (r.primeiroContatoEm) {
      conversaId = envios.find((e) => e.enviadaEm.getTime() === r.primeiroContatoEm!.getTime())!.conversaId;
    } else if (chave) {
      // Vários contatos podem casar com a mesma chave: vale a conversa mais recente entre eles.
      const candidatas = ids.map((id) => conversaRecente.get(id)).filter((c) => c != null);
      conversaId = candidatas.sort((a, b) => b.em - a.em)[0]?.id ?? null;
    }
    return {
      id: v.id,
      produto: v.produto.nome,
      cliente: v.nomeCliente,
      criadoEm: v.criadoEm,
      situacao: r.situacao,
      primeiroContatoEm: r.primeiroContatoEm,
      segundos: r.segundos,
      conversaId,
    };
  });
}

/** Aguardando primeiro (o mais antigo no topo); depois o resto por criadoEm decrescente. */
function ordenar(vendas: VendaCs[]): VendaCs[] {
  const aguardando = vendas.filter((v) => v.situacao === "aguardando").sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());
  const resto = vendas.filter((v) => v.situacao !== "aguardando").sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());
  return [...aguardando, ...resto];
}

function medianaContatadas(vendas: VendaCs[]): number | null {
  return mediana(vendas.filter((v) => v.situacao === "contatada").map((v) => v.segundos!));
}

/**
 * Vendas do período com o tempo até o primeiro contato da CS. Exige `whatsapp:ver_equipe`.
 * Com `incluirAguardandoAnteriores` (a página liga só na semana atual), entram também as vendas
 * de até `DIAS_SEM_CONTATO` dias antes de `inicio` (e a partir do início da CS) que ainda
 * aguardam o primeiro contato. Elas entram na lista e na contagem "aguardando", não na mediana.
 */
export async function listarVendasCs(
  ator: UsuarioAtual,
  inicio: Date,
  fim: Date,
  agora: Date = new Date(),
  opcoes: { incluirAguardandoAnteriores?: boolean } = {},
): Promise<{ semNumeroCs: boolean; vendas: VendaCs[]; medianaSeg: number | null; aguardando: number }> {
  exigirPermissao(ator);
  const desde = opcoes.incluirAguardandoAnteriores ? new Date(inicio.getTime() - DIAS_SEM_CONTATO * 86_400_000) : inicio;
  const carregadas = await carregarVendasCs(desde, fim, agora);
  if (!carregadas) return { semNumeroCs: true, vendas: [], medianaSeg: null, aguardando: 0 };
  const daSemana = carregadas.filter((v) => v.criadoEm >= inicio);
  const anteriores = carregadas.filter((v) => v.criadoEm < inicio && v.situacao === "aguardando");
  const vendas = [...anteriores, ...daSemana];
  return {
    semNumeroCs: false,
    vendas: ordenar(vendas),
    medianaSeg: medianaContatadas(daSemana),
    aguardando: vendas.filter((v) => v.situacao === "aguardando").length,
  };
}

/**
 * Mediana (só das contatadas) e número de vendas por semana. Carrega o período inteiro de uma vez
 * e separa por semana pelo `criadoEm`. Exige `whatsapp:ver_equipe`.
 */
export async function evolucaoCs(
  ator: UsuarioAtual,
  semanas: { inicio: Date; fim: Date; rotulo: string }[],
  agora: Date = new Date(),
): Promise<{ rotulo: string; medianaSeg: number | null; vendas: number }[]> {
  exigirPermissao(ator);
  if (semanas.length === 0) return [];
  const inicio = new Date(Math.min(...semanas.map((s) => s.inicio.getTime())));
  const fim = new Date(Math.max(...semanas.map((s) => s.fim.getTime())));
  const vendas = (await carregarVendasCs(inicio, fim, agora)) ?? [];
  return semanas.map((s) => {
    const daSemana = vendas.filter((v) => v.criadoEm >= s.inicio && v.criadoEm < s.fim);
    return { rotulo: s.rotulo, medianaSeg: medianaContatadas(daSemana), vendas: daSemana.length };
  });
}
