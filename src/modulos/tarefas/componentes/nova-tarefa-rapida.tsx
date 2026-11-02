"use client";

import { PlusIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { criarTarefaAcao } from "../acoes/tarefas";
import { avisar } from "./avisar";

/** Criação rápida: só o título; o resto se preenche no detalhe. */
export function NovaTarefaRapida({ listaId, tarefaPaiId, rotulo = "Nova tarefa" }: { listaId: string; tarefaPaiId?: string; rotulo?: string }) {
  const campo = useRef<HTMLInputElement>(null);
  const [pendente, iniciar] = useTransition();

  function criar(formData: FormData) {
    const titulo = String(formData.get("titulo") ?? "");
    iniciar(async () => {
      const r = await criarTarefaAcao({ listaId, titulo, tarefaPaiId });
      if (!r.ok && r.erros?.titulo) {
        avisar({ ok: false, mensagem: r.erros.titulo[0] });
        return;
      }
      if (avisar(r) && campo.current) {
        campo.current.value = "";
        campo.current.focus();
      }
    });
  }

  return (
    <form action={criar} className="flex w-full max-w-md gap-2">
      <Input ref={campo} name="titulo" placeholder={`${rotulo}…`} aria-label={rotulo} maxLength={200} required autoComplete="off" />
      <Button type="submit" disabled={pendente} className="shrink-0">
        <PlusIcon /> Adicionar
      </Button>
    </form>
  );
}
