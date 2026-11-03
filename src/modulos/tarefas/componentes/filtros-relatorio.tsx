"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODOS, ROTULO_PERIODO, type Periodo } from "../regras/relatorio";

const estiloCampo = "border-input bg-background text-foreground h-9 rounded-md border px-2 text-sm";

type Props = {
  periodo: Periodo;
  primeiroDia: string;
  ultimoDia: string;
  /** null: o usuário não navega em espaços (professor), então não filtra por espaço. */
  espacos: { id: string; nome: string }[] | null;
};

/** Filtros do relatório guardados na URL (período e espaço). */
export function FiltrosDoRelatorio({ periodo, primeiroDia, ultimoDia, espacos }: Props) {
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

  function mudarPeriodo(novo: Periodo) {
    // O intervalo livre começa com as datas do período que estava na tela.
    if (novo === "intervalo") definir({ periodo: novo, de: primeiroDia, ate: ultimoDia });
    else definir({ periodo: novo === "mes" ? null : novo, de: null, ate: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        aria-label="Período"
        className={estiloCampo}
        value={periodo}
        onChange={(e) => mudarPeriodo(e.target.value as Periodo)}
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
            className={estiloCampo}
            value={primeiroDia}
            max={ultimoDia}
            onChange={(e) => e.target.value && definir({ de: e.target.value })}
          />
          <span className="text-muted-foreground">até</span>
          <input
            type="date"
            aria-label="Até"
            className={estiloCampo}
            value={ultimoDia}
            min={primeiroDia}
            onChange={(e) => e.target.value && definir({ ate: e.target.value })}
          />
        </>
      )}
      {espacos && espacos.length > 0 && (
        <select
          aria-label="Espaço"
          className={estiloCampo}
          value={busca.get("espaco") ?? ""}
          onChange={(e) => definir({ espaco: e.target.value || null })}
        >
          <option value="">Todos os espaços</option>
          {espacos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
