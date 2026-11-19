import { ArrowRightIcon, CalendarClockIcon, TargetIcon, UserRoundIcon } from "lucide-react";
import type { DocumentoLeitura } from "../servicos/documentos";

function Bloco({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="bg-card grid content-start gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground text-[0.7rem] font-semibold tracking-wider uppercase">{rotulo}</span>
      <span className={valor ? "text-foreground text-sm whitespace-pre-line" : "text-muted-foreground text-sm italic"}>{valor ?? "Não definido"}</span>
    </div>
  );
}

/** Ficha do padrão (Falconi / SIPOC): objetivo, dono, frequência e a cadeia fornecedor → cliente. */
export function FichaProcesso({ doc }: { doc: Pick<DocumentoLeitura, "objetivo" | "donoNome" | "frequencia" | "fornecedores" | "entradas" | "saidas" | "clientes"> }) {
  return (
    <section aria-label="Ficha do processo" className="grid gap-3">
      <div className="border-primary/30 bg-primary/5 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto]">
        <div className="flex gap-3">
          <TargetIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="grid gap-0.5">
            <span className="text-primary text-[0.7rem] font-semibold tracking-wider uppercase">Objetivo</span>
            <p className={doc.objetivo ? "text-foreground text-sm whitespace-pre-line" : "text-muted-foreground text-sm italic"}>{doc.objetivo ?? "Defina para que este processo existe."}</p>
          </div>
        </div>
        <div className="grid content-start gap-2 text-sm sm:min-w-52">
          <span className="flex items-center gap-2">
            <UserRoundIcon className="text-muted-foreground size-4" aria-hidden />
            <span className="text-muted-foreground">Dono:</span> <span className="font-medium">{doc.donoNome ?? "—"}</span>
          </span>
          <span className="flex items-center gap-2">
            <CalendarClockIcon className="text-muted-foreground size-4" aria-hidden />
            <span className="text-muted-foreground">Quando:</span> <span className="font-medium">{doc.frequencia ?? "—"}</span>
          </span>
        </div>
      </div>
      <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        <Bloco rotulo="Fornecedores" valor={doc.fornecedores} />
        <ArrowRightIcon className="text-muted-foreground/60 hidden size-4 self-center md:block" aria-hidden />
        <Bloco rotulo="Entradas" valor={doc.entradas} />
        <ArrowRightIcon className="text-muted-foreground/60 hidden size-4 self-center md:block" aria-hidden />
        <Bloco rotulo="Saídas" valor={doc.saidas} />
        <ArrowRightIcon className="text-muted-foreground/60 hidden size-4 self-center md:block" aria-hidden />
        <Bloco rotulo="Clientes" valor={doc.clientes} />
      </div>
    </section>
  );
}
