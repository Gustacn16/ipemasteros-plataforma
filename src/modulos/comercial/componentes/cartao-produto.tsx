"use client";

import { LinkIcon, TagIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirProdutoAcao } from "../acoes/produtos";
import type { TipoProduto } from "../esquemas/produto";
import type { ProdutoEstante } from "../servicos/produtos";
import { SeloInativo, descreverParcelas } from "./exibicao";

/** Cor da faixa do cartão por tipo de produto. */
const FAIXA_TIPO: Record<TipoProduto, string> = {
  pos_graduacao: "bg-violet-500",
  curso_livre: "bg-teal-500",
  paciente_modelo: "bg-amber-500",
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Cartão de um produto na estante. A lixeira só aparece para quem pode apagar (admin). */
export function CartaoProduto({ produto, podeExcluir }: { produto: ProdutoEstante; podeExcluir: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const oferta = produto.ofertaPadrao;

  return (
    <div
      className={cn(
        "bg-card relative flex h-full flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md",
        !produto.ativo && "bg-muted/40 border-dashed",
        pendente && "opacity-50",
      )}
    >
      <div aria-hidden className={cn("h-1.5", produto.ativo ? FAIXA_TIPO[produto.tipo] : "bg-neutral-300")} />
      <Link href={`/comercial/produtos/${produto.id}`} className="flex flex-1 flex-col gap-1 p-4 pr-11">
        <span className="text-muted-foreground truncate text-xs">{produto.area ?? "Sem área"}</span>
        <span className={cn("leading-snug font-medium", !produto.ativo && "text-muted-foreground")}>{produto.nome}</span>
        <span className="mt-2 text-lg font-semibold">{oferta ? formatarReais(oferta.precoCheio) : "Sem preço"}</span>
        {oferta && <span className="text-muted-foreground text-xs">{descreverParcelas(oferta.parcelas, oferta.valorParcela)}</span>}
        <span className="text-muted-foreground mt-auto flex items-center gap-3 pt-3 text-xs">
          <span className="flex items-center gap-1">
            <TagIcon className="size-3.5" aria-hidden /> {plural(produto.quantidadeOfertas, "oferta", "ofertas")}
          </span>
          <span className="flex items-center gap-1">
            <LinkIcon className="size-3.5" aria-hidden /> {plural(produto.quantidadeLinks, "link", "links")}
          </span>
        </span>
      </Link>
      <div className="absolute top-3.5 right-2 flex items-center gap-1">
        {!produto.ativo && <SeloInativo />}
        {podeExcluir && (
          <button
            type="button"
            aria-label={`Apagar ${produto.nome}`}
            disabled={pendente}
            className="text-muted-foreground rounded p-1.5 hover:bg-red-50 hover:text-red-600"
            onClick={() => {
              if (!confirm(`Apagar o produto "${produto.nome}"? Ele some do catálogo.`)) return;
              iniciar(async () => {
                if (avisar(await excluirProdutoAcao(produto.id))) router.refresh();
              });
            }}
          >
            <Trash2Icon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
