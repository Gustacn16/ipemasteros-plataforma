"use client";

import { ChevronRightIcon, FileTextIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { CategoriaNaArvore } from "../servicos/estrutura";
import { ICONE_CATEGORIA } from "./icones";

/** Navegação Categoria → Área → Documento. Abre sozinha no ramo do documento aberto. */
export function ArvoreProcessos({ categorias }: { categorias: CategoriaNaArvore[] }) {
  const caminho = usePathname();
  const aberto = caminho.match(/^\/processos\/documentos\/([^/]+)/)?.[1];

  if (categorias.length === 0) return <p className="text-muted-foreground px-2 text-sm">Nenhuma categoria ainda.</p>;

  return (
    <nav aria-label="Documentos de processos" className="grid gap-1 text-sm">
      {categorias.map((c) => {
        const Icone = ICONE_CATEGORIA[c.icone] ?? ICONE_CATEGORIA.pasta;
        const contem = c.areas.some((a) => a.documentos.some((d) => d.id === aberto));
        return (
          <details key={c.id} open={contem || !aberto} className="group/cat">
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
                        aria-current={ativo ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5",
                          ativo ? "bg-primary/10 text-primary font-medium" : "text-foreground/80 hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <IconeDoc className="size-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{d.titulo}</span>
                        {!d.publicado ? (
                          <span className="text-atencao text-[0.65rem] font-semibold uppercase" title="Ainda não publicado">rascunho</span>
                        ) : d.pendente ? (
                          <span className="bg-atencao size-1.5 shrink-0 rounded-full" title="Alterações não publicadas" />
                        ) : null}
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
  );
}
