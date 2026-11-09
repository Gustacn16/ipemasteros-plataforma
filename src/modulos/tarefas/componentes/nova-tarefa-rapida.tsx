"use client";

import { ListTreeIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { criarTarefaAcao } from "../acoes/tarefas";
import { avisar } from "./avisar";

const MAXIMO_SUBTAREFAS = 50;

type Linha = { chave: number; titulo: string };

/** Criação rápida: título e, se quiser, as subtarefas; o resto se preenche no detalhe. */
export function NovaTarefaRapida({ listaId, tarefaPaiId, rotulo = "Nova tarefa" }: { listaId: string; tarefaPaiId?: string; rotulo?: string }) {
  const campo = useRef<HTMLInputElement>(null);
  const linhasRef = useRef<Map<number, HTMLInputElement>>(new Map());
  const proximaChave = useRef(0);
  const [pendente, iniciar] = useTransition();
  // null = bloco de subtarefas fechado. Subtarefa não tem subtarefas, então o bloco só existe na tarefa principal.
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const aceitaSubtarefas = !tarefaPaiId;

  const focar = (chave: number) => requestAnimationFrame(() => linhasRef.current.get(chave)?.focus());

  function adicionarLinha(depoisDe?: number) {
    if ((linhas?.length ?? 0) >= MAXIMO_SUBTAREFAS) return;
    const linha = { chave: proximaChave.current++, titulo: "" };
    setLinhas((atual) => {
      const lista = atual ?? [];
      const i = depoisDe === undefined ? lista.length : lista.findIndex((l) => l.chave === depoisDe) + 1;
      return [...lista.slice(0, i), linha, ...lista.slice(i)];
    });
    focar(linha.chave);
  }

  function removerLinha(chave: number) {
    setLinhas((atual) => {
      const resto = (atual ?? []).filter((l) => l.chave !== chave);
      return resto.length ? resto : null;
    });
  }

  function criar(formData: FormData) {
    const titulo = String(formData.get("titulo") ?? "");
    const subtarefas = (linhas ?? []).map((l) => l.titulo);
    iniciar(async () => {
      const r = await criarTarefaAcao({ listaId, titulo, tarefaPaiId, ...(aceitaSubtarefas ? { subtarefas } : {}) });
      const erroDeCampo = r.ok ? undefined : (r.erros?.titulo?.[0] ?? r.erros?.subtarefas?.[0]);
      if (erroDeCampo) {
        avisar({ ok: false, mensagem: erroDeCampo });
        return;
      }
      if (avisar(r) && campo.current) {
        campo.current.value = "";
        setLinhas(null);
        campo.current.focus();
      }
    });
  }

  return (
    <form action={criar} className="grid w-full max-w-md gap-2">
      <div className="flex gap-2">
        <Input ref={campo} name="titulo" placeholder={`${rotulo}…`} aria-label={rotulo} maxLength={200} required autoComplete="off" />
        <Button type="submit" disabled={pendente} className="shrink-0">
          <PlusIcon /> Adicionar
        </Button>
      </div>

      {aceitaSubtarefas && linhas && (
        <ul className="grid gap-1.5 border-l-2 pl-3" aria-label="Subtarefas da nova tarefa">
          {linhas.map((linha, i) => (
            <li key={linha.chave} className="flex gap-1.5">
              <Input
                ref={(el) => {
                  if (el) linhasRef.current.set(linha.chave, el);
                  else linhasRef.current.delete(linha.chave);
                }}
                value={linha.titulo}
                onChange={(e) => setLinhas((atual) => (atual ?? []).map((l) => (l.chave === linha.chave ? { ...l, titulo: e.target.value } : l)))}
                onKeyDown={(e) => {
                  // Enter numa subtarefa abre a próxima em vez de enviar o formulário.
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    adicionarLinha(linha.chave);
                  }
                }}
                placeholder={`Subtarefa ${i + 1}…`}
                aria-label={`Subtarefa ${i + 1}`}
                maxLength={200}
                autoComplete="off"
                className="h-8"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label={`Remover subtarefa ${i + 1}`}
                onClick={() => removerLinha(linha.chave)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {aceitaSubtarefas && (linhas?.length ?? 0) < MAXIMO_SUBTAREFAS && (
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground justify-self-start" onClick={() => adicionarLinha()}>
          <ListTreeIcon /> {linhas ? "Mais uma subtarefa" : "Adicionar subtarefas"}
        </Button>
      )}
    </form>
  );
}
