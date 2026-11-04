"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type FiltroCampanhas, campanhasDaLista } from "../../../regras/midia";
import { pilula } from "../estilos";

type Conta = { id: string; nome: string };
type Campanha = { id: string; nome: string; contaId: string; status: string };

const CHAVES = ["conta", "campanhas", "busca", "situacao", "categoria"] as const;

/** Filtros de campanha da visão Mídia, na URL: conta, campanhas (lista), busca pelo nome e situação. */
export function FiltrosMidia({ contas, campanhas }: { contas: Conta[]; campanhas: Campanha[] }) {
  const router = useRouter();
  const caminho = usePathname();
  const busca = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const [procura, setProcura] = useState("");
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);
  const campoBusca = useRef<HTMLInputElement>(null);
  useEffect(() => () => clearTimeout(espera.current), []);

  const conta = busca.get("conta") ?? "";
  const escolhidas = (busca.get("campanhas") ?? "").split(",").filter(Boolean);
  const filtrando = CHAVES.some((c) => busca.get(c));

  function definir(valores: Record<string, string | null>) {
    const p = new URLSearchParams(busca);
    for (const [chave, valor] of Object.entries(valores)) {
      if (valor) p.set(chave, valor);
      else p.delete(chave);
    }
    router.replace(`${caminho}?${p}`, { scroll: false });
  }

  function alternar(id: string) {
    const novas = escolhidas.includes(id) ? escolhidas.filter((c) => c !== id) : [...escolhidas, id];
    definir({ campanhas: novas.join(",") || null });
  }

  const situacao = (busca.get("situacao") ?? "todas") as FiltroCampanhas["situacao"];
  const visiveis = campanhasDaLista(campanhas, situacao).filter(
    (c) => (!conta || c.contaId === conta) && c.nome.toLocaleLowerCase("pt-BR").includes(procura.trim().toLocaleLowerCase("pt-BR")),
  );
  const opcao = "bg-[#1b1e22]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Conta de anúncio"
        className={cn(pilula, "max-w-56")}
        value={conta}
        onChange={(e) => definir({ conta: e.target.value || null, campanhas: null })}
      >
        <option value="" className={opcao}>
          Todas as contas
        </option>
        {contas.map((c) => (
          <option key={c.id} value={c.id} className={opcao}>
            {c.nome}
          </option>
        ))}
      </select>

      <div className="relative">
        <button type="button" className={cn(pilula, "flex items-center gap-2")} aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
          {escolhidas.length === 0 ? "Todas as campanhas" : `${escolhidas.length} ${escolhidas.length === 1 ? "campanha" : "campanhas"}`}
          <ChevronDownIcon className="size-4" aria-hidden />
        </button>
        {aberto && (
          <div className="absolute left-0 z-20 mt-2 grid w-80 max-w-[calc(100vw-3rem)] gap-2 rounded-2xl border border-white/10 bg-[#1b1e22] p-3 shadow-xl">
            <input
              type="search"
              autoFocus
              placeholder="Procurar campanha"
              aria-label="Procurar campanha na lista"
              value={procura}
              onChange={(e) => setProcura(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.06] px-3 text-sm text-white placeholder:text-white/40"
            />
            <ul className="grid max-h-64 gap-0.5 overflow-y-auto">
              {visiveis.length === 0 && <li className="px-2 py-1.5 text-sm text-white/60">Nenhuma campanha.</li>}
              {visiveis.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-white hover:bg-white/10">
                    <input type="checkbox" className="mt-0.5" checked={escolhidas.includes(c.id)} onChange={() => alternar(c.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.nome}</span>
                      <span className="text-xs text-white/50">{c.status === "ACTIVE" ? "Ativa" : "Pausada"}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="button" className="justify-self-end text-sm text-white/70 hover:text-white" onClick={() => setAberto(false)}>
              Fechar
            </button>
          </div>
        )}
      </div>

      <input
        type="search"
        placeholder="Buscar pelo nome"
        aria-label="Buscar campanhas pelo nome"
        ref={campoBusca}
        defaultValue={busca.get("busca") ?? ""}
        className={cn(pilula, "w-48 placeholder:text-white/40")}
        onChange={(e) => {
          const valor = e.target.value.trim();
          clearTimeout(espera.current);
          espera.current = setTimeout(() => definir({ busca: valor || null }), 400);
        }}
      />

      <select
        aria-label="Situação da campanha"
        className={pilula}
        value={busca.get("situacao") ?? "todas"}
        onChange={(e) => definir({ situacao: e.target.value === "todas" ? null : e.target.value })}
      >
        <option value="todas" className={opcao}>
          Ativas e pausadas
        </option>
        <option value="ativas" className={opcao}>
          Só ativas
        </option>
        <option value="pausadas" className={opcao}>
          Só pausadas
        </option>
      </select>

      {filtrando && (
        <button
          type="button"
          className="flex h-10 items-center gap-1 rounded-full px-3 text-sm text-white/70 hover:text-white"
          onClick={() => {
            clearTimeout(espera.current);
            if (campoBusca.current) campoBusca.current.value = "";
            definir(Object.fromEntries(CHAVES.map((c) => [c, null])));
          }}
        >
          <XIcon className="size-4" aria-hidden /> Limpar filtros
        </button>
      )}
    </div>
  );
}
