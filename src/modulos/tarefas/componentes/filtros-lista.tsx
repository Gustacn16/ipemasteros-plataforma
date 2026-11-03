"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRIORIDADES, ROTULO_PRIORIDADE } from "../esquemas/tarefa";

const estiloSelect =
  "border-input bg-background text-foreground focus-visible:ring-ring/50 h-9 max-w-full min-w-0 rounded-md border px-2 text-sm outline-none focus-visible:ring-[3px]";

/** Filtros da lista guardados na URL (responsável, prioridade, etiqueta, atrasadas). */
export function FiltrosDaLista({ pessoas, etiquetas }: { pessoas: { id: string; nome: string }[]; etiquetas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(busca);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    p.delete("tarefa");
    router.replace(p.size ? `${caminho}?${p}` : caminho, { scroll: false });
  }

  return (
    <div className="text-foreground flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="Filtrar por responsável"
        className={estiloSelect}
        value={busca.get("responsavel") ?? ""}
        onChange={(e) => definir("responsavel", e.target.value || null)}
      >
        <option value="">Todos os responsáveis</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <select
        aria-label="Filtrar por prioridade"
        className={estiloSelect}
        value={busca.get("prioridade") ?? ""}
        onChange={(e) => definir("prioridade", e.target.value || null)}
      >
        <option value="">Todas as prioridades</option>
        {PRIORIDADES.map((p) => (
          <option key={p} value={p}>
            {ROTULO_PRIORIDADE[p]}
          </option>
        ))}
      </select>
      {etiquetas.length > 0 && (
        <select
          aria-label="Filtrar por etiqueta"
          className={estiloSelect}
          value={busca.get("etiqueta") ?? ""}
          onChange={(e) => definir("etiqueta", e.target.value || null)}
        >
          <option value="">Todas as etiquetas</option>
          {etiquetas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      )}
      <label className="flex h-9 items-center gap-1.5 whitespace-nowrap">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={busca.get("atrasadas") === "1"}
          onChange={(e) => definir("atrasadas", e.target.checked ? "1" : null)}
        />
        Só atrasadas
      </label>
    </div>
  );
}
