import { cn } from "@/lib/utils";
import { FIM_GRADE, INICIO_GRADE, raiasDoDia } from "../regras/disposicao";
import { diasDaSemana, faixasDaSemana } from "../regras/periodo";
import { Clicavel, FaixaItem, IconeItem, dicaDoItem, estiloDoItem, rotuloHora, type ItemAgenda } from "./item-agenda";
import { DIAS_SEMANA, paraFaixas } from "./visao-mes";

const HORAS = Array.from({ length: (FIM_GRADE - INICIO_GRADE) / 60 }, (_, i) => INICIO_GRADE / 60 + i);
const ALTURA_HORA = "3rem";

type Props = { data: string; itens: ItemAgenda[]; hoje: string };

/** Colunas por dia: os de dia inteiro (e os de vários dias) no topo; os com hora posicionados das 06:00 às 23:00. */
export function VisaoSemana({ data, itens, hoje }: Props) {
  const dias = diasDaSemana(data);
  const comHora = (i: ItemAgenda) => i.horaInicio !== null && i.inicio === i.fim;
  const topo = faixasDaSemana(dias, paraFaixas(itens.filter((i) => !comHora(i))));
  const linhasTopo = Math.max(1, ...topo.map((f) => f.linha + 1));
  const colunas = "grid-cols-[3rem_repeat(7,minmax(0,1fr))]";

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[44rem]">
        {/* Cabeçalho dos dias */}
        <div className={cn("bg-muted/40 grid border-b", colunas)}>
          <div />
          {dias.map((dia, i) => (
            <div key={dia} className="border-l px-2 py-1.5 text-center">
              <span className="text-muted-foreground block text-xs">{DIAS_SEMANA[i]}</span>
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                  dia === hoje && "bg-[#5F45F4] text-white",
                )}
              >
                {Number(dia.slice(8))}
              </span>
            </div>
          ))}
        </div>

        {/* Dia inteiro */}
        <div className={cn("grid gap-y-0.5 border-b py-1", colunas)} style={{ gridTemplateRows: `repeat(${linhasTopo}, 1.375rem)` }}>
          <div className="text-muted-foreground self-center pr-1 text-right text-[10px] leading-tight" style={{ gridColumn: 1, gridRow: "1 / -1" }}>
            Dia inteiro
          </div>
          {topo.map((f) => (
            <div key={f.item.id} className="min-w-0 px-0.5" style={{ gridColumn: `${f.coluna + 2} / span ${f.largura}`, gridRow: f.linha + 1 }}>
              <FaixaItem item={f.item.item} continuaAntes={f.continuaAntes} continuaDepois={f.continuaDepois} mostrarHora={false} />
            </div>
          ))}
        </div>

        {/* Grade de horas */}
        <div className={cn("grid", colunas)}>
          <div>
            {HORAS.map((h) => (
              <div key={h} className="text-muted-foreground relative pr-1 text-right text-[10px]" style={{ height: ALTURA_HORA }}>
                <span className="relative -top-1.5">{h === INICIO_GRADE / 60 ? "" : `${String(h).padStart(2, "0")}:00`}</span>
              </div>
            ))}
          </div>
          {dias.map((dia) => (
            <div
              key={dia}
              className={cn("relative border-l", dia === hoje && "bg-[#5F45F4]/5 dark:bg-[#5F45F4]/10")}
              style={{
                height: `calc(${ALTURA_HORA} * ${HORAS.length})`,
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${ALTURA_HORA} - 1px), var(--border) calc(${ALTURA_HORA} - 1px), var(--border) ${ALTURA_HORA})`,
              }}
            >
              {raiasDoDia(itens.filter((i) => comHora(i) && i.inicio === dia)).map(({ item, topo: t, altura, raia, raias }) => (
                <Clicavel
                  key={item.id}
                  href={item.href}
                  title={dicaDoItem(item)}
                  className={cn(
                    "absolute flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-xs leading-tight hover:brightness-95 dark:hover:brightness-125",
                    item.tipo === "pessoal" && "border-dashed",
                  )}
                  style={{
                    ...estiloDoItem(item),
                    top: `${t * 100}%`,
                    height: `${altura * 100}%`,
                    left: `calc(${(raia / raias) * 100}% + 1px)`,
                    width: `calc(${100 / raias}% - 3px)`,
                  }}
                >
                  <span className="flex items-center gap-1 truncate font-medium">
                    <IconeItem item={item} />
                    <span className="truncate">{item.titulo}</span>
                  </span>
                  <span className="text-muted-foreground truncate tabular-nums">{rotuloHora(item)}</span>
                </Clicavel>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
