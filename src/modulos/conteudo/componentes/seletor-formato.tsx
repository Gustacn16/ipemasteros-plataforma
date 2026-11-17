"use client";

import { PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarFormatoAcao } from "../acoes/conteudo";
import { ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";

export type CanalComFormatos = {
  id: string;
  plataforma: Plataforma;
  identificador: string | null;
  ativo: boolean;
  formatos: { id: string; nome: string; ativo: boolean }[];
};
export type ContaComCanais = { id: string; nome: string; canais: CanalComFormatos[] };

const estiloCampo = "border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm";
const nomeCanal = (k: CanalComFormatos) => `${ROTULO_PLATAFORMA[k.plataforma]}${k.identificador ? ` ${k.identificador}` : ""}`;

/**
 * Canal primeiro, depois o formato daquele canal (ex.: YouTube → Avulso, Entrevista, Vlog).
 * "+ Novo formato" cria o formato no canal sem sair do formulário.
 */
export function SeletorCanalFormato({
  contas,
  canalId,
  formatoId,
  aoMudar,
  formatoAtual,
  idPrefixo = "sf",
}: {
  contas: ContaComCanais[];
  canalId: string;
  formatoId: string;
  aoMudar: (v: { canalId: string; formatoId: string }) => void;
  /** Formato já gravado no conteúdo: continua na lista mesmo se foi desativado. */
  formatoAtual?: string | null;
  idPrefixo?: string;
}) {
  const [criados, setCriados] = useState<Record<string, { id: string; nome: string }[]>>({});
  const [novo, setNovo] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const canal = contas.flatMap((c) => c.canais).find((k) => k.id === canalId);
  const formatos = [
    ...(canal?.formatos.filter((f) => f.ativo || f.id === formatoAtual) ?? []),
    ...(criados[canalId] ?? []).filter((f) => !canal?.formatos.some((x) => x.id === f.id)),
  ];

  function trocarCanal(id: string) {
    const k = contas.flatMap((c) => c.canais).find((x) => x.id === id);
    aoMudar({ canalId: id, formatoId: k?.formatos.find((f) => f.ativo)?.id ?? "" });
    setNovo(null);
  }

  function criar() {
    const nome = novo?.trim();
    if (!nome) return;
    iniciar(async () => {
      const r = await criarFormatoAcao({ canalId, nome });
      if (avisar(r) && r.dados) {
        const f = r.dados;
        setCriados((c) => ({ ...c, [canalId]: [...(c[canalId] ?? []), f] }));
        aoMudar({ canalId, formatoId: f.id });
        setNovo(null);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefixo}-canal`}>Canal</Label>
        <select id={`${idPrefixo}-canal`} className={estiloCampo} value={canalId} onChange={(e) => trocarCanal(e.target.value)} required>
          {!canal && <option value="">Escolha o canal</option>}
          {contas.map((c) =>
            c.canais.length === 0 ? null : (
              <optgroup key={c.id} label={c.nome}>
                {c.canais
                  .filter((k) => k.ativo || k.id === canalId)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {nomeCanal(k)}
                    </option>
                  ))}
              </optgroup>
            ),
          )}
        </select>
      </div>

      {canal && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Formato</legend>
          <div role="radiogroup" aria-label="Formato" className="flex flex-wrap gap-2">
            {formatos.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={f.id === formatoId}
                onClick={() => aoMudar({ canalId, formatoId: f.id })}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none",
                  f.id === formatoId ? "border-primary bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {f.nome}
              </button>
            ))}
            {novo === null ? (
              <button
                type="button"
                onClick={() => setNovo("")}
                className="text-muted-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1 text-sm"
              >
                <PlusIcon className="size-3.5" aria-hidden /> Novo formato
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <Input
                  autoFocus
                  aria-label="Nome do formato novo"
                  className="h-8 w-40"
                  maxLength={60}
                  placeholder="Ex.: Entrevista"
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      criar();
                    }
                    if (e.key === "Escape") setNovo(null);
                  }}
                />
                <Button type="button" size="sm" onClick={criar} disabled={pendente || !novo.trim()}>
                  Adicionar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNovo(null)}>
                  Cancelar
                </Button>
              </span>
            )}
          </div>
          {formatos.length === 0 && novo === null && (
            <p className="text-muted-foreground text-sm">Este canal ainda não tem formatos. Crie o primeiro em “Novo formato”.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}

/** Os outros canais da mesma conta, onde o conteúdo também sai. */
export function TambemPublicarEm({
  canais,
  principal,
  marcados,
  aoMudar,
}: {
  canais: CanalComFormatos[];
  principal: string;
  marcados: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const outros = canais.filter((k) => k.id !== principal && (k.ativo || marcados.includes(k.id)));
  if (outros.length === 0) return null;
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Também publicar em (opcional)</legend>
      <div className="flex flex-wrap gap-4">
        {outros.map((k) => (
          <label key={k.id} className="flex min-w-0 items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={marcados.includes(k.id)}
              onChange={(e) => aoMudar(e.target.checked ? [...marcados, k.id] : marcados.filter((x) => x !== k.id))}
            />
            {nomeCanal(k)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
