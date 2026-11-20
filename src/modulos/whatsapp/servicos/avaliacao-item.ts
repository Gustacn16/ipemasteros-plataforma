import type { ItemLead } from "./leads";

export type CriterioAvaliado = ItemLead["criterios"][number];

/** Campos de AvaliacaoConversa que o cartão da avaliação precisa (usado por leads.ts e pela página da conversa). */
export const SELECT_AVALIACAO_ITEM = {
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
} as const;

function lerCriterios(valor: unknown): CriterioAvaliado[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((c) => ({
    chave: String(c?.chave ?? ""),
    nota: typeof c?.nota === "number" ? c.nota : null,
    frase: typeof c?.frase === "string" ? c.frase : "",
  }));
}

type LinhaAvaliacao = {
  id: string;
  conversaId: string;
  time: string;
  situacaoLead: ItemLead["situacaoLead"];
  temperatura: ItemLead["temperatura"];
  motivoTemperatura: string | null;
  oQueRespondeu: string | null;
  proximoPasso: string | null;
  notaGeralDecimos: number | null;
  criterios: unknown;
  pontosFortes: string | null;
  melhorar: string | null;
  conversa: { nome: string | null; contato: { nomeExibido: string | null } | null };
  numero: { nome: string };
  venda: { criadoEm: Date; produto: { nome: string } } | null;
};

export function paraItemLead(a: LinhaAvaliacao): ItemLead {
  return {
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
  };
}
