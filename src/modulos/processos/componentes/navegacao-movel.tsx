"use client";

import { ListTreeIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import type { CategoriaNaArvore } from "../servicos/estrutura";
import { ArvoreProcessos } from "./arvore";

/** No celular, a árvore abre numa janela e fecha ao escolher um documento. */
export function NavegacaoMovel({ categorias }: { categorias: CategoriaNaArvore[] }) {
  const [aberta, setAberta] = useState(false);
  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start lg:hidden">
          <ListTreeIcon /> Navegar pelos documentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Documentos</DialogTitle>
        </DialogHeader>
        <ArvoreProcessos categorias={categorias} aoNavegar={() => setAberta(false)} />
      </DialogContent>
    </Dialog>
  );
}
