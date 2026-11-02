"use client";

// Adaptado do Sidebar da Aceternity (21st.dev): no desktop a barra recolhida ocupa 60px
// no fluxo e, ao passar o mouse ou focar pelo teclado, abre POR CIMA do conteúdo, sem
// empurrar os menus internos dos módulos. No celular vira uma barra superior com menu
// em tela cheia (fecha no X, no Esc ou ao navegar).

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LARGURA_RECOLHIDA = 60;
const LARGURA_ABERTA = 248;

type Contexto = {
  /** No desktop: aberta pelo hover/foco. No celular: sempre true (rótulos visíveis). */
  aberta: boolean;
  fecharMovel: () => void;
};

const ContextoBarra = createContext<Contexto | undefined>(undefined);

export function useBarraLateral() {
  const contexto = useContext(ContextoBarra);
  if (!contexto) throw new Error("useBarraLateral precisa estar dentro de BarraLateral");
  return contexto;
}

type Props = {
  /** Topo: o logo recebe `aberta` para trocar símbolo/logo completo. */
  logo: (aberta: boolean) => React.ReactNode;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  rotulo?: string;
};

export function BarraLateral(props: Props) {
  return (
    <>
      <BarraDesktop {...props} />
      <BarraMovel {...props} />
    </>
  );
}

function BarraDesktop({ logo, children, rodape, rotulo = "Principal" }: Props) {
  const [aberta, setAberta] = useState(false);
  const semAnimacao = useReducedMotion();

  return (
    <ContextoBarra.Provider value={{ aberta, fecharMovel: () => {} }}>
      {/* Reserva a largura recolhida no fluxo da página. */}
      <div className="hidden shrink-0 md:block" style={{ width: LARGURA_RECOLHIDA }}>
        <motion.aside
          aria-label={rotulo}
          className="bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 flex flex-col gap-6 overflow-hidden border-r px-2.5 py-4 shadow-xl"
          initial={false}
          animate={{ width: aberta ? LARGURA_ABERTA : LARGURA_RECOLHIDA }}
          transition={{ duration: semAnimacao ? 0 : 0.2, ease: "easeOut" }}
          onMouseEnter={() => setAberta(true)}
          onMouseLeave={() => setAberta(false)}
          onFocus={() => setAberta(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberta(false);
          }}
        >
          <div className="flex h-14 shrink-0 items-center">{logo(aberta)}</div>
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">{children}</div>
          {rodape && <div className="border-sidebar-border shrink-0 border-t pt-3">{rodape}</div>}
        </motion.aside>
      </div>
    </ContextoBarra.Provider>
  );
}

function BarraMovel({ logo, children, rodape, rotulo = "Principal" }: Props) {
  const [aberta, setAberta] = useState(false);
  const semAnimacao = useReducedMotion();
  const fechar = () => setAberta(false);

  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberta]);

  return (
    <ContextoBarra.Provider value={{ aberta: true, fecharMovel: fechar }}>
      <div className="bg-sidebar text-sidebar-foreground sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:hidden">
        {logo(false)}
        <button
          type="button"
          aria-label="Abrir menu"
          aria-expanded={aberta}
          aria-controls="menu-movel"
          onClick={() => setAberta(true)}
          className="hover:bg-sidebar-accent rounded-md p-2"
        >
          <MenuIcon className="size-5" />
        </button>
      </div>
      <AnimatePresence>
        {aberta && (
          <motion.div
            id="menu-movel"
            role="dialog"
            aria-modal="true"
            aria-label={rotulo}
            initial={{ x: "-100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "-100%", opacity: 0 }}
            transition={{ duration: semAnimacao ? 0 : 0.25, ease: "easeInOut" }}
            className="bg-sidebar text-sidebar-foreground fixed inset-0 z-[100] flex flex-col gap-6 overflow-y-auto p-6 md:hidden"
          >
            <div className="flex items-center justify-between">
              {logo(true)}
              <button type="button" aria-label="Fechar menu" onClick={fechar} className="hover:bg-sidebar-accent rounded-md p-2">
                <XIcon className="size-5" />
              </button>
            </div>
            <div className="flex-1">{children}</div>
            {rodape && <div className="border-sidebar-border border-t pt-3">{rodape}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </ContextoBarra.Provider>
  );
}

/** Texto que só aparece com a barra aberta (some sem ocupar espaço quando recolhida). */
export function TextoBarra({ children, className }: { children: React.ReactNode; className?: string }) {
  const { aberta } = useBarraLateral();
  if (!aberta) return null;
  return <span className={cn("truncate whitespace-pre", className)}>{children}</span>;
}

type Item = {
  href: string;
  rotulo: string;
  icone: React.ReactNode;
  ativo?: boolean;
  emBreve?: boolean;
};

const estiloItem = "flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors";

export function ItemBarraLateral({ href, rotulo, icone, ativo, emBreve }: Item) {
  const { aberta, fecharMovel } = useBarraLateral();
  // Recolhida, só o ícone aparece: o nome vai para o leitor de tela e para a dica do mouse.
  const dica = aberta ? undefined : emBreve ? `${rotulo} (em breve)` : rotulo;

  if (emBreve) {
    return (
      <span aria-disabled="true" aria-label={dica} title={dica} className={cn(estiloItem, "text-sidebar-foreground/40 cursor-not-allowed")}>
        <span className="shrink-0 [&_svg]:size-5">{icone}</span>
        <TextoBarra className="flex-1">{rotulo}</TextoBarra>
        <TextoBarra className="rounded-full border border-current px-1.5 py-0.5 text-[10px] uppercase">em breve</TextoBarra>
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={fecharMovel}
      aria-current={ativo ? "page" : undefined}
      aria-label={dica}
      title={dica}
      className={cn(
        estiloItem,
        "group/item focus-visible:ring-sidebar-ring outline-none focus-visible:ring-2",
        ativo ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium" : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground",
      )}
    >
      <span className="shrink-0 [&_svg]:size-5">{icone}</span>
      <TextoBarra className="transition-transform duration-150 group-hover/item:translate-x-0.5">{rotulo}</TextoBarra>
    </Link>
  );
}
