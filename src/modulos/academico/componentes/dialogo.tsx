"use client";

import { PlusIcon } from "lucide-react";
import { createContext, useCallback, useState, type ReactNode } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";

/** Fecha o diálogo em volta; o FormularioAcao chama quando a ação dá certo. */
export const ContextoDialogo = createContext<(() => void) | undefined>(undefined);

export function Dialogo({
  rotuloBotao,
  titulo,
  descricao,
  children,
  variante = "default",
}: {
  rotuloBotao: string;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  variante?: "default" | "outline";
}) {
  const [aberto, setAberto] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant={variante}>
          {variante === "default" && <PlusIcon />}
          {rotuloBotao}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <ContextoDialogo.Provider value={fechar}>{children}</ContextoDialogo.Provider>
      </DialogContent>
    </Dialog>
  );
}
