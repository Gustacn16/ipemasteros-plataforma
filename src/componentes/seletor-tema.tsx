"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";

const OPCOES = [
  { valor: "system", rotulo: "Automático", Icone: MonitorIcon },
  { valor: "light", rotulo: "Claro", Icone: SunIcon },
  { valor: "dark", rotulo: "Escuro", Icone: MoonIcon },
] as const;

/** Troca de tema (Automático, Claro, Escuro). Compacto: só o ícone (menu lateral recolhido). */
export function SeletorTema({ compacto }: { compacto: boolean }) {
  const { theme, setTheme } = useTheme();
  // O tema salvo só é conhecido no navegador: até montar, mostra "Automático" para não divergir do servidor.
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const atual = OPCOES.find((o) => o.valor === (montado ? theme : "system")) ?? OPCOES[0];
  const Icone = atual.Icone;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Mudar tema"
        title={compacto ? `Tema: ${atual.rotulo}` : undefined}
        className="hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground focus-visible:ring-sidebar-ring flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm outline-none focus-visible:ring-2"
      >
        <Icone className="size-5 shrink-0" />
        {!compacto && <span className="truncate whitespace-pre">Tema</span>}
      </DropdownMenuTrigger>
      {/* z acima do menu em tela cheia do celular (z-[100]). */}
      <DropdownMenuContent side="top" align="start" className="z-[110] w-44">
        <DropdownMenuRadioGroup value={montado ? theme : undefined} onValueChange={setTheme}>
          {OPCOES.map(({ valor, rotulo, Icone: IconeOpcao }) => (
            <DropdownMenuRadioItem key={valor} value={valor}>
              <IconeOpcao />
              {rotulo}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
