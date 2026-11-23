"use client";

import { Button } from "@/componentes/ui/button";
import { lancarResultadoAcao } from "../acoes/planejamento";
import type { ItemLancamento } from "../servicos/lancamento";
import { formatarValor, numeroParaCampo } from "./formatar";
import { classeCampo, useAcao } from "./ui-plano";

function Item({ item, mes }: { item: ItemLancamento; mes: string }) {
  const [estado, executar, salvando] = useAcao(lancarResultadoAcao);
  const sufixo = item.unidade === "percentual" ? "%" : item.unidade === "reais" ? "R$" : "";
  const metaTela = item.meta === null ? null : item.unidade === "percentual" ? item.meta / 100 : item.meta;
  return (
    <form action={executar} className="bg-card grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="indicadorId" value={item.id} />
      <input type="hidden" name="mes" value={mes} />
      <div className="min-w-0">
        <p className="font-medium">{item.nome}</p>
        <p className="text-muted-foreground text-xs">
          {item.grupo || (item.frente === "comercial" ? "Comercial" : "Marketing")} · meta {formatarValor(item.unidade, metaTela)}
          {item.responsavel ? ` · ${item.responsavel}` : ""}
          {item.registradoPor ? ` · lançado por ${item.registradoPor}` : ""}
        </p>
      </div>
      <label className="grid gap-0.5 text-xs">
        <span className="text-muted-foreground">Realizado {sufixo && `(${sufixo})`}</span>
        <input name="valor" inputMode="decimal" defaultValue={numeroParaCampo(item.valor)} className={classeCampo} aria-label={`Realizado de ${item.nome}`} />
      </label>
      <label className="grid gap-0.5 text-xs">
        <span className="text-muted-foreground">Observação (opcional)</span>
        <input name="observacao" maxLength={300} defaultValue={item.observacao ?? ""} className={classeCampo} />
      </label>
      <Button type="submit" size="sm" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
      {estado.erros?.valor && <p className="text-destructive text-xs sm:col-span-4">{estado.erros.valor.join(" ")}</p>}
    </form>
  );
}

/** Indicadores manuais do mês. Deixar vazio e salvar apaga o lançamento. */
export function LancarResultados({ itens, mes }: { itens: ItemLancamento[]; mes: string }) {
  return (
    <div className="grid gap-2">
      {itens.map((i) => (
        <Item key={`${mes}-${i.id}-${i.valor}`} item={i} mes={mes} />
      ))}
    </div>
  );
}
