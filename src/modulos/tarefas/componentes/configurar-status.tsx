"use client";

import { ArrowDownIcon, ArrowUpIcon, Settings2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { Input } from "@/componentes/ui/input";
import { excluirStatusAcao, salvarStatusAcao } from "../acoes/estrutura";
import { ROTULO_TIPO_STATUS, TIPOS_STATUS, validarConjuntoStatus, type TipoStatus } from "../regras/status";
import { avisar } from "./avisar";

type Status = { id?: string; chave: string; nome: string; cor: string; tipo: TipoStatus };
type StatusSalvo = { id: string; nome: string; cor: string; tipo: TipoStatus };

const estiloSelect = "border-input bg-background h-9 rounded-md border px-2 text-sm";

export function ConfigurarStatus({ listaId, status }: { listaId: string; status: StatusSalvo[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2Icon /> Status da lista
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Status da lista</DialogTitle>
          <DialogDescription>
            A ordem aqui é a ordem das colunas. Toda lista precisa de ao menos um status aberto e um concluído.
          </DialogDescription>
        </DialogHeader>
        {aberto && <Editor listaId={listaId} salvos={status} fechar={() => setAberto(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ listaId, salvos, fechar }: { listaId: string; salvos: StatusSalvo[]; fechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [itens, setItens] = useState<Status[]>(() => salvos.map((s) => ({ ...s, chave: s.id })));
  const [excluindo, setExcluindo] = useState<string | null>(null);
  const [destino, setDestino] = useState("");

  const alterar = (chave: string, campos: Partial<Status>) =>
    setItens((atual) => atual.map((s) => (s.chave === chave ? { ...s, ...campos } : s)));
  const mover = (i: number, delta: number) =>
    setItens((atual) => {
      const novo = [...atual];
      const [item] = novo.splice(i, 1);
      novo.splice(i + delta, 0, item);
      return novo;
    });
  const erroConjunto = validarConjuntoStatus(itens.map((s) => s.tipo));

  function remover(item: Status) {
    if (!item.id) return setItens((atual) => atual.filter((s) => s.chave !== item.chave));
    setExcluindo(item.id);
    setDestino(salvos.find((s) => s.id !== item.id)?.id ?? "");
  }

  function confirmarExclusao() {
    if (!excluindo) return;
    iniciar(async () => {
      if (avisar(await excluirStatusAcao(excluindo, destino))) {
        setItens((atual) => atual.filter((s) => s.id !== excluindo));
        setExcluindo(null);
        router.refresh();
      }
    });
  }

  function salvar() {
    iniciar(async () => {
      const r = await salvarStatusAcao(
        listaId,
        itens.map(({ id, nome, cor, tipo }) => ({ id, nome, cor, tipo })),
      );
      if (!r.ok && r.erros) return void avisar({ ok: false, mensagem: "Confira os nomes dos status." });
      if (avisar(r)) {
        fechar();
        router.refresh();
      }
    });
  }

  if (excluindo) {
    const nome = salvos.find((s) => s.id === excluindo)?.nome;
    return (
      <div className="grid gap-4">
        <p className="text-sm">
          Para onde vão as tarefas que estão em <strong>{nome}</strong>?
        </p>
        <select aria-label="Status de destino" className={estiloSelect} value={destino} onChange={(e) => setDestino(e.target.value)}>
          {salvos
            .filter((s) => s.id !== excluindo)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
        </select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setExcluindo(null)} disabled={pendente}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={confirmarExclusao} disabled={pendente || !destino}>
            Excluir status
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-2">
        {itens.map((s, i) => (
          <li key={s.chave} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input
              type="color"
              aria-label={`Cor de ${s.nome || "status"}`}
              value={s.cor}
              onChange={(e) => alterar(s.chave, { cor: e.target.value })}
              className="border-input bg-background h-9 w-10 shrink-0 cursor-pointer rounded border"
            />
            <Input
              aria-label="Nome do status"
              value={s.nome}
              maxLength={40}
              onChange={(e) => alterar(s.chave, { nome: e.target.value })}
              className="min-w-0 flex-1"
            />
            <select
              aria-label="Tipo do status"
              className={estiloSelect}
              value={s.tipo}
              onChange={(e) => alterar(s.chave, { tipo: e.target.value as TipoStatus })}
            >
              {TIPOS_STATUS.map((t) => (
                <option key={t} value={t}>
                  {ROTULO_TIPO_STATUS[t]}
                </option>
              ))}
            </select>
            <div className="flex">
              <Button variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                <ArrowUpIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Descer" disabled={i === itens.length - 1} onClick={() => mover(i, 1)}>
                <ArrowDownIcon />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Excluir ${s.nome}`} disabled={itens.length <= 2} onClick={() => remover(s)}>
                <Trash2Icon />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={itens.length >= 20}
        onClick={() =>
          setItens((atual) => [...atual, { chave: crypto.randomUUID(), nome: "Novo status", cor: "#a3a3a3", tipo: "em_andamento" }])
        }
      >
        Adicionar status
      </Button>
      {erroConjunto && <p className="text-destructive text-sm">{erroConjunto}</p>}
      <DialogFooter>
        <Button onClick={salvar} disabled={pendente || Boolean(erroConjunto)}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </div>
  );
}
