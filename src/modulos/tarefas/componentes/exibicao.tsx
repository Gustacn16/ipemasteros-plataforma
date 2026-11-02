import { cn } from "@/lib/utils";
import { ROTULO_PRIORIDADE, type Prioridade } from "../esquemas/tarefa";
import { diaDaDataEntrega, diaEmSaoPaulo, estaAtrasada } from "../regras/prazo";

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const formatoDiaAno = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Data de uma coluna @db.Date ("27/11", com ano se não for o ano atual). */
export function formatarDiaEntrega(data: Date): string {
  const mesmoAno = diaDaDataEntrega(data).slice(0, 4) === diaEmSaoPaulo(new Date()).slice(0, 4);
  return (mesmoAno ? formatoDia : formatoDiaAno).format(data);
}

/** Valor para <input type="date">. */
export function valorInputData(data: Date | null): string {
  return data ? diaDaDataEntrega(data) : "";
}

export function DataEntrega({ data, concluidaEm }: { data: Date | null; concluidaEm?: Date | null }) {
  if (!data) return <span className="text-muted-foreground">—</span>;
  const atrasada = estaAtrasada(data, concluidaEm ?? null, new Date());
  return (
    <span className={cn("whitespace-nowrap", atrasada && "font-medium text-red-600")}>
      {formatarDiaEntrega(data)}
      {atrasada && <span className="sr-only"> (atrasada)</span>}
    </span>
  );
}

const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: "bg-red-100 text-red-700",
  alta: "bg-orange-100 text-orange-700",
  normal: "bg-neutral-100 text-neutral-600",
  baixa: "bg-sky-50 text-sky-700",
};

export function BadgePrioridade({ prioridade }: { prioridade: Prioridade }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", COR_PRIORIDADE[prioridade])}>
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

export function PontoCor({ cor, className }: { cor: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-full", className)} style={{ backgroundColor: cor }} />;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

export function Avatares({ pessoas }: { pessoas: { id: string; nome: string; imagem?: string | null }[] }) {
  if (pessoas.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex -space-x-1.5" title={pessoas.map((p) => p.nome).join(", ")}>
      {pessoas.slice(0, 3).map((p) =>
        p.imagem ? (
          // Foto servida por rota protegida; não passa pelo otimizador de imagens.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.imagem} alt="" draggable={false} className="size-6 rounded-full object-cover ring-2 ring-white" />
        ) : (
          <span
            key={p.id}
            className="flex size-6 items-center justify-center rounded-full bg-[#ece9fe] text-[10px] font-semibold text-[#3f2bb8] ring-2 ring-white"
          >
            {iniciais(p.nome)}
          </span>
        ),
      )}
      {pessoas.length > 3 && (
        <span className="flex size-6 items-center justify-center rounded-full bg-neutral-200 text-[10px] ring-2 ring-white">
          +{pessoas.length - 3}
        </span>
      )}
      <span className="sr-only">{pessoas.map((p) => p.nome).join(", ")}</span>
    </span>
  );
}
