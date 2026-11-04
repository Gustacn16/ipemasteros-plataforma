"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/componentes/ui/dropdown-menu";
import { Input } from "@/componentes/ui/input";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { CORES_ESPACO } from "@/modulos/tarefas/componentes/dialogos-estrutura";
import { criarTipoAcao, definirTipoAtivoAcao, editarTipoAcao, moverTipoAcao } from "../acoes/agenda";

export type TipoEventoLinha = { id: string; nome: string; cor: string; ativo: boolean };

/** Gestão dos tipos de evento: criar, renomear, trocar a cor, reordenar e desativar. */
export function GerenciarTipos({ tipos }: { tipos: TipoEventoLinha[] }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(CORES_ESPACO[0]);

  return (
    <div className="grid max-w-xl min-w-0 grid-cols-1 gap-3">
      {tipos.length > 0 && (
        <ul className="grid divide-y rounded-md border">
          {tipos.map((t, i) => (
            <LinhaTipo key={`${t.id}-${t.nome}-${t.cor}`} tipo={t} primeiro={i === 0} ultimo={i === tipos.length - 1} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        action={() =>
          iniciar(async () => {
            if (avisar(await criarTipoAcao({ nome, cor }))) setNome("");
          })
        }
      >
        <SeletorCor valor={cor} mudar={setCor} />
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Workshop" maxLength={40} aria-label="Nome do novo tipo" className="h-9 w-48 max-w-full min-w-0" />
        <Button type="submit" size="sm" disabled={pendente || !nome.trim()}>
          <PlusIcon /> Criar tipo
        </Button>
      </form>
    </div>
  );
}

function LinhaTipo({ tipo, primeiro, ultimo }: { tipo: TipoEventoLinha; primeiro: boolean; ultimo: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(tipo.nome);
  const [cor, setCor] = useState(tipo.cor);
  const mudou = nome.trim() !== tipo.nome || cor !== tipo.cor;

  return (
    <li className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !tipo.ativo && "bg-muted/40")}>
      <SeletorCor valor={cor} mudar={setCor} />
      <Input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={40}
        aria-label="Nome do tipo"
        className={cn("h-8 w-48 max-w-full min-w-0", !tipo.ativo && "text-muted-foreground")}
      />
      <span className="ml-auto flex flex-wrap items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={pendente || !mudou || !nome.trim()}
          onClick={() => iniciar(async () => void avisar(await editarTipoAcao({ tipoId: tipo.id, nome, cor })))}
        >
          Salvar
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`Subir ${tipo.nome}`}
          disabled={pendente || primeiro}
          onClick={() => iniciar(async () => void avisar(await moverTipoAcao({ tipoId: tipo.id, direcao: "cima" })))}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={`Descer ${tipo.nome}`}
          disabled={pendente || ultimo}
          onClick={() => iniciar(async () => void avisar(await moverTipoAcao({ tipoId: tipo.id, direcao: "baixo" })))}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          size="sm"
          variant={tipo.ativo ? "secondary" : "outline"}
          aria-pressed={tipo.ativo}
          disabled={pendente}
          onClick={() => iniciar(async () => void avisar(await definirTipoAtivoAcao({ tipoId: tipo.id, ativo: !tipo.ativo })))}
        >
          {tipo.ativo ? "Ativo" : "Inativo"}
        </Button>
      </span>
    </li>
  );
}

/** Botão com a cor atual que abre a paleta. Usado também em Minhas agendas. */
export function SeletorCor({ valor, mudar, rotulo = "Cor do tipo" }: { valor: string; mudar: (cor: string) => void; rotulo?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={rotulo} className="border-background ring-foreground/10 size-7 shrink-0 rounded-md border-2 shadow ring-1" style={{ backgroundColor: valor }} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="grid w-auto grid-cols-6 gap-1 p-2">
        {CORES_ESPACO.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Cor ${c}`}
            onClick={() => mudar(c)}
            className="flex size-6 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: c }}
          >
            {c === valor && <CheckIcon className="size-3.5" />}
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
