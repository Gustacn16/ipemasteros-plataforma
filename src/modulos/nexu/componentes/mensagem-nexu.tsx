"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "cn";

/** Resposta do Nexu em markdown simples. Sem HTML: o texto bruto nunca vira tag (não há rehype-raw). */
function Markdown_({ texto }: { texto: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (p) => <p className="my-2 first:mt-0 last:mb-0" {...clean(p)} />,
        ul: (p) => <ul className="my-2 list-disc pl-5" {...clean(p)} />,
        ol: (p) => <ol className="my-2 list-decimal pl-5" {...clean(p)} />,
        a: (p) => <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...clean(p)} />,
        h1: (p) => <p className="my-2 font-semibold" {...clean(p)} />,
        h2: (p) => <p className="my-2 font-semibold" {...clean(p)} />,
        h3: (p) => <p className="my-2 font-semibold" {...clean(p)} />,
        code: (p) => <code className="bg-background rounded px-1 py-0.5 text-[0.85em]" {...clean(p)} />,
        table: (p) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs" {...clean(p)} />
          </div>
        ),
        th: (p) => <th className="border-border border px-2 py-1 text-left font-medium" {...clean(p)} />,
        td: (p) => <td className="border-border border px-2 py-1" {...clean(p)} />,
      }}
    >
      {texto}
    </Markdown>
  );
}

// react-markdown passa `node` para os componentes; não pode ir para o DOM.
function clean<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
  const { node, ...resto } = props;
  void node;
  return resto;
}

export function MensagemNexu({
  papel,
  texto,
  carregando = false,
}: {
  papel: "usuario" | "assistente";
  texto: string;
  carregando?: boolean;
}) {
  const dela = papel === "usuario";
  if (!texto && !carregando) return null;
  return (
    <div className={cn("flex", dela ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm break-words",
          dela ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-muted text-foreground",
        )}
      >
        {dela ? texto : texto ? <Markdown_ texto={texto} /> : <span className="text-muted-foreground">Pensando…</span>}
      </div>
    </div>
  );
}
