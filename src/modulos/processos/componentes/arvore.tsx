"use client";

import { ChevronRightIcon, FileTextIcon, HouseIcon, SearchIcon, WorkflowIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { nomeBusca } from "@/modulos/academico/regras/normalizar";
import type { CategoriaNaArvore } from "../servicos/estrutura";
import { ICONE_CATEGORIA } from "./icones";

/** Navegação Categoria → Área → Documento, com filtro por título. Abre no ramo do documento aberto. */
export function ArvoreProcessos({ categorias, aoNavegar }: { categorias: CategoriaNaArvore[]; aoNavegar?: () => void }) {
  const caminho = usePathname();
  const aberto = caminho.match(/^\/processos\/documentos\/([^/]+)/)?.[1];
  const [filtro, setFiltro] = useState("");
  const termo = nomeBusca(filtro);

  const visiveis = termo
    ? categorias
        .map((c) => ({
          ...c,
          areas: c.areas
            .map((a) => ({ ...a, documentos: a.documentos.filter((d) => nomeBusca(d.titulo).includes(termo)) }))
            .filter((a) => a.documentos.length > 0),
        }))
        .filter((c) => c.areas.length > 0)
    : categorias;

  return (
    <div className="grid gap-3">
      <Link
        href="/processos"
        onClick={aoNavegar}
        aria-current={caminho === "/processos" ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
          caminho === "/processos" ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted hover:text-foreground",
        )}
      >
        <HouseIcon className="size-4" aria-hidden /> Visão geral
      </Link>

      <div className="relative">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" aria-hidden />
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por título"
          aria-label="Filtrar documentos por título"
          className="border-input bg-card focus-visible:ring-ring h-8 w-full rounded-md border pr-7 pl-8 text-sm outline-none focus-visible:ring-2"
        />
        {filtro && (
          <button type="button" aria-label="Limpar filtro" onClick={() => setFiltro("")} className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2">
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      {categorias.length === 0 && <p className="text-muted-foreground px-2 text-sm">Nenhuma categoria ainda.</p>}
      {termo && visiveis.length === 0 && <p className="text-muted-foreground px-2 text-sm">Nenhum título com “{filtro}”.</p>}

      <nav aria-label="Documentos de processos" className="grid gap-1 text-sm">
        {visiveis.map((c) => {
          const Icone = ICONE_CATEGORIA[c.icone] ?? ICONE_CATEGORIA.pasta;
          const contem = c.areas.some((a) => a.documentos.some((d) => d.id === aberto));
          return (
            <details key={`${c.id}-${termo ? "f" : "n"}`} open={Boolean(termo) || contem || !aberto} className="group/cat">
              <summary className="hover:bg-muted flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 font-medium select-none [&::-webkit-details-marker]:hidden">
                <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open/cat:rotate-90" aria-hidden />
                <Icone className="text-primary size-4 shrink-0" aria-hidden />
                <span className="truncate">{c.nome}</span>
              </summary>
              <div className="ml-[1.1rem] grid gap-0.5 border-l pl-2">
                {c.areas.length === 0 && <p className="text-muted-foreground px-2 py-1 text-xs">Sem áreas</p>}
                {c.areas.map((a) => (
                  <div key={a.id} className="grid gap-0.5 py-0.5">
                    <span className="text-muted-foreground px-2 pt-1 text-[0.7rem] font-semibold tracking-wider uppercase">{a.nome}</span>
                    {a.documentos.length === 0 && <span className="text-muted-foreground/70 px-2 text-xs italic">vazia</span>}
                    {a.documentos.map((d) => {
                      const ativo = d.id === aberto;
                      const IconeDoc = d.tipo === "processo" ? WorkflowIcon : FileTextIcon;
                      return (
                        <Link
                          key={d.id}
                          href={`/processos/documentos/${d.id}`}
                          onClick={aoNavegar}
                          aria-current={ativo ? "page" : undefined}
                          title={!d.publicado ? `${d.titulo} (rascunho, o time ainda não vê)` : d.pendente ? `${d.titulo} (alterações não publicadas)` : d.titulo}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5",
                            ativo ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <IconeDoc className="size-3.5 shrink-0 opacity-70" aria-hidden />
                          <span className={cn("min-w-0 flex-1 truncate", !d.publicado && "italic")}>{d.titulo}</span>
                          {(!d.publicado || d.pendente) && (
                            <span className={cn("size-1.5 shrink-0 rounded-full", !d.publicado ? "bg-atencao" : "border-atencao border")} aria-hidden />
                          )}
                          {!d.publicado && <span className="sr-only">(rascunho)</span>}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </nav>

      {categorias.some((c) => c.areas.some((a) => a.documentos.some((d) => !d.publicado || d.pendente))) && (
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 px-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-atencao size-1.5 rounded-full" aria-hidden /> rascunho
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="border-atencao size-1.5 rounded-full border" aria-hidden /> não publicado
          </span>
        </p>
      )}
    </div>
  );
}
