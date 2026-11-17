"use client";

import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/componentes/ui/button";
import type { ConversaNexu } from "./use-conversa-nexu";
import { CartaoProposta } from "./cartao-proposta";
import { MensagemNexu } from "./mensagem-nexu";

/** Lista de mensagens + campo de texto, compartilhados pelo painel e pela página. Enter envia; Shift+Enter quebra a linha. */
export function ConversaNexuView({ conversa, vazio }: { conversa: ConversaNexu; vazio?: string }) {
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const { mensagens, enviando, consultando, erro, enviar, atualizarProposta } = conversa;

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens, consultando, erro]);

  function submeter() {
    const t = texto.trim();
    if (!t || enviando) return;
    setTexto("");
    void enviar(t);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversa com o Nexu"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        {mensagens.length === 0 && (
          <p className="text-muted-foreground m-auto max-w-xs text-center text-sm">
            {vazio ?? "Pergunte sobre tarefas, agenda, alunos, conteúdo ou vendas."}
          </p>
        )}
        {mensagens.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-2">
            <MensagemNexu papel={m.papel} texto={m.texto} carregando={enviando && i === mensagens.length - 1 && !consultando} />
            {m.propostas?.map((p) => (
              <CartaoProposta key={p.id} proposta={p} aoAtualizar={atualizarProposta} bloqueado={enviando} />
            ))}
          </div>
        ))}
        {consultando && <p className="text-muted-foreground text-xs">{consultando}</p>}
        {erro && (
          <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
            {erro}
          </p>
        )}
        <div ref={fim} />
      </div>
      <form
        className="border-border flex items-end gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          submeter();
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submeter();
            }
          }}
          rows={2}
          maxLength={4000}
          aria-label="Pergunta para o Nexu"
          placeholder="Pergunte ao Nexu…"
          className="border-input bg-background focus-visible:ring-ring/50 focus-visible:border-ring max-h-40 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-3"
        />
        <Button type="submit" size="icon-lg" disabled={enviando || !texto.trim()} aria-label="Enviar pergunta">
          <SendIcon />
        </Button>
      </form>
    </div>
  );
}
