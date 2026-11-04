import Link from "next/link";
import { cn } from "@/lib/utils";
import { cobreDia } from "../regras/disposicao";
import { faixasDaSemana, gradeDoMes } from "../regras/periodo";
import { FaixaItem, type ItemAgenda } from "./item-agenda";

export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MAX_LINHAS = 3;

/** Envolve o item com uma chave que ordena: dia inteiro primeiro, depois pela hora. */
export function paraFaixas(itens: ItemAgenda[]) {
  return itens.map((item) => ({
    id: `${item.horaInicio === null ? 0 : 1}${item.horaInicio ?? ""}${item.titulo}\u0000${item.id}`,
    inicio: item.inicio,
    fim: item.fim,
    item,
  }));
}

type Props = { data: string; itens: ItemAgenda[]; hoje: string; hrefDia: (dia: string) => string };

/** Grade de domingo a sábado. Vários dias viram faixa contínua; cada dia mostra até 3 linhas e "+N". */
export function VisaoMes({ data, itens, hoje, hrefDia }: Props) {
  const mes = data.slice(0, 7);
  const envoltos = paraFaixas(itens);

  return (
    <div className="bg-card min-w-0 overflow-hidden rounded-xl border">
      <div className="bg-muted/40 grid grid-cols-7 border-b">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-muted-foreground px-1 py-1.5 text-center text-xs font-medium sm:px-2 sm:text-left">
            {d}
          </div>
        ))}
      </div>
      {gradeDoMes(mes).map((semana) => {
        const dias = semana.map((d) => d.dia);
        const faixas = faixasDaSemana(dias, envoltos);
        const ocultos = dias.map((dia) => faixas.filter((f) => f.linha >= MAX_LINHAS && cobreDia(f.item, dia)).length);
        return (
          <div
            key={dias[0]}
            className="grid grid-cols-7 gap-y-0.5 border-b pb-1 last:border-b-0"
            style={{ gridTemplateRows: `auto repeat(${MAX_LINHAS}, 1.375rem) 1.125rem` }}
          >
            {semana.map(({ dia, doMes }, i) => (
              <div
                key={`fundo-${dia}`}
                aria-hidden
                className={cn("border-r last:border-r-0", !doMes && "bg-muted/30", dia === hoje && "bg-primary/5")}
                style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
              />
            ))}
            {semana.map(({ dia, doMes }, i) => (
              <div key={`num-${dia}`} className="relative px-1 pt-1 sm:px-1.5" style={{ gridColumn: i + 1, gridRow: 1 }}>
                <Link
                  href={hrefDia(dia)}
                  aria-label={`Ver ${dia.split("-").reverse().join("/")}`}
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs hover:bg-muted",
                    !doMes && "text-muted-foreground",
                    dia === hoje && "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
                  )}
                >
                  {Number(dia.slice(8))}
                </Link>
              </div>
            ))}
            {faixas
              .filter((f) => f.linha < MAX_LINHAS)
              .map((f) => (
                <div
                  key={f.item.id}
                  className="relative min-w-0 px-0.5"
                  style={{ gridColumn: `${f.coluna + 1} / span ${f.largura}`, gridRow: f.linha + 2 }}
                >
                  <FaixaItem
                    item={f.item.item}
                    continuaAntes={f.continuaAntes}
                    continuaDepois={f.continuaDepois}
                    mostrarHora={f.item.inicio === f.item.fim}
                  />
                </div>
              ))}
            {ocultos.map((n, i) =>
              n > 0 ? (
                <div key={`mais-${dias[i]}`} className="relative min-w-0 px-1" style={{ gridColumn: i + 1, gridRow: MAX_LINHAS + 2 }}>
                  <Link href={hrefDia(dias[i])} className="text-muted-foreground hover:text-foreground block truncate text-[11px] font-medium sm:text-xs">
                    +{n}
                  </Link>
                </div>
              ) : null,
            )}
          </div>
        );
      })}
    </div>
  );
}
