"use client";

import { ShareIcon, SmartphoneIcon, SquarePlusIcon } from "lucide-react";
import { useInstalacao } from "@/componentes/use-instalacao";
import { TextoBarra, useBarraLateral } from "@/componentes/ui/barra-lateral";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/componentes/ui/dialog";

const ROTULO = "Instalar no celular";

/**
 * Atalho do menu para pôr o sistema na tela de início como aplicativo. Some
 * quando já está aberto como app. No Android e no Chrome do computador abre a
 * instalação do próprio navegador; nos outros casos chama `aoPedirAjuda`, que
 * abre a <AjudaInstalacao> (fica fora do menu, porque o menu do celular é
 * desmontado ao fechar).
 */
export function AtalhoInstalar({ aoPedirAjuda }: { aoPedirAjuda: () => void }) {
  const { situacao, instalarNativo } = useInstalacao();
  const { aberta, fecharMovel } = useBarraLateral();

  if (situacao === "instalado") return null;

  function aoClicar() {
    if (situacao === "nativo") {
      void instalarNativo();
      return;
    }
    // No celular o menu ocupa a tela toda e ficaria por cima da janela de ajuda.
    fecharMovel();
    aoPedirAjuda();
  }

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={aberta ? undefined : ROTULO}
      title={aberta ? undefined : ROTULO}
      className="hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm outline-none focus-visible:ring-2"
    >
      <SmartphoneIcon className="size-5 shrink-0" />
      <TextoBarra>{ROTULO}</TextoBarra>
    </button>
  );
}

/** Janela com o passo a passo (iPhone, ou instruções gerais). */
export function AjudaInstalacao({ aberta, aoMudar }: { aberta: boolean; aoMudar: (aberta: boolean) => void }) {
  const { situacao } = useInstalacao();
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usar como aplicativo</DialogTitle>
          <DialogDescription>
            O IPEMaster OS ganha um ícone na tela de início e abre em tela cheia, sem a barra do navegador.
          </DialogDescription>
        </DialogHeader>
        {situacao === "iphone" ? <PassosIphone /> : <PassosOutros />}
      </DialogContent>
    </Dialog>
  );
}

function Passo({ numero, children }: { numero: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {numero}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}

const icone = "mx-0.5 inline size-4 -translate-y-px align-middle";

function PassosIphone() {
  return (
    <div className="grid gap-4">
      <ol className="grid gap-3">
        <Passo numero={1}>
          Toque em <strong>Compartilhar</strong> <ShareIcon className={icone} aria-hidden /> (no Safari fica na barra de
          baixo; no Chrome, no alto à direita).
        </Passo>
        <Passo numero={2}>
          Role a lista e toque em <strong>Adicionar à Tela de Início</strong>{" "}
          <SquarePlusIcon className={icone} aria-hidden />.
        </Passo>
        <Passo numero={3}>
          Toque em <strong>Adicionar</strong>. Depois é só abrir pelo ícone <strong>IPEMaster</strong>.
        </Passo>
      </ol>
      <p className="text-muted-foreground text-xs">
        No primeiro acesso pelo ícone, entre com seu e-mail e senha de novo: o aplicativo guarda o login separado do
        Safari.
      </p>
    </div>
  );
}

function PassosOutros() {
  return (
    <ol className="grid gap-3">
      <Passo numero={1}>
        Abra o sistema no celular: <strong>Safari</strong> no iPhone ou <strong>Chrome</strong> no Android.
      </Passo>
      <Passo numero={2}>
        Abra o menu do sistema e toque em <strong>{ROTULO}</strong>, ou use o menu do navegador:{" "}
        <strong>Adicionar à tela inicial</strong>.
      </Passo>
    </ol>
  );
}
