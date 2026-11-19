"use client";

import { ArrowDownIcon, ArrowUpIcon, DiamondIcon, FlagIcon, PlusIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/componentes/ui/button";
import { MAXIMO_ETAPAS, ROTULO_TIPO_ETAPA, TIPOS_ETAPA, type Etapa, type TipoEtapa } from "../regras/fluxo";
import { Fluxograma } from "./fluxograma";

const estilo = "border-input bg-background w-full rounded-md border px-2.5 py-1.5 text-sm";
const novoId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Editor do fluxograma: lista de etapas com ordem, tipo e desvios das decisões, e a prévia ao lado. */
export function EditorFluxo({ etapas, aoMudar }: { etapas: Etapa[]; aoMudar: (etapas: Etapa[]) => void }) {
  const mudar = (i: number, parcial: Partial<Etapa>) => aoMudar(etapas.map((e, k) => (k === i ? { ...e, ...parcial } : e)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= etapas.length) return;
    const nova = [...etapas];
    [nova[i], nova[j]] = [nova[j]!, nova[i]!];
    aoMudar(nova);
  };
  const remover = (i: number) => {
    const id = etapas[i]!.id;
    aoMudar(etapas.filter((_, k) => k !== i).map((e) => ({ ...e, sim: e.sim === id ? null : e.sim, nao: e.nao === id ? null : e.nao })));
  };
  const adicionar = (tipo: TipoEtapa) =>
    aoMudar([
      ...etapas,
      { id: novoId(), tipo, titulo: tipo === "decisao" ? "Deu certo?" : tipo === "fim" ? "Resultado entregue" : "Nova etapa", descricao: "", responsavel: "", sim: null, nao: null },
    ]);

  const opcoes = (excluir: string) => etapas.map((e, k) => ({ id: e.id, rotulo: `${k + 1}. ${e.titulo}` })).filter((o) => o.id !== excluir);
  const cheio = etapas.length >= MAXIMO_ETAPAS;

  return (
    <div className="grid gap-4">
      <ol className="grid gap-2">
        {etapas.map((e, i) => (
          <li key={e.id} className="bg-card grid gap-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">{i + 1}</span>
              <select aria-label={`Tipo da etapa ${i + 1}`} value={e.tipo} onChange={(ev) => mudar(i, { tipo: ev.target.value as TipoEtapa })} className={`${estilo} w-auto`}>
                {TIPOS_ETAPA.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_ETAPA[t]}
                  </option>
                ))}
              </select>
              <input aria-label={`Título da etapa ${i + 1}`} value={e.titulo} maxLength={80} onChange={(ev) => mudar(i, { titulo: ev.target.value })} className={`${estilo} min-w-40 flex-1 font-medium`} placeholder="Título curto" />
              <div className="flex gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                  <ArrowUpIcon />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Descer" disabled={i === etapas.length - 1} onClick={() => mover(i, 1)}>
                  <ArrowDownIcon />
                </Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Remover etapa" onClick={() => remover(i)}>
                  <Trash2Icon />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
              <input aria-label={`Descrição da etapa ${i + 1}`} value={e.descricao} maxLength={300} onChange={(ev) => mudar(i, { descricao: ev.target.value })} className={estilo} placeholder="O que acontece nesta etapa (uma linha)" />
              <input aria-label={`Responsável pela etapa ${i + 1}`} value={e.responsavel} maxLength={80} onChange={(ev) => mudar(i, { responsavel: ev.target.value })} className={estilo} placeholder="Quem faz (ex.: SDR)" />
            </div>
            {e.tipo === "decisao" && (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs">
                  <span className="text-sucesso font-semibold">Se SIM, vai para</span>
                  <select value={e.sim ?? ""} onChange={(ev) => mudar(i, { sim: ev.target.value || null })} className={estilo}>
                    <option value="">A próxima etapa</option>
                    {opcoes(e.id).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs">
                  <span className="text-primary font-semibold">Se NÃO, vai para</span>
                  <select value={e.nao ?? ""} onChange={(ev) => mudar(i, { nao: ev.target.value || null })} className={estilo}>
                    <option value="">— (não mostrar)</option>
                    {opcoes(e.id).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={cheio} onClick={() => adicionar("etapa")}>
          <PlusIcon /> <SquareIcon /> Etapa
        </Button>
        <Button type="button" variant="outline" disabled={cheio} onClick={() => adicionar("decisao")}>
          <PlusIcon /> <DiamondIcon /> Decisão
        </Button>
        <Button type="button" variant="outline" disabled={cheio} onClick={() => adicionar("fim")}>
          <PlusIcon /> <FlagIcon /> Fim
        </Button>
        {cheio && <span className="text-muted-foreground self-center text-xs">Limite de {MAXIMO_ETAPAS} etapas.</span>}
      </div>
      {etapas.length > 0 && (
        <div className="grid gap-2">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">Prévia</span>
          <Fluxograma etapas={etapas} />
        </div>
      )}
    </div>
  );
}
