"use client";

import { ExternalLinkIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@/componentes/ui/button";
import { DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/componentes/ui/dialog";
import { ConversaNexuView } from "./conversa-nexu";
import { useConversaNexu } from "./use-conversa-nexu";

/**
 * Botão flutuante + painel lateral (tela cheia abaixo de `md`). Fica montado no layout, então a conversa
 * continua ao trocar de página. Na própria página /nexu não aparece.
 */
export function PainelNexu({ configurado, motivo }: { configurado: boolean; motivo?: string }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();
  const conversa = useConversaNexu(null);

  if (caminho === "/nexu" || caminho.startsWith("/nexu/")) return null;

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={setAberto}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir o Nexu"
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex size-12 items-center justify-center rounded-full shadow-lg outline-none hover:opacity-90 focus-visible:ring-3 md:right-6 md:bottom-6"
        >
          <SparklesIcon className="size-5" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby="nexu-descricao"
          className="bg-popover text-popover-foreground ring-foreground/10 fixed inset-0 z-50 flex flex-col outline-none md:inset-y-0 md:right-0 md:left-auto md:w-[440px] md:max-w-full md:ring-1"
        >
          <header className="border-border flex items-center gap-2 border-b p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <SparklesIcon className="text-primary size-5" aria-hidden />
            <DialogTitle className="flex-1 text-base">Nexu</DialogTitle>
            <DialogDescription id="nexu-descricao" className="sr-only">
              Assistente de IA do IPEMaster OS
            </DialogDescription>
            {configurado && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={conversa.nova}>
                  <PlusIcon /> Nova conversa
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={conversa.conversaId ? `/nexu/${conversa.conversaId}` : "/nexu"} onClick={() => setAberto(false)}>
                    <ExternalLinkIcon /> Abrir no Nexu
                  </Link>
                </Button>
              </>
            )}
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar o Nexu">
                <XIcon />
              </Button>
            </DialogPrimitive.Close>
          </header>
          {configurado ? (
            <ConversaNexuView conversa={conversa} />
          ) : (
            <div className="m-auto grid gap-1 p-6 text-center">
              <p className="font-medium">Nexu ainda não configurado</p>
              {motivo && <p className="text-muted-foreground text-sm">{motivo}</p>}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
