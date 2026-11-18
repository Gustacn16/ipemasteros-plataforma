"use client";

import { MarkdownSeguro } from "@/modulos/nexu/componentes/mensagem-nexu";

export function Analise({ texto }: { texto: string | null }) {
  if (!texto) return <p className="text-muted-foreground text-sm">Ainda sem análise nesta semana.</p>;
  return (
    <div className="text-sm leading-relaxed">
      <MarkdownSeguro texto={texto} />
    </div>
  );
}
