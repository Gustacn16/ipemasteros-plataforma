"use client";

import { SearchIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
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

  // A busca espera a pessoa parar de digitar antes de atualizar a URL.
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(espera.current), []);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="relative">
        <span className="sr-only">Buscar produto</span>
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" aria-hidden />
        <input
          type="search"
          placeholder="Buscar produto"
          defaultValue={busca.get("busca") ?? ""}
          className={`${estiloSelect} w-56 pl-8`}
          onChange={(e) => {
            const valor = e.target.value.trim();
            clearTimeout(espera.current);
            espera.current = setTimeout(() => definir("busca", valor || null), 300);
          }}
        />
      </label>
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
