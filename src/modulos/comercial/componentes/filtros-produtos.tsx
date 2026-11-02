"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROTULO_TIPO_PRODUTO, TIPOS_PRODUTO } from "../esquemas/produto";
import { estiloSelect } from "./exibicao";

/** Filtros da lista de produtos guardados na URL (tipo, área e situação). */
export function FiltrosProdutos({ areas }: { areas: string[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(busca);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    router.replace(p.size ? `${caminho}?${p}` : caminho, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="Tipo"
        className={estiloSelect}
        value={busca.get("tipo") ?? ""}
        onChange={(e) => definir("tipo", e.target.value || null)}
      >
        <option value="">Todos os tipos</option>
        {TIPOS_PRODUTO.map((t) => (
          <option key={t} value={t}>
            {ROTULO_TIPO_PRODUTO[t]}
          </option>
        ))}
      </select>
      {areas.length > 0 && (
        <select
          aria-label="Área"
          className={estiloSelect}
          value={busca.get("area") ?? ""}
          onChange={(e) => definir("area", e.target.value || null)}
        >
          <option value="">Todas as áreas</option>
          {areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Situação"
        className={estiloSelect}
        value={busca.get("situacao") ?? "ativos"}
        onChange={(e) => definir("situacao", e.target.value === "ativos" ? null : e.target.value)}
      >
        <option value="ativos">Ativos</option>
        <option value="inativos">Inativos</option>
        <option value="todos">Todos</option>
      </select>
    </div>
  );
}
