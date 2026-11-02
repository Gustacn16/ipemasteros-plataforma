import { cn } from "@/lib/utils";
import { DIAS_LISTA, agruparPorDia } from "../regras/disposicao";
import { Clicavel, IconeItem, rotuloHora, type ItemAgenda } from "./item-agenda";

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
function rotuloDia(dia: string): string {
  const texto = formatoDia.format(new Date(`${dia}T00:00:00Z`)).replace(/\./g, "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
const curto = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;

function rotuloQuando(item: ItemAgenda): string {
  if (item.inicio === item.fim) return rotuloHora(item);
  const de = item.horaInicio ? `${curto(item.inicio)} ${item.horaInicio}` : curto(item.inicio);
  const ate = item.horaFim ? `${curto(item.fim)} ${item.horaFim}` : curto(item.fim);
  return `${de} a ${ate}`;
}

type Props = { data: string; itens: ItemAgenda[]; hoje: string };

/** Próximos 60 dias a partir de `data`, agrupados por dia. Dias vazios ficam de fora. */
export function VisaoLista({ data, itens, hoje }: Props) {
  const grupos = agruparPorDia(itens, data, DIAS_LISTA);
  if (grupos.length === 0) {
    return <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">Nada marcado nestes 60 dias.</p>;
  }

  return (
    <div className="grid gap-5">
      {grupos.map(({ dia, itens: doDia }) => (
        <section key={dia} aria-labelledby={`dia-${dia}`} className="grid gap-2">
          <h2 id={`dia-${dia}`} className="flex items-center gap-2 text-sm font-semibold">
            {rotuloDia(dia)}
            {dia === hoje && <span className="rounded-full bg-[#5F45F4] px-2 py-0.5 text-[11px] font-medium text-white">Hoje</span>}
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border">
            {doDia.map((item) => (
              <li key={item.id}>
                <Clicavel href={item.href} className={cn("flex items-start gap-3 px-3 py-2.5", item.href && "hover:bg-muted/50")}>
                  {item.tipo === "pessoal" ? (
                    <span aria-hidden className="mt-1 h-8 w-0 shrink-0 border-l-[3px] border-dashed" style={{ borderColor: item.cor }} />
                  ) : (
                    <span aria-hidden className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                  )}
                  <span className="text-muted-foreground w-24 shrink-0 pt-0.5 text-xs tabular-nums sm:w-32">{rotuloQuando(item)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <IconeItem item={item} className="size-3.5" />
                      <span className="truncate">{item.titulo}</span>
                    </span>
                    {item.detalhe && <span className="text-muted-foreground block truncate text-xs">{item.detalhe}</span>}
                  </span>
                </Clicavel>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
