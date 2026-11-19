"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/componentes/ui/button";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { moverAreaAcao, moverCategoriaAcao } from "../acoes/processos";

/** Setas de subir/descer da ordem de uma categoria ou área. */
export function SetasOrdem({ id, tipo, primeiro, ultimo }: { id: string; tipo: "categoria" | "area"; primeiro: boolean; ultimo: boolean }) {
  const router = useRouter();
  const mover = async (para: "subir" | "descer") => {
    const r = await (tipo === "categoria" ? moverCategoriaAcao(id, para) : moverAreaAcao(id, para));
    if (!r.ok) avisar(r);
    router.refresh();
  };
  return (
    <span className="flex">
      <Button type="button" size="icon" variant="ghost" aria-label="Subir" disabled={primeiro} onClick={() => mover("subir")}>
        <ArrowUpIcon />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Descer" disabled={ultimo} onClick={() => mover("descer")}>
        <ArrowDownIcon />
      </Button>
    </span>
  );
}
