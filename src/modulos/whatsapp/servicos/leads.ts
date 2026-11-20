import "server-only";
import type { SituacaoLead, TemperaturaLead } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { ERRO_LIMITE_MENSAL } from "./lote-ia";

const ESCOPO = "whatsapp:ver_equipe";
const TIMES_VENDAS = ["paciente_modelo", "comercial"] as const;

export type CriterioAvaliado = { chave: string; nota: number | null; frase: string };

export type ItemLead = {
  avaliacaoId: string;
  conversaId: string;
  contatoNome: string;
  numeroNome: string;
  /** Time do número quando a avaliação foi criada (define os rótulos dos critérios). */
  time: string;
  situacaoLead: SituacaoLead | null;
  temperatura: TemperaturaLead | null;
  motivoTemperatura: string | null;
  oQueRespondeu: string | null;
  proximoPasso: string | null;
  notaGeralDecimos: number | null;
  criterios: CriterioAvaliado[];
  pontosFortes: string | null;
  melhorar: string | null;
  venda: { produto: string; criadoEm: Date } | null;
};

const ORDEM_TEMPERATURA: Record<string, number> = { quente: 0, morno: 1, frio: 2 };

function lerCriterios(valor: unknown): CriterioAvaliado[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((c) => ({
    chave: String(c?.chave ?? ""),
    nota: typeof c?.nota === "number" ? c.nota : null,
    frase: typeof c?.frase === "string" ? c.frase : "",
  }));
}

/** Avaliações de vendas prontas do dia, quentes primeiro; mais os avisos de falha, falta de verba e pendência. */
export async function listarLeads(
  ator: UsuarioAtual,
  dia: Date,
  filtros: { temperatura?: TemperaturaLead; situacao?: SituacaoLead; numeroId?: string },
): Promise<{ itens: ItemLead[]; semVerba: number; falhas: number; pendentes: number; numeros: { id: string; nome: string }[] }> {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
  const base = { dia, time: { in: [...TIMES_VENDAS] } };

  const [linhas, semVerba, falhasTotal, pendentes, numeros] = await Promise.all([
    prisma.avaliacaoConversa.findMany({
      where: {
        ...base,
        situacao: "pronto",
        ...(filtros.temperatura ? { temperatura: filtros.temperatura } : {}),
        ...(filtros.situacao ? { situacaoLead: filtros.situacao } : {}),
        ...(filtros.numeroId ? { numeroId: filtros.numeroId } : {}),
      },
      select: {
        id: true,
        conversaId: true,
        time: true,
        situacaoLead: true,
        temperatura: true,
        motivoTemperatura: true,
        oQueRespondeu: true,
        proximoPasso: true,
        notaGeralDecimos: true,
        criterios: true,
        pontosFortes: true,
        melhorar: true,
        conversa: { select: { nome: true, contato: { select: { nomeExibido: true } } } },
        numero: { select: { nome: true } },
        venda: { select: { criadoEm: true, produto: { select: { nome: true } } } },
      },
    }),
    prisma.avaliacaoConversa.count({ where: { ...base, situacao: "falhou", erro: ERRO_LIMITE_MENSAL } }),
    prisma.avaliacaoConversa.count({ where: { ...base, situacao: "falhou" } }),
    prisma.avaliacaoConversa.count({ where: { ...base, situacao: "pendente" } }),
    prisma.numeroWhatsapp.findMany({
      where: { excluidoEm: null, time: { in: [...TIMES_VENDAS] } },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const itens: ItemLead[] = linhas.map((a) => ({
    avaliacaoId: a.id,
    conversaId: a.conversaId,
    contatoNome: a.conversa.contato?.nomeExibido || a.conversa.nome || "Sem nome",
    numeroNome: a.numero.nome,
    time: a.time,
    situacaoLead: a.situacaoLead,
    temperatura: a.temperatura,
    motivoTemperatura: a.motivoTemperatura,
    oQueRespondeu: a.oQueRespondeu,
    proximoPasso: a.proximoPasso,
    notaGeralDecimos: a.notaGeralDecimos,
    criterios: lerCriterios(a.criterios),
    pontosFortes: a.pontosFortes,
    melhorar: a.melhorar,
    venda: a.venda ? { produto: a.venda.produto.nome, criadoEm: a.venda.criadoEm } : null,
  }));
  itens.sort(
    (x, y) =>
      (ORDEM_TEMPERATURA[x.temperatura ?? ""] ?? 3) - (ORDEM_TEMPERATURA[y.temperatura ?? ""] ?? 3) ||
      (x.notaGeralDecimos ?? 101) - (y.notaGeralDecimos ?? 101),
  );
  return { itens, semVerba, falhas: falhasTotal - semVerba, pendentes, numeros };
}
