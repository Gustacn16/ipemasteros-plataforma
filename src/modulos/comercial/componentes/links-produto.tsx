"use client";

import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirLinkAcao, salvarLinkAcao } from "../acoes/produtos";
import { CATEGORIAS_LINK, ROTULO_CATEGORIA_LINK } from "../esquemas/produto";
import type { ProdutoDetalhe } from "../servicos/produtos";
import { estiloSelect } from "./exibicao";

type Link = ProdutoDetalhe["links"][number];

function NovoLink({ produtoId }: { produtoId: string }) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, executar, pendente] = useActionState(salvarLinkAcao, {
    ok: false,
  });
  useEffect(() => {
    if (estado.ok) {
      formulario.current?.reset();
      router.refresh();
    }
  }, [estado, router]);
  const erro = estado.erros?.titulo?.[0] ?? estado.erros?.url?.[0] ?? (!estado.ok ? estado.mensagem : undefined);

  return (
    <form ref={formulario} action={executar} className="grid gap-2 border-t pt-4">
      <input type="hidden" name="produtoId" value={produtoId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto_auto]">
        <Input name="titulo" placeholder="Título (ex.: Script de vendas)" aria-label="Título do link" required />
        <Input name="url" type="url" placeholder="https://…" aria-label="Endereço do link" required />
        <select name="categoria" aria-label="Categoria do link" className={estiloSelect} defaultValue="vendas">
          {CATEGORIAS_LINK.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA_LINK[c]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={pendente} className="h-9">
          Adicionar
        </Button>
      </div>
      {erro && <p className="text-destructive text-sm">{erro}</p>}
    </form>
  );
}

export function LinksProduto({ produtoId, links, podeEditar }: { produtoId: string; links: Link[]; podeEditar: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const categorias = CATEGORIAS_LINK.filter((c) => links.some((l) => l.categoria === c));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Links importantes</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {links.length === 0 && <p className="text-muted-foreground text-sm">Nenhum link cadastrado.</p>}
        {categorias.map((c) => (
          <div key={c} className="grid gap-1">
            <p className="text-muted-foreground text-xs font-medium uppercase">{ROTULO_CATEGORIA_LINK[c]}</p>
            <ul className="grid gap-1">
              {links
                .filter((l) => l.categoria === c)
                .map((l) => (
                  <li key={l.id} className="flex items-center gap-2 text-sm">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 hover:underline">
                      <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{l.titulo}</span>
                    </a>
                    {podeEditar && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label={`Excluir ${l.titulo}`}
                        disabled={pendente}
                        onClick={() => {
                          if (!confirm(`Excluir o link "${l.titulo}"?`)) return;
                          iniciar(async () => {
                            if (avisar(await excluirLinkAcao(l.id))) router.refresh();
                          });
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {podeEditar && <NovoLink produtoId={produtoId} />}
      </CardContent>
    </Card>
  );
}
