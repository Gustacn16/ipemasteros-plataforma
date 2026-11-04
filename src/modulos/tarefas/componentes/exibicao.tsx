import { FlagIcon } from "lucide-react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import type { Tom } from "@/componentes/regras-visuais";
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
    <span className={cn("whitespace-nowrap", atrasada && "text-perigo font-medium")}>
      {formatarDiaEntrega(data)}
      {atrasada && <span className="sr-only"> (atrasada)</span>}
    </span>
  );
}

/** Tom do chip de prioridade (spec, seção 5). */
export const TOM_PRIORIDADE: Record<Prioridade, Tom> = {
  urgente: "perigo",
  alta: "atencao",
  normal: "neutro",
  baixa: "neutro",
};

export function ChipPrioridade({ prioridade, tamanho = "sm" }: { prioridade: Prioridade; tamanho?: "sm" | "md" }) {
  return (
    <ChipSituacao tom={TOM_PRIORIDADE[prioridade]} icone={FlagIcon} tamanho={tamanho}>
      {ROTULO_PRIORIDADE[prioridade]}
    </ChipSituacao>
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
    <span className="flex shrink-0 -space-x-1.5" title={pessoas.map((p) => p.nome).join(", ")}>
      {pessoas.slice(0, 3).map((p) =>
        p.imagem ? (
          // Foto servida por rota protegida; não passa pelo otimizador de imagens.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.imagem} alt="" draggable={false} className="ring-card size-6 rounded-full object-cover ring-2" />
        ) : (
          <span
            key={p.id}
            className="bg-muted text-informacao ring-card flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ring-2"
          >
            {iniciais(p.nome)}
          </span>
        ),
      )}
      {pessoas.length > 3 && (
        <span className="bg-muted text-muted-foreground ring-card flex size-6 items-center justify-center rounded-full text-[10px] tabular-nums ring-2">
          +{pessoas.length - 3}
        </span>
      )}
      <span className="sr-only">{pessoas.map((p) => p.nome).join(", ")}</span>
    </span>
  );
}

/** Título discreto das seções do painel da tarefa. */
export const CLASSE_TITULO_SECAO = "text-muted-foreground text-xs font-semibold tracking-wide uppercase";
