"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";
import { useOptimistic, useRef, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { cn } from "@/lib/utils";
import { adicionarItemChecklistAcao, atualizarItemChecklistAcao, moverItemChecklistAcao, removerItemChecklistAcao } from "../acoes/tarefas";
import { avisar } from "./avisar";

type Item = { id: string; texto: string; concluido: boolean };

/** Checklist da tarefa: marcar é instantâneo; adicionar, reordenar e remover salvam na hora. */
export function ChecklistTarefa({ tarefaId, itens }: { tarefaId: string; itens: Item[] }) {
  const [pendente, iniciar] = useTransition();
  const [lista, marcarOtimista] = useOptimistic(itens, (atual, { id, concluido }: { id: string; concluido: boolean }) =>
    atual.map((i) => (i.id === id ? { ...i, concluido } : i)),
  );
  const campo = useRef<HTMLInputElement>(null);
  const feitos = lista.filter((i) => i.concluido).length;

  const marcar = (item: Item, concluido: boolean) =>
    iniciar(async () => {
      marcarOtimista({ id: item.id, concluido });
      const r = await atualizarItemChecklistAcao({ itemId: item.id, concluido });
      if (!r.ok) avisar(r);
    });

  function adicionar(formData: FormData) {
    const texto = String(formData.get("texto") ?? "").trim();
    if (!texto) return;
    iniciar(async () => {
      if (avisar(await adicionarItemChecklistAcao({ tarefaId, texto }))) {
        if (campo.current) campo.current.value = "";
        campo.current?.focus();
      }
    });
  }

  return (
    <section className="grid gap-2" aria-labelledby="titulo-checklist">
      <div className="flex items-center justify-between">
        <h3 id="titulo-checklist" className="text-sm font-medium">
          Checklist
        </h3>
        {lista.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {feitos}/{lista.length} feitos
          </span>
        )}
      </div>
      {lista.length > 0 && (
        <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
          <div className="h-full rounded-full bg-[#5F45F4] transition-all" style={{ width: `${(feitos / lista.length) * 100}%` }} />
        </div>
      )}
      <ul className="grid">
        {lista.map((item, i) => (
          <li key={item.id} className="group hover:bg-muted/60 flex items-center gap-2 rounded-md px-1.5 py-1">
            <input
              type="checkbox"
              className="size-4 accent-[#5F45F4]"
              checked={item.concluido}
              onChange={(e) => marcar(item, e.target.checked)}
              aria-label={item.texto}
            />
            <span className={cn("flex-1 text-sm", item.concluido && "text-muted-foreground line-through")}>{item.texto}</span>
            <span className="flex opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
              <button
                type="button"
                aria-label="Subir item"
                disabled={pendente || i === 0}
                onClick={() => iniciar(async () => void avisar(await moverItemChecklistAcao({ itemId: item.id, direcao: "cima" })))}
                className="text-muted-foreground hover:text-foreground rounded p-1 disabled:opacity-30"
              >
                <ArrowUpIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Descer item"
                disabled={pendente || i === lista.length - 1}
                onClick={() => iniciar(async () => void avisar(await moverItemChecklistAcao({ itemId: item.id, direcao: "baixo" })))}
                className="text-muted-foreground hover:text-foreground rounded p-1 disabled:opacity-30"
              >
                <ArrowDownIcon className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Remover "${item.texto}"`}
                disabled={pendente}
                onClick={() => iniciar(async () => void avisar(await removerItemChecklistAcao(item.id)))}
                className="text-muted-foreground hover:text-destructive rounded p-1"
              >
                <XIcon className="size-3.5" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form action={adicionar} className="flex gap-2">
        <Input ref={campo} name="texto" placeholder="Adicionar item ao checklist" maxLength={200} aria-label="Novo item do checklist" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={pendente}>
          <PlusIcon /> Adicionar
        </Button>
      </form>
    </section>
  );
}
