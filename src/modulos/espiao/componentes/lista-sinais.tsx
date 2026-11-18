import Link from "next/link";
import { Badge } from "@/componentes/ui/badge";
import type { SinalTela } from "../servicos/visao";
import { ROTULO_SINAL, dataCurta } from "./rotulos";

function Detalhe({ s }: { s: SinalTela }) {
  const d = s.detalhe;
  if (s.tipo === "preco_mudou" && Array.isArray(d.antes) && Array.isArray(d.depois))
    return <span className="text-muted-foreground">{(d.antes as string[]).join(", ") || "sem preço"} → {(d.depois as string[]).join(", ") || "sem preço"}</span>;
  if (s.tipo === "conteudo_destaque" && typeof d.resumo === "string") return <span className="text-muted-foreground">“{d.resumo}”</span>;
  return null;
}

export function ListaSinais({ sinais, comConcorrente = true }: { sinais: SinalTela[]; comConcorrente?: boolean }) {
  if (sinais.length === 0) return <p className="text-muted-foreground text-sm">Nenhum sinal neste período.</p>;
  return (
    <ul className="grid gap-3">
      {sinais.map((s) => (
        <li key={s.id} className="grid gap-1 rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ROTULO_SINAL[s.tipo] ?? s.tipo}</Badge>
            {comConcorrente && (
              <Link href={`/espiao/${s.concorrenteId}`} className="font-medium underline-offset-2 hover:underline">
                {s.concorrente}
              </Link>
            )}
            <span className="text-muted-foreground ml-auto text-xs">{dataCurta(s.criadoEm)}</span>
          </div>
          <p>
            {s.titulo}{" "}
            {s.origemUrl && (
              <a href={s.origemUrl} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2">
                abrir
              </a>
            )}
          </p>
          <Detalhe s={s} />
        </li>
      ))}
    </ul>
  );
}
