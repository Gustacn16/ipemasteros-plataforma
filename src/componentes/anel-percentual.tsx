import { faixaDoPercentual } from "./regras-visuais";

const COR_FAIXA = {
  sucesso: "stroke-sucesso",
  atencao: "stroke-atencao",
  perigo: "stroke-perigo",
} as const;

type Faixa = "sucesso" | "atencao" | "perigo" | null;

/**
 * Anel de percentual. `faixa` troca as cores padrão (80/60, do relatório de tarefas)
 * por outra regra; `rotulo` é o que o leitor de tela diz depois do número.
 */
export function AnelPercentual({
  percentual,
  tamanho = 72,
  faixa: faixaDe = faixaDoPercentual,
  rotulo = "no prazo",
}: {
  percentual: number | null;
  tamanho?: number;
  faixa?: (p: number | null) => Faixa;
  rotulo?: string;
}) {
  const valido = percentual !== null && Number.isFinite(percentual);
  const arredondado = valido ? Math.round(percentual) : null;
  const faixa = faixaDe(arredondado);
  const espessura = Math.max(4, Math.round(tamanho / 9));
  const raio = (tamanho - espessura) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const preenchido = arredondado === null ? 0 : Math.min(100, Math.max(0, arredondado)) / 100;
  const centro = tamanho / 2;

  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${tamanho} ${tamanho}`}
      role="img"
      aria-label={arredondado === null ? `Sem dados (${rotulo})` : `${arredondado}% ${rotulo}`}
      className="shrink-0"
    >
      <circle cx={centro} cy={centro} r={raio} fill="none" strokeWidth={espessura} className="stroke-muted" />
      {faixa ? (
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          strokeWidth={espessura}
          strokeLinecap={preenchido === 0 ? "butt" : "round"}
          strokeDasharray={`${circunferencia * preenchido} ${circunferencia}`}
          transform={`rotate(-90 ${centro} ${centro})`}
          className={COR_FAIXA[faixa]}
        />
      ) : null}
      <text
        x={centro}
        y={centro}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground font-semibold tabular-nums"
        style={{ fontSize: tamanho * 0.26 }}
      >
        {arredondado === null ? "—" : `${arredondado}%`}
      </text>
    </svg>
  );
}
