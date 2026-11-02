"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODOS, ROTULO_PERIODO, type Periodo } from "@/modulos/tarefas/regras/relatorio";
import { estiloSelect } from "./exibicao";

type Opcao = { id: string; nome: string };

type Props = {
  periodo: Periodo;
  primeiroDia: string;
  ultimoDia: string;
  produtos: Opcao[];
  canais: Opcao[];
  /** null: quem não vê a equipe não filtra por vendedor. */
  vendedores: Opcao[] | null;
};

/** Filtros da lista de vendas guardados na URL (período, produto, vendedor e canal). */
export function FiltrosVendas({ periodo, primeiroDia, ultimoDia, produtos, canais, vendedores }: Props) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();

  function definir(valores: Record<string, string | null>) {
    const p = new URLSearchParams(busca);
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
    }
    router.replace(p.size ? `${caminho}?${p}` : caminho, { scroll: false });
  }

  const selecao = (chave: string, rotulo: string, todos: string, opcoes: Opcao[]) => (
    <select
      aria-label={rotulo}
      className={estiloSelect}
      value={busca.get(chave) ?? ""}
      onChange={(e) => definir({ [chave]: e.target.value || null })}
    >
      <option value="">{todos}</option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.nome}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="Período"
        className={estiloSelect}
        value={periodo}
        onChange={(e) => {
          const novo = e.target.value as Periodo;
          if (novo === "intervalo") definir({ periodo: novo, de: primeiroDia, ate: ultimoDia });
          else definir({ periodo: novo === "mes" ? null : novo, de: null, ate: null });
        }}
      >
        {PERIODOS.map((p) => (
          <option key={p} value={p}>
            {ROTULO_PERIODO[p]}
          </option>
        ))}
      </select>
      {periodo === "intervalo" && (
        <>
          <input
            type="date"
            aria-label="De"
            className={estiloSelect}
            value={primeiroDia}
            max={ultimoDia}
            onChange={(e) => e.target.value && definir({ de: e.target.value })}
          />
          <span className="text-muted-foreground">até</span>
          <input
            type="date"
            aria-label="Até"
            className={estiloSelect}
            value={ultimoDia}
            min={primeiroDia}
            onChange={(e) => e.target.value && definir({ ate: e.target.value })}
          />
        </>
      )}
      {selecao("produto", "Produto", "Todos os produtos", produtos)}
      {vendedores && selecao("vendedor", "Vendedor", "Todos os vendedores", vendedores)}
      {selecao("canal", "Canal", "Todos os canais", canais)}
    </div>
  );
}
