import { HistoryIcon } from "lucide-react";
import { formatarDataHora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { CLASSE_TITULO_SECAO } from "./exibicao";
import { descreverMudanca, type CampoHistorico, type ValorHistorico } from "../regras/historico";

type Linha = {
  id: string;
  campo: CampoHistorico;
  valorAntes: unknown;
  valorDepois: unknown;
  criadoEm: Date;
  usuario: { nome: string };
};

const valor = (v: unknown): ValorHistorico =>
  typeof v === "string" ? v : Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;

/** Histórico de alterações da tarefa, do mais recente para o mais antigo. */
export function HistoricoTarefa({ linhas, criadaPor, criadaEm }: { linhas: Linha[]; criadaPor: string; criadaEm: Date }) {
  return (
    <section className="grid gap-2" aria-labelledby="titulo-historico">
      <h3 id="titulo-historico" className={cn("flex items-center gap-1.5", CLASSE_TITULO_SECAO)}>
        <HistoryIcon className="size-3.5" aria-hidden /> Histórico
      </h3>
      <ol className="border-border grid gap-3 border-l-2 pl-4">
        {linhas.map((l) => (
          <li key={l.id} className="relative text-sm">
            <span aria-hidden className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary" />
            <span className="font-medium">{l.usuario.nome}</span>{" "}
            {descreverMudanca({ campo: l.campo, valorAntes: valor(l.valorAntes), valorDepois: valor(l.valorDepois) })}
            <span className="text-muted-foreground block text-xs">{formatarDataHora(l.criadoEm)}</span>
          </li>
        ))}
        <li className="relative text-sm">
          <span aria-hidden className="bg-muted-foreground/40 absolute top-1.5 -left-[1.3rem] size-2 rounded-full" />
          <span className="font-medium">{criadaPor}</span> criou a tarefa
          <span className="text-muted-foreground block text-xs">{formatarDataHora(criadaEm)}</span>
        </li>
      </ol>
    </section>
  );
}
