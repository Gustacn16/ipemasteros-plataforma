"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { criarEspacoAcao, criarListaAcao } from "../acoes/estrutura";

export const CORES_ESPACO = ["#f97316", "#ef4444", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#737373"];

export function SeletorCor({ name, padrao }: { name: string; padrao: string }) {
  const [cor, setCor] = useState(padrao);
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-sm font-medium">Cor</legend>
      <input type="hidden" name={name} value={cor} />
      <div className="flex flex-wrap gap-2">
        {CORES_ESPACO.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            aria-pressed={cor === c}
            onClick={() => setCor(c)}
            className="size-7 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-neutral-900"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

function DialogoCriacao({
  gatilho,
  titulo,
  descricao,
  children,
}: {
  gatilho: ReactNode;
  titulo: string;
  descricao: string;
  children: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [abertura, setAbertura] = useState(0);
  const fechar = useCallback(() => setAberto(false), []);
  return (
    <Dialog
      open={aberto}
      onOpenChange={(novo) => {
        setAberto(novo);
        if (novo) setAbertura((n) => n + 1);
      }}
    >
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <div key={abertura}>{children(fechar)}</div>
      </DialogContent>
    </Dialog>
  );
}

function FormularioEspaco({ fechar }: { fechar: () => void }) {
  const router = useRouter();
  const [estado, executar, pendente] = useActionState(criarEspacoAcao, { ok: false });
  useEffect(() => {
    if (estado.ok && estado.dados) {
      fechar();
      router.push(`/tarefas/espacos/${estado.dados.id}/configuracoes`);
    }
  }, [estado, fechar, router]);

  return (
    <form action={executar} className="grid gap-4">
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome do departamento" name="nome" placeholder="Ex.: Marketing" erros={estado.erros?.nome} required />
      <SeletorCor name="cor" padrao={CORES_ESPACO[0]} />
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando…" : "Criar espaço"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NovoEspaco({ gatilho }: { gatilho: ReactNode }) {
  return (
    <DialogoCriacao
      gatilho={gatilho}
      titulo="Novo espaço"
      descricao="Cada espaço é um departamento. Depois de criar, escolha quem participa dele."
    >
      {(fechar) => <FormularioEspaco fechar={fechar} />}
    </DialogoCriacao>
  );
}

function FormularioLista({ espacoId, fechar }: { espacoId: string; fechar: () => void }) {
  const router = useRouter();
  const [estado, executar, pendente] = useActionState(criarListaAcao, { ok: false });
  useEffect(() => {
    if (estado.ok && estado.dados) {
      fechar();
      router.push(`/tarefas/listas/${estado.dados.id}`);
    }
  }, [estado, fechar, router]);

  return (
    <form action={executar} className="grid gap-4">
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="espacoId" value={espacoId} />
      <Campo rotulo="Nome da lista" name="nome" placeholder="Ex.: Campanhas" erros={estado.erros?.nome} required />
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando…" : "Criar lista"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NovaLista({ espacoId, espacoNome, gatilho }: { espacoId: string; espacoNome: string; gatilho: ReactNode }) {
  return (
    <DialogoCriacao
      gatilho={gatilho}
      titulo={`Nova lista em ${espacoNome}`}
      descricao="A lista começa com os status A fazer, Em andamento e Concluído. Dá para mudar depois."
    >
      {(fechar) => <FormularioLista espacoId={espacoId} fechar={fechar} />}
    </DialogoCriacao>
  );
}
