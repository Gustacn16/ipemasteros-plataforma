"use client";

import { CheckIcon, PlusIcon, TagIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { Input } from "@/componentes/ui/input";
import { cn } from "@/lib/utils";
import { criarEtiquetaAcao, definirEtiquetasTarefaAcao, editarEtiquetaAcao, excluirEtiquetaAcao } from "../acoes/tarefas";
import { avisar } from "./avisar";
import { CORES_ESPACO } from "./dialogos-estrutura";
import { CLASSE_TITULO_SECAO } from "./exibicao";

export type Etiqueta = { id: string; nome: string; cor: string };

/** Selo de etiqueta: fundo claro na cor da etiqueta. */
export function SeloEtiqueta({ etiqueta, className }: { etiqueta: Etiqueta; className?: string }) {
  return (
    <span
      className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: `${etiqueta.cor}1f`, color: etiqueta.cor }}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: etiqueta.cor }} />
      <span className="truncate">{etiqueta.nome}</span>
    </span>
  );
}

type Props = {
  tarefaId: string;
  espacoId: string;
  selecionadas: Etiqueta[];
  doEspaco: Etiqueta[];
  podeEditar: boolean;
  podeCriar: boolean;
};

/** Etiquetas da tarefa no painel: marcar no menu salva na hora; quem gerencia listas cria novas ali mesmo. */
export function EtiquetasTarefa({ tarefaId, espacoId, selecionadas, doEspaco, podeEditar, podeCriar }: Props) {
  const [ids, setIds] = useState(() => selecionadas.map((e) => e.id));
  const [pendente, iniciar] = useTransition();
  const [nova, setNova] = useState("");

  function salvar(novos: string[]) {
    const anteriores = ids;
    setIds(novos);
    iniciar(async () => {
      const r = await definirEtiquetasTarefaAcao({ tarefaId, etiquetaIds: novos });
      if (!r.ok) {
        setIds(anteriores);
        avisar(r);
      }
    });
  }

  function criar() {
    const nome = nova.trim();
    if (!nome) return;
    const cor = CORES_ESPACO[doEspaco.length % CORES_ESPACO.length];
    iniciar(async () => {
      const r = await criarEtiquetaAcao({ espacoId, nome, cor });
      if (!avisar(r) || !r.dados) return;
      setNova("");
      const novos = [...ids, r.dados.id];
      setIds(novos);
      avisar(await definirEtiquetasTarefaAcao({ tarefaId, etiquetaIds: novos }));
    });
  }

  const marcadas = doEspaco.filter((e) => ids.includes(e.id));

  return (
    <section className="grid gap-2" aria-labelledby="titulo-etiquetas">
      <h3 id="titulo-etiquetas" className={CLASSE_TITULO_SECAO}>
        Etiquetas
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {marcadas.map((e) => (
          <SeloEtiqueta key={e.id} etiqueta={e} />
        ))}
        {podeEditar && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" disabled={pendente}>
                <TagIcon className="size-3.5" /> {marcadas.length ? "Alterar" : "Adicionar etiqueta"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Etiquetas do espaço</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {doEspaco.length === 0 && <p className="text-muted-foreground px-2 py-1.5 text-xs">Nenhuma etiqueta ainda.</p>}
              {doEspaco.map((e) => (
                <DropdownMenuCheckboxItem
                  key={e.id}
                  checked={ids.includes(e.id)}
                  onSelect={(ev) => ev.preventDefault()}
                  onCheckedChange={(marcado) => salvar(marcado ? [...ids, e.id] : ids.filter((x) => x !== e.id))}
                >
                  <SeloEtiqueta etiqueta={e} />
                </DropdownMenuCheckboxItem>
              ))}
              {podeCriar && (
                <>
                  <DropdownMenuSeparator />
                  <div className="flex gap-1 p-1" onKeyDown={(e) => e.stopPropagation()}>
                    <Input
                      value={nova}
                      onChange={(e) => setNova(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), criar())}
                      placeholder="Nova etiqueta"
                      maxLength={40}
                      aria-label="Nome da nova etiqueta"
                      className="h-8"
                    />
                    <Button type="button" size="icon" className="size-8" aria-label="Criar etiqueta" disabled={pendente || !nova.trim()} onClick={criar}>
                      <PlusIcon />
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!podeEditar && marcadas.length === 0 && <span className="text-muted-foreground text-sm">Sem etiquetas.</span>}
      </div>
    </section>
  );
}

/** Gestão das etiquetas na configuração do espaço. */
export function GerenciarEtiquetas({ espacoId, etiquetas }: { espacoId: string; etiquetas: Etiqueta[] }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState<string>(CORES_ESPACO[0]);

  return (
    <div className="grid max-w-xl gap-3">
      {etiquetas.length > 0 && (
        <ul className="grid divide-y rounded-md border">
          {etiquetas.map((e) => (
            <LinhaEtiqueta key={`${e.id}-${e.nome}-${e.cor}`} etiqueta={e} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        action={() =>
          iniciar(async () => {
            if (avisar(await criarEtiquetaAcao({ espacoId, nome, cor }))) setNome("");
          })
        }
      >
        <SeletorCorCompacto valor={cor} mudar={setCor} />
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Campanha" maxLength={40} aria-label="Nome da etiqueta" className="h-9 w-48" />
        <Button type="submit" size="sm" disabled={pendente || !nome.trim()}>
          <PlusIcon /> Criar etiqueta
        </Button>
      </form>
    </div>
  );
}

function LinhaEtiqueta({ etiqueta }: { etiqueta: Etiqueta }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(etiqueta.nome);
  const [cor, setCor] = useState(etiqueta.cor);
  const mudou = nome.trim() !== etiqueta.nome || cor !== etiqueta.cor;

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <SeletorCorCompacto valor={cor} mudar={setCor} />
      <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} aria-label="Nome da etiqueta" className="h-8 w-48" />
      <SeloEtiqueta etiqueta={{ ...etiqueta, nome: nome || etiqueta.nome, cor }} />
      <span className="ml-auto flex gap-1">
        <Button
          size="sm"
          variant="outline"
          disabled={pendente || !mudou}
          onClick={() => iniciar(async () => void avisar(await editarEtiquetaAcao({ etiquetaId: etiqueta.id, nome, cor })))}
        >
          Salvar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={pendente}
          onClick={() => {
            if (window.confirm(`Excluir a etiqueta ${etiqueta.nome}? Ela sai de todas as tarefas.`)) {
              iniciar(async () => void avisar(await excluirEtiquetaAcao(etiqueta.id)));
            }
          }}
        >
          Excluir
        </Button>
      </span>
    </li>
  );
}

function SeletorCorCompacto({ valor, mudar }: { valor: string; mudar: (cor: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Cor da etiqueta" className="size-7 shrink-0 rounded-md border-background border-2 shadow ring-border ring-1" style={{ backgroundColor: valor }} />
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
