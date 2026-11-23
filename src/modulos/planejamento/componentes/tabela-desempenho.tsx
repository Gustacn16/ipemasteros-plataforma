import { cn } from "@/lib/utils";
import type { Status } from "../regras/desempenho";
import type { LinhaIndicador, Resumo } from "../servicos/visoes";
import { COR_STATUS, ROTULO_STATUS, SIMBOLO_STATUS, formatarPct, formatarValor, rotuloMesCurto } from "./formatar";

export function SeloStatus({ status, parcial }: { status: Status | null; parcial?: boolean }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-medium whitespace-nowrap", COR_STATUS[status])} title={ROTULO_STATUS[status]}>
      <span aria-hidden>{SIMBOLO_STATUS[status]}</span>
      <span className="sr-only">{ROTULO_STATUS[status]}</span>
      {parcial && <span className="text-muted-foreground text-[10px] font-normal">parcial</span>}
    </span>
  );
}

const th = "px-2 py-2 text-right font-normal";
const td = "px-2 py-2 text-right tabular-nums";

function Celulas({ r, unidade, parcial }: { r: Resumo; unidade: string; parcial?: boolean }) {
  return (
    <>
      <td className={td}>{formatarValor(unidade, r.meta)}</td>
      <td className={td}>{formatarValor(unidade, r.realizado)}</td>
      <td className={td}>{formatarPct(r.pct)}</td>
      <td className="px-2 py-2 text-center">
        <SeloStatus status={r.status} parcial={parcial && r.status !== null} />
      </td>
    </>
  );
}

/** Mês × acumulado, uma linha por indicador. */
export function TabelaDesempenho({ linhas, mostrarFrente = true }: { linhas: LinhaIndicador[]; mostrarFrente?: boolean }) {
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-xs">
            {mostrarFrente && <th className="px-3 py-2 text-left font-normal">Frente</th>}
            <th className="px-3 py-2 text-left font-normal">Indicador</th>
            <th className={th}>Meta do mês</th>
            <th className={th}>Realizado</th>
            <th className={th}>%</th>
            <th className="px-2 py-2 font-normal">Status</th>
            <th className={cn(th, "border-l")} title="Do 1º mês até o escolhido, sem o mês em andamento">Meta acumulada</th>
            <th className={th}>Real acumulado</th>
            <th className={th}>% acum.</th>
            <th className="px-2 py-2 font-normal">Status acum.</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              {mostrarFrente && <td className="text-primary px-3 py-2 font-medium capitalize">{l.frente}</td>}
              <td className="px-3 py-2">
                {l.nome}
                {l.sentido === "menor_melhor" && <span className="text-muted-foreground text-xs"> (↓ menor é melhor)</span>}
              </td>
              <Celulas r={l.mesEscolhido} unidade={l.unidade} parcial={l.mesEscolhido.parcial} />
              <td className={cn(td, "border-l")}>{formatarValor(l.unidade, l.acumulado.meta)}</td>
              <td className={td}>{formatarValor(l.unidade, l.acumulado.realizado)}</td>
              <td className={td}>{formatarPct(l.acumulado.pct)}</td>
              <td className="px-2 py-2 text-center">
                <SeloStatus status={l.acumulado.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Indicadores × 12 meses: realizado em cima, meta embaixo, com o status. */
export function GradeMensal({ linhas, meses, rodape }: { linhas: LinhaIndicador[]; meses: string[]; rodape?: React.ReactNode }) {
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[1000px] text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="px-3 py-2 text-left font-normal">Indicador</th>
            {meses.map((m) => (
              <th key={m} className="px-1.5 py-2 text-right font-normal capitalize">
                {rotuloMesCurto(m)}
              </th>
            ))}
            <th className="border-l px-2 py-2 text-right font-normal">Ano</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id} className="border-b align-top last:border-0">
              <td className="px-3 py-2 text-sm">
                {l.nome}
                <div className="text-muted-foreground">{l.automatico ? "automático" : "lançado"}</div>
              </td>
              {l.meses.map((c) => (
                <td key={c.mes} className="px-1.5 py-2 text-right tabular-nums">
                  <div className="flex items-center justify-end gap-1">
                    {c.comecou && <SeloStatus status={c.status} />}
                    <span>{c.comecou ? formatarValor(l.unidade, c.realizado) : ""}</span>
                  </div>
                  <div className="text-muted-foreground">{formatarValor(l.unidade, c.meta)}</div>
                </td>
              ))}
              <td className="border-l px-2 py-2 text-right tabular-nums">
                <div className="flex items-center justify-end gap-1">
                  <SeloStatus status={l.acumulado.status} />
                  {formatarValor(l.unidade, l.acumulado.realizado)}
                </div>
                <div className="text-muted-foreground">{formatarValor(l.unidade, l.acumulado.meta)}</div>
              </td>
            </tr>
          ))}
        </tbody>
        {rodape}
      </table>
      <p className="text-muted-foreground border-t px-3 py-2 text-xs">Em cada mês: realizado em cima, meta embaixo. ✔ ≥ 100% · ⚠ 80–99% · ✖ abaixo de 80%.</p>
    </div>
  );
}
