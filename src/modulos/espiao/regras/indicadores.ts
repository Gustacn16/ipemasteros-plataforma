// Indicadores de um concorrente para a tabela e para a análise da IA.
import type { IndicadorConcorrente } from "./tipos";

const DIA_MS = 86_400_000;

export function calcularIndicadores(e: {
  concorrente: string;
  /** Mais recente primeiro. */
  fotos: { seguidores: number; capturadaEm: Date }[];
  midias: { publicadoEm: Date; curtidas: number | null; comentarios: number | null }[];
  destaques: string[];
  agora: Date;
}): IndicadorConcorrente {
  const atual = e.fotos[0] ?? null;
  const referencia = atual ? e.fotos.find((f) => atual.capturadaEm.getTime() - f.capturadaEm.getTime() >= 5 * DIA_MS) : undefined;
  const variacao = atual && referencia && referencia.seguidores > 0 ? (atual.seguidores - referencia.seguidores) / referencia.seguidores : null;
  const idade = (d: Date) => e.agora.getTime() - d.getTime();
  const ultimos28 = e.midias.filter((m) => idade(m.publicadoEm) >= 0 && idade(m.publicadoEm) < 28 * DIA_MS).length;
  const taxas =
    atual && atual.seguidores > 0
      ? e.midias
          .filter((m) => m.curtidas !== null && idade(m.publicadoEm) < 30 * DIA_MS)
          .map((m) => ((m.curtidas ?? 0) + (m.comentarios ?? 0)) / atual.seguidores)
      : [];
  return {
    concorrente: e.concorrente,
    seguidores: atual?.seguidores ?? null,
    variacaoSeguidores: variacao === null ? null : Math.round(variacao * 10_000) / 10_000,
    postsPorSemana: ultimos28 / 4,
    engajamentoMedio: taxas.length ? Math.round((taxas.reduce((a, b) => a + b, 0) / taxas.length) * 10_000) / 100 : null,
    destaques: e.destaques,
  };
}
