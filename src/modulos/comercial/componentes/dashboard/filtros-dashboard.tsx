"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { mesAnterior, mesSeguinte, rotuloMes } from "../../regras/meta";
import { pilula } from "./estilos";

type Opcao = { id: string; nome: string };

/** Mês (◀ ▶), produto e vendedor na URL, em pílulas escuras. */
export function FiltrosDashboard({ mes, produtos, vendedores }: { mes: string; produtos: Opcao[]; vendedores: Opcao[] | null }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(busca);
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    router.replace(p.size ? `${caminho}?${p}` : caminho, { scroll: false });
  }

  const seletor = (chave: string, rotulo: string, todos: string, opcoes: Opcao[]) => (
    <select
      aria-label={rotulo}
      className={`${pilula} max-w-56`}
      value={busca.get(chave) ?? ""}
      onChange={(e) => definir(chave, e.target.value || null)}
    >
      <option value="" className="bg-[#1b1e22]">
        {todos}
      </option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id} className="bg-[#1b1e22]">
          {o.nome}
        </option>
      ))}
    </select>
  );

  const botaoMes =
    "flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white hover:bg-white/15";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button type="button" className={botaoMes} aria-label="Mês anterior" onClick={() => definir("mes", mesAnterior(mes))}>
          <ChevronLeftIcon className="size-4" />
        </button>
        <span className="min-w-40 text-center font-medium text-white first-letter:uppercase">{rotuloMes(mes)}</span>
        <button type="button" className={botaoMes} aria-label="Mês seguinte" onClick={() => definir("mes", mesSeguinte(mes))}>
          <ChevronRightIcon className="size-4" />
        </button>
      </div>
      {seletor("produto", "Produto", "Todos os produtos", produtos)}
      {vendedores && seletor("vendedor", "Vendedor", "Todos os vendedores", vendedores)}
    </div>
  );
}
