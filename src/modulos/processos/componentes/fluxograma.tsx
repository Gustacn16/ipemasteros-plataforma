import { CornerDownRightIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { destinoNao, destinoSim, type Etapa } from "../regras/fluxo";

// Fluxograma no estilo da referência: cartões numerados, setas, losango de
// decisão com Sim/Não e o resultado final em cartão escuro. No desktop as
// linhas andam em "zigue-zague" (3 por linha); no celular, uma coluna.

const POR_LINHA = 3;

function Numero({ n, invertido }: { n: number; invertido?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm",
        invertido ? "bg-primary text-primary-foreground ring-2 ring-white/15" : "bg-primary text-primary-foreground",
      )}
    >
      {n}
    </span>
  );
}

function Seta({ direcao }: { direcao: "direita" | "esquerda" }) {
  return (
    <svg aria-hidden viewBox="0 0 48 12" className="text-muted-foreground/70 h-3 w-12" style={direcao === "esquerda" ? { transform: "rotate(180deg)" } : undefined}>
      <line x1="0" y1="6" x2="40" y2="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M38 1 L47 6 L38 11 Z" fill="currentColor" />
    </svg>
  );
}

function SetaBaixo() {
  return (
    <svg aria-hidden viewBox="0 0 12 40" className="text-muted-foreground/70 h-10 w-3">
      <line x1="6" y1="0" x2="6" y2="31" stroke="currentColor" strokeWidth="1.6" />
      <path d="M1 29 L6 39 L11 29 Z" fill="currentColor" />
    </svg>
  );
}

function Desvios({ etapas, i }: { etapas: Etapa[]; i: number }) {
  const sim = destinoSim(etapas, i);
  const nao = destinoNao(etapas, i);
  const rotulo = (k: number | null) => (k === null ? "fim" : `${k + 1}. ${etapas[k]!.titulo}`);
  return (
    <div className="mt-2 grid w-full min-w-0 grid-cols-1 gap-1 text-xs">
      <span className="text-foreground flex min-w-0 items-center gap-1">
        <CornerDownRightIcon className="text-sucesso size-3.5 shrink-0" aria-hidden />
        <span className="font-semibold">Sim:</span> <span className="truncate">{sim === i + 1 ? "segue para a próxima" : rotulo(sim)}</span>
      </span>
      {nao !== null && (
        <span className="text-primary border-primary/50 flex min-w-0 items-center gap-1 rounded-md border border-dotted px-1.5 py-0.5">
          <CornerDownRightIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="font-semibold">Não:</span> <span className="truncate">{nao < i ? `volta para ${rotulo(nao)}` : rotulo(nao)}</span>
        </span>
      )}
    </div>
  );
}

function Cartao({ etapas, i }: { etapas: Etapa[]; i: number }) {
  const e = etapas[i]!;
  if (e.tipo === "decisao") {
    return (
      <div className="flex h-full min-w-0 flex-col items-center">
        <div className="relative flex min-h-36 w-full items-center justify-center px-12 py-8">
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <polygon points="50,2 98,50 50,98 2,50" className="fill-primary/8 stroke-primary" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="relative grid justify-items-center gap-1 text-center">
            <span className="text-primary text-[0.7rem] font-bold tracking-wider uppercase">{i + 1} · Decisão</span>
            <span className="text-primary text-[0.95rem] leading-snug font-bold">{e.titulo}</span>
          </div>
        </div>
        {e.descricao && <p className="text-muted-foreground mt-1 text-center text-xs">{e.descricao}</p>}
        <Desvios etapas={etapas} i={i} />
      </div>
    );
  }
  const fim = e.tipo === "fim";
  return (
    <div
      className={cn(
        "flex h-full gap-3 rounded-xl border p-4 shadow-sm",
        fim ? "border-transparent bg-[#111416] text-white dark:border-primary/60 dark:bg-primary/15" : "bg-card",
      )}
    >
      <Numero n={i + 1} invertido={fim} />
      <div className="grid min-w-0 content-start gap-1">
        <span className={cn("leading-snug font-semibold", fim ? "text-white" : "text-foreground")}>{e.titulo}</span>
        {e.descricao && <span className={cn("text-sm leading-snug", fim ? "text-white/75" : "text-muted-foreground")}>{e.descricao}</span>}
        {e.responsavel && (
          <span className={cn("mt-1 inline-flex items-center gap-1 text-xs", fim ? "text-white/70" : "text-muted-foreground")}>
            <UserIcon className="size-3" aria-hidden /> {e.responsavel}
          </span>
        )}
      </div>
    </div>
  );
}

export function Fluxograma({ etapas }: { etapas: Etapa[] }) {
  if (etapas.length === 0) return null;
  const linhas = Math.ceil(etapas.length / POR_LINHA);

  return (
    <figure aria-label="Fluxograma do processo" className="bg-muted/30 rounded-2xl border p-4 sm:p-6">
      {/* Celular e tablet: uma coluna */}
      <ol className="grid justify-items-stretch lg:hidden">
        {etapas.map((e, i) => (
          <li key={e.id} className="grid justify-items-center">
            <div className="w-full max-w-md">
              <Cartao etapas={etapas} i={i} />
            </div>
            {i < etapas.length - 1 && <SetaBaixo />}
          </li>
        ))}
      </ol>

      {/* Desktop: zigue-zague com 3 por linha */}
      <ol className="hidden grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch lg:grid">
        {Array.from({ length: linhas }, (_, r) => {
          const ida = r % 2 === 0;
          const itens = etapas.slice(r * POR_LINHA, r * POR_LINHA + POR_LINHA);
          const ultimaLinha = r === linhas - 1;
          return itens.flatMap((e, j) => {
            const i = r * POR_LINHA + j;
            const coluna = ida ? 1 + 2 * j : 5 - 2 * j;
            const nodes = [
              <li key={e.id} style={{ gridColumn: coluna, gridRow: 2 * r + 1 }} className="min-w-0">
                <Cartao etapas={etapas} i={i} />
              </li>,
            ];
            if (j < itens.length - 1) {
              nodes.push(
                <li key={`${e.id}-seta`} aria-hidden style={{ gridColumn: ida ? coluna + 1 : coluna - 1, gridRow: 2 * r + 1 }} className="flex items-center px-2">
                  <Seta direcao={ida ? "direita" : "esquerda"} />
                </li>,
              );
            } else if (!ultimaLinha) {
              nodes.push(
                <li key={`${e.id}-desce`} aria-hidden style={{ gridColumn: coluna, gridRow: 2 * r + 2 }} className="flex justify-center py-1">
                  <SetaBaixo />
                </li>,
              );
            }
            return nodes;
          });
        })}
      </ol>
    </figure>
  );
}
