"use client";

import { PencilIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { excluirListaAcao, renomearListaAcao } from "../acoes/estrutura";
import { avisar } from "./avisar";

type Lista = { id: string; nome: string };

/** Renomear e excluir a lista: no cabeçalho da página dela e no lápis do menu de Tarefas. */
export function EditarLista({ lista, totalTarefas, gatilho }: { lista: Lista; totalTarefas: number | null; gatilho?: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {gatilho ?? (
          <Button variant="outline" size="sm">
            <PencilIcon /> Editar lista
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar lista</DialogTitle>
          <DialogDescription>Mude o nome ou exclua a lista.</DialogDescription>
        </DialogHeader>
        {aberto && <Formulario lista={lista} totalTarefas={totalTarefas} fechar={() => setAberto(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ lista, totalTarefas, fechar }: { lista: Lista; totalTarefas: number | null; fechar: () => void }) {
  const router = useRouter();
  const caminho = usePathname();
  const [nome, setNome] = useState(lista.nome);
  const [pendente, iniciar] = useTransition();
  const nomeLimpo = nome.trim();

  const salvar = () =>
    iniciar(async () => {
      if (avisar(await renomearListaAcao(lista.id, nomeLimpo))) {
        fechar();
        router.refresh();
      }
    });

  const excluir = () => {
    // Sem a contagem (lista filtrada), avisa de forma genérica.
    const tarefas =
      totalTarefas === null
        ? " As tarefas dela deixam de aparecer."
        : totalTarefas === 0
          ? ""
          : totalTarefas === 1
            ? " A tarefa dela deixa de aparecer."
            : ` As ${totalTarefas} tarefas dela deixam de aparecer.`;
    if (!window.confirm(`Excluir a lista ${lista.nome}?${tarefas}`)) return;
    iniciar(async () => {
      if (avisar(await excluirListaAcao(lista.id))) {
        fechar();
        // Só sai da página se ela for a da lista excluída.
        if (caminho === `/tarefas/listas/${lista.id}`) router.push("/tarefas/minhas");
      }
    });
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (nomeLimpo && nomeLimpo !== lista.nome) salvar();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="nome-lista">Nome da lista</Label>
        <Input id="nome-lista" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} required autoFocus />
      </div>
      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="destructive" disabled={pendente} onClick={excluir}>
          Excluir lista
        </Button>
        <Button type="submit" disabled={pendente || !nomeLimpo || nomeLimpo === lista.nome}>
          {pendente ? "Salvando…" : "Salvar nome"}
        </Button>
      </DialogFooter>
    </form>
  );
}
