"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
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
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarConteudoAcao } from "../acoes/conteudo";
import { FORMATOS, ROTULO_FORMATO, ROTULO_PLATAFORMA } from "../esquemas/conteudo";
import type { Conta } from "../servicos/contas";

const estiloCampo = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

export function NovoConteudo({ contas, marcaPadrao, gatilho }: { contas: Conta[]; marcaPadrao?: string; gatilho: ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo conteúdo</DialogTitle>
          <DialogDescription>Começa como ideia. Roteiro, gravação e legenda você completa no detalhe.</DialogDescription>
        </DialogHeader>
        {aberto &&
          (contas.length === 0 ? (
            <p className="text-sm">Antes, cadastre pelo menos uma conta com seus canais (engrenagem em Contas).</p>
          ) : (
            <Formulario contas={contas} marcaPadrao={marcaPadrao} fechar={() => setAberto(false)} />
          ))}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ contas, marcaPadrao, fechar }: { contas: Conta[]; marcaPadrao?: string; fechar: () => void }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [marcaId, setMarcaId] = useState(contas.some((c) => c.id === marcaPadrao) ? marcaPadrao! : contas[0].id);
  const [canalIds, setCanalIds] = useState<string[]>([]);
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const conta = contas.find((c) => c.id === marcaId)!;

  function enviar(formData: FormData) {
    iniciar(async () => {
      const r = await criarConteudoAcao({
        marcaId,
        titulo: formData.get("titulo"),
        formato: formData.get("formato"),
        dataPublicacao: formData.get("dataPublicacao") ?? "",
        canalIds,
      });
      setErros(r.erros ?? {});
      if (r.erros) return;
      if (avisar(r) && r.dados) {
        fechar();
        router.push(`/conteudo/itens/${r.dados.id}`);
      }
    });
  }

  return (
    <form action={enviar} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="novo-titulo">Título</Label>
        <Input id="novo-titulo" name="titulo" required maxLength={200} placeholder="Ex.: Reels — 3 erros na prova de residência" />
        {erros.titulo && <p className="text-destructive text-sm">{erros.titulo.join(" ")}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="novo-marca">Conta</Label>
          <select
            id="novo-marca"
            className={estiloCampo}
            value={marcaId}
            onChange={(e) => {
              setMarcaId(e.target.value);
              setCanalIds([]);
            }}
          >
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="novo-formato">Formato</Label>
          <select id="novo-formato" name="formato" className={estiloCampo} defaultValue="reels">
            {FORMATOS.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FORMATO[f]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Canais de destino</legend>
        {conta.canais.length === 0 ? (
          <p className="text-muted-foreground text-sm">Esta conta ainda não tem canais.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {conta.canais.map((k) => (
              <label key={k.id} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={canalIds.includes(k.id)}
                  onChange={(e) => setCanalIds((a) => (e.target.checked ? [...a, k.id] : a.filter((x) => x !== k.id)))}
                />
                {ROTULO_PLATAFORMA[k.plataforma]}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor="novo-data">Publicação prevista (opcional)</Label>
        <input id="novo-data" type="date" name="dataPublicacao" className={estiloCampo} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando…" : "Criar conteúdo"}
        </Button>
      </DialogFooter>
    </form>
  );
}
