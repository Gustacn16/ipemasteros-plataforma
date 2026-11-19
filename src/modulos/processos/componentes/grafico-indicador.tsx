import { bateuMeta, formatarValor, rotuloCurto, type Frequencia, type Sentido } from "../regras/indicadores";

type Medicao = { periodo: string; valor: number; meta: number | null };

/** Barras dos últimos períodos com a linha da meta. Verde bateu, vermelho não, cinza sem meta. */
export function GraficoIndicador({
  medicoes,
  meta,
  sentido,
  frequencia,
  unidade,
}: {
  medicoes: Medicao[];
  meta: number | null;
  sentido: Sentido;
  frequencia: Frequencia;
  unidade: string;
}) {
  if (medicoes.length === 0) return null;
  const L = 320;
  const A = 120;
  const base = 18; // espaço para rótulos
  const valores = medicoes.flatMap((m) => [m.valor, m.meta ?? meta ?? 0]);
  const max = Math.max(...valores, 0) || 1;
  const min = Math.min(...valores, 0);
  const escala = (v: number) => A - base - ((v - min) / (max - min || 1)) * (A - base - 8);
  const largura = L / medicoes.length;
  const barra = Math.min(28, largura * 0.6);
  const linhaMeta = meta !== null ? escala(meta) : null;

  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="h-32 w-full" role="img" aria-label={`Últimos ${medicoes.length} resultados`}>
      <line x1="0" x2={L} y1={escala(0)} y2={escala(0)} className="stroke-border" strokeWidth="1" />
      {medicoes.map((m, k) => {
        const x = k * largura + (largura - barra) / 2;
        const y = escala(Math.max(m.valor, 0));
        const h = Math.abs(escala(m.valor) - escala(0)) || 1;
        const b = bateuMeta(m.valor, m.meta, sentido);
        const cor = b === null ? "fill-muted-foreground/40" : b ? "fill-sucesso" : "fill-perigo";
        return (
          <g key={m.periodo}>
            <rect x={x} y={m.valor >= 0 ? y : escala(0)} width={barra} height={h} rx="3" className={cor}>
              <title>{`${rotuloCurto(m.periodo, frequencia)}: ${formatarValor(m.valor, unidade)}`}</title>
            </rect>
            <text x={x + barra / 2} y={A - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
              {rotuloCurto(m.periodo, frequencia)}
            </text>
          </g>
        );
      })}
      {linhaMeta !== null && (
        <>
          <line x1="0" x2={L} y1={linhaMeta} y2={linhaMeta} className="stroke-primary" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={L - 2} y={linhaMeta - 4} textAnchor="end" className="fill-primary text-[9px] font-semibold">
            meta {formatarValor(meta!, unidade)}
          </text>
        </>
      )}
    </svg>
  );
}
