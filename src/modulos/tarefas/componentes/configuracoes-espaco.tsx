"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { ROTULO_PAPEL, type Papel } from "@/lib/permissoes";
import { definirMembrosAcao, editarEspacoAcao, excluirEspacoAcao } from "../acoes/estrutura";
import { avisar } from "./avisar";
import { SeletorCor } from "./dialogos-estrutura";

type Espaco = { id: string; nome: string; cor: string };

export function FormularioDadosEspaco({ espaco }: { espaco: Espaco }) {
  const [estado, executar, pendente] = useActionState(editarEspacoAcao, { ok: false });
  return (
    <form action={executar} className="grid max-w-md gap-4">
      {estado.mensagem && (
        <Alert variant={estado.ok ? "default" : "destructive"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="espacoId" value={espaco.id} />
      <Campo rotulo="Nome" name="nome" defaultValue={espaco.nome} erros={estado.erros?.nome} required maxLength={80} />
      <SeletorCor name="cor" padrao={espaco.cor} />
      <Button type="submit" disabled={pendente} className="justify-self-start">
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

type Usuario = { id: string; nome: string; email: string; papel: Papel };

export function MembrosEspaco({ espacoId, usuarios, membroIds }: { espacoId: string; usuarios: Usuario[]; membroIds: string[] }) {
  const [selecionados, setSelecionados] = useState(membroIds);
  const [pendente, iniciar] = useTransition();
  const alternar = (id: string, marcado: boolean) =>
    setSelecionados((atual) => (marcado ? [...atual, id] : atual.filter((x) => x !== id)));

  return (
    <div className="grid max-w-xl gap-3">
      <ul className="bg-card grid divide-y rounded-md border">
        {usuarios.map((u) => (
          <li key={u.id}>
            <label className="flex items-center gap-3 px-3 py-2 text-sm">
              <input type="checkbox" className="accent-primary size-4" checked={selecionados.includes(u.id)} onChange={(e) => alternar(u.id, e.target.checked)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{u.nome}</span>
                <span className="text-muted-foreground block truncate">{u.email}</span>
              </span>
              <span className="text-muted-foreground text-xs">{ROTULO_PAPEL[u.papel]}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">Admins e gestores veem todos os espaços mesmo sem serem membros.</p>
      <Button
        className="justify-self-start"
        disabled={pendente}
        onClick={() => iniciar(async () => void avisar(await definirMembrosAcao(espacoId, selecionados)))}
      >
        {pendente ? "Salvando…" : "Salvar membros"}
      </Button>
    </div>
  );
}

export function ExcluirEspaco({ espaco }: { espaco: Espaco }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="destructive"
      disabled={pendente}
      onClick={() => {
        if (!window.confirm(`Excluir o espaço ${espaco.nome}? As listas e tarefas dele deixam de aparecer.`)) return;
        iniciar(async () => {
          if (avisar(await excluirEspacoAcao(espaco.id))) router.push("/tarefas/minhas");
        });
      }}
    >
      Excluir espaço
    </Button>
  );
}
