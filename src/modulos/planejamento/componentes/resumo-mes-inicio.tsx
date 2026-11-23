import { ArrowRightIcon, BanknoteIcon, MegaphoneIcon, ShoppingBagIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Status } from "../regras/desempenho";
import type { ItemResumo, OrigemMeta } from "../regras/resumo-mes";
import type { ResumoDoInicio } from "../servicos/visoes";
import { formatarPct, formatarValor, ROTULO_STATUS, rotuloMesLongo, SIMBOLO_STATUS } from "./formatar";

const BARRA: Record<Status, string> = { ok: "bg-sucesso", atencao: "bg-atencao", ruim: "bg-perigo" };
const TEXTO: Record<Status, string> = { ok: "text-sucesso", atencao: "text-atencao", ruim: "text-perigo" };

function Numero({ rotulo, icone: Icone, unidade, item, origem, vazio }: { rotulo: string; icone: LucideIcon; unidade: "numero" | "reais"; item: ItemResumo; origem?: OrigemMeta; vazio?: boolean }) {
  const { status } = item;
  return (
    <div className="bg-card text-card-foreground flex min-w-0 flex-col gap-2 rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Icone className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{rotulo}</span>
        {status && (
          <span className={cn("ml-auto text-xs font-medium whitespace-nowrap", TEXTO[status])} title={ROTULO_STATUS[status]}>
            <span aria-hidden>{SIMBOLO_STATUS[status]} </span>
            {ROTULO_STATUS[status]}
          </span>
        )}
      </div>
      <span className="text-foreground text-3xl font-semibold tabular-nums">{vazio ? "—" : formatarValor(unidade, item.realizado)}</span>
      {item.pct !== null && item.esperadoPct !== null && status ? (
        <>
          <div
            className="bg-muted relative h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`${rotulo}: ${formatarPct(item.pct)} da meta`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(item.pct, 1) * 100)}
          >
            <div className={cn("h-full rounded-full", BARRA[status])} style={{ width: `${Math.min(item.pct, 1) * 100}%` }} />
            {/* Onde deveríamos estar hoje. */}
            <div className="bg-foreground/70 absolute top-0 h-full w-0.5" style={{ left: `calc(${item.esperadoPct * 100}% - 1px)` }} aria-hidden />
          </div>
          <div className="text-muted-foreground flex justify-between gap-2 text-xs tabular-nums">
            <span>
              {formatarPct(item.pct)} de {formatarValor(unidade, item.meta)}
              {origem === "planejamento" && " (Planejamento)"}
            </span>
            <span>esperado hoje {formatarPct(item.esperadoPct)}</span>
          </div>
        </>
      ) : (
        <span className="text-muted-foreground text-xs">Meta: —</span>
      )}
    </div>
  );
}

const SEM_DADO: ItemResumo = { realizado: 0, meta: null, pct: null, esperadoPct: null, status: null };

/** Bloco do Início: como está o mês em vendas, faturamento e leads. `resumo` nulo = não carregou. */
export function ResumoMesInicio({ mes, resumo }: { mes: string; resumo: ResumoDoInicio | null }) {
  const falhou = resumo === null;
  return (
    <section className="grid gap-3" aria-labelledby="resumo-mes-titulo">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="resumo-mes-titulo" className="text-base font-semibold">
          Resumo de {rotuloMesLongo(mes)}
        </h2>
        <Link href="/comercial" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
          Ver o dashboard comercial
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>
      {falhou && (
        <p className="text-atencao text-sm" role="status">
          Não deu para carregar os números do mês agora. Recarregue a página em instantes.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Numero rotulo="Vendas do mês" icone={ShoppingBagIcon} unidade="numero" item={resumo?.vendas ?? SEM_DADO} origem={resumo?.metaDe.vendas} vazio={falhou} />
        <Numero rotulo="Faturamento" icone={BanknoteIcon} unidade="reais" item={resumo?.faturamento ?? SEM_DADO} origem={resumo?.metaDe.faturamento} vazio={falhou} />
        <Numero rotulo="Leads gerados" icone={MegaphoneIcon} unidade="numero" item={resumo?.leads ?? SEM_DADO} origem={resumo?.metaDe.leads} vazio={falhou} />
      </div>
    </section>
  );
}
