"use client";

import { CopyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import type { EstadoAcao } from "@/lib/acoes";
import { formatarReais, lerReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { copiarMetasAcao, salvarMetasProdutoAcao } from "../acoes/metas";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "../esquemas/produto";
import { totaisMetas } from "../regras/meta";
import type { MetasDoMes } from "../servicos/metas";
import { SeloInativo } from "./exibicao";

const PRATELEIRAS: readonly TipoProduto[] = ["pos_graduacao", "curso_livre", "paciente_modelo"];

/** "360000.00" → "360.000,00" para o campo; zero vira vazio. */
const paraCampo = (v: string) => (Number(v) === 0 ? "" : formatarReais(v).replace("R$ ", ""));

type Produto = MetasDoMes["produtos"][number];
type Linha = { valor: string; quantidade: string };

function CartaoMetas({ dados, produto }: { dados: MetasDoMes; produto: Produto }) {
  const router = useRouter();
  const doProduto = dados.metas.filter((m) => m.produtoId === produto.id);
  const inicial = Object.fromEntries(
    dados.vendedores.map((v) => {
      const meta = doProduto.find((m) => m.vendedorId === v.id);
      return [v.id, { valor: meta ? paraCampo(meta.valorAlvo) : "", quantidade: meta?.quantidadeAlvo ? String(meta.quantidadeAlvo) : "" }];
    }),
  ) as Record<string, Linha>;
  const [linhas, setLinhas] = useState(inicial);
  const [estado, executar, salvando] = useActionState(
    async (anterior: EstadoAcao, formData: FormData) => {
      const resultado = await salvarMetasProdutoAcao(anterior, formData);
      if (avisar(resultado)) router.refresh();
      return resultado;
    },
    { ok: false },
  );

  // Total ao vivo do cartão; valor inválido conta zero até ser corrigido.
  const total = totaisMetas(
    Object.entries(linhas).map(([vendedorId, l]) => ({
      produtoId: produto.id,
      vendedorId,
      valorAlvo: lerReais(l.valor || "0") ?? "0",
      quantidadeAlvo: Math.max(0, Math.trunc(Number(l.quantidade) || 0)),
    })),
  ).geral;
  const vendedores = dados.podeEditar ? dados.vendedores : dados.vendedores.filter((v) => doProduto.some((m) => m.vendedorId === v.id));
  const mudar = (id: string, campo: keyof Linha, valor: string) =>
    setLinhas((atual) => ({ ...atual, [id]: { ...atual[id]!, [campo]: valor } }));

  return (
    <form action={executar} className={cn("bg-card grid gap-3 rounded-xl border p-4", !produto.ativo && "border-dashed")}>
      <input type="hidden" name="mes" value={dados.mes} />
      <input type="hidden" name="produtoId" value={produto.id} />
      <div className="flex items-start justify-between gap-2">
        <p className="leading-snug font-medium">{produto.nome}</p>
        {!produto.ativo && <SeloInativo />}
      </div>
      {vendedores.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sem meta neste mês.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="pb-1 font-normal">Vendedor</th>
              <th className="pb-1 font-normal">Valor (R$)</th>
              <th className="w-20 pb-1 font-normal">Qtd.</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v) => (
              <tr key={v.id}>
                <td className="py-1 pr-2">{v.nome}</td>
                {dados.podeEditar ? (
                  <>
                    <td className="py-1 pr-2">
                      <input type="hidden" name="vendedorId" value={v.id} />
                      <Input
                        name="valorAlvo"
                        inputMode="decimal"
                        placeholder="0,00"
                        aria-label={`Valor da meta de ${v.nome}`}
                        value={linhas[v.id]?.valor ?? ""}
                        onChange={(e) => mudar(v.id, "valor", e.target.value)}
                        className="h-8"
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        name="quantidadeAlvo"
                        type="number"
                        min={0}
                        placeholder="0"
                        aria-label={`Quantidade da meta de ${v.nome}`}
                        value={linhas[v.id]?.quantidade ?? ""}
                        onChange={(e) => mudar(v.id, "quantidade", e.target.value)}
                        className="h-8"
                      />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1 pr-2">{formatarReais(lerReais(linhas[v.id]?.valor || "0") ?? "0")}</td>
                    <td className="py-1">{linhas[v.id]?.quantidade || "0"}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          {dados.podeEditar && (
            <tfoot>
              <tr className="border-t font-medium">
                <td className="pt-2">Total do produto</td>
                <td className="pt-2">{formatarReais(total.valor)}</td>
                <td className="pt-2">{total.quantidade}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
      {!estado.ok && estado.erros && (
        <p className="text-destructive text-sm">Confira os valores: use números como 360.000,00 e quantidades inteiras.</p>
      )}
      {dados.podeEditar && vendedores.length > 0 && (
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function BotaoCopiarMetas({ mes, origem }: { mes: string; origem: string }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() => {
        if (!confirm(`Copiar as metas de ${origem}? As metas que já existem neste mês não mudam.`)) return;
        iniciar(async () => {
          if (avisar(await copiarMetasAcao(mes))) router.refresh();
        });
      }}
    >
      <CopyIcon /> Copiar do mês anterior
    </Button>
  );
}

/** Cartões de metas por produto, em prateleiras por tipo, e o total por vendedor. */
export function MetasMes({ dados }: { dados: MetasDoMes }) {
  const totais = totaisMetas(dados.metas);
  if (dados.podeEditar && dados.vendedores.length === 0) {
    return <p className="text-muted-foreground text-sm">Cadastre usuários com o papel Comercial para definir metas.</p>;
  }
  // Quem só consulta vê apenas os produtos em que tem meta.
  const produtos = dados.podeEditar ? dados.produtos : dados.produtos.filter((p) => dados.metas.some((m) => m.produtoId === p.id));
  if (produtos.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma meta definida para você neste mês.</p>;
  return (
    <div className="grid gap-8">
      {PRATELEIRAS.filter((t) => produtos.some((p) => p.tipo === t)).map((tipo) => (
        <section key={tipo} aria-labelledby={`metas-${tipo}`} className="grid gap-3">
          <h2 id={`metas-${tipo}`} className="font-semibold">
            {ROTULO_TIPO_PRODUTO[tipo]}
          </h2>
          <div className="grid gap-3 border-b-4 border-neutral-200 pb-4 md:grid-cols-2 2xl:grid-cols-3">
            {produtos
              .filter((p) => p.tipo === tipo)
              .map((p) => (
                // A chave inclui o mês e as metas salvas para recarregar o cartão ao trocar de mês ou copiar.
                <CartaoMetas
                  key={`${dados.mes}-${p.id}-${JSON.stringify(dados.metas.filter((m) => m.produtoId === p.id))}`}
                  dados={dados}
                  produto={p}
                />
              ))}
          </div>
        </section>
      ))}

      <section aria-labelledby="metas-por-vendedor" className="grid max-w-xl gap-2">
        <h2 id="metas-por-vendedor" className="font-semibold">
          Total por vendedor
        </h2>
        <table className="w-full rounded-md border text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="px-3 py-2 font-normal">Vendedor</th>
              <th className="px-3 py-2 text-right font-normal">Valor</th>
              <th className="px-3 py-2 text-right font-normal">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {dados.vendedores.map((v) => (
              <tr key={v.id} className="border-b last:border-0">
                <td className="px-3 py-2">{v.nome}</td>
                <td className="px-3 py-2 text-right">{formatarReais(totais.porVendedor[v.id]?.valor ?? "0")}</td>
                <td className="px-3 py-2 text-right">{totais.porVendedor[v.id]?.quantidade ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
