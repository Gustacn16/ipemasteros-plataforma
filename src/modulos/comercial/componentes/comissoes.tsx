"use client";

import { CalculatorIcon, CheckIcon, PercentIcon, WalletIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { Input } from "@/componentes/ui/input";
import { formatarReais, lerReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { Avatares } from "@/modulos/tarefas/componentes/exibicao";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarComissoesAcao } from "../acoes/comissoes";
import type { TipoComissao } from "../esquemas/produto";
import type { ComissaoVendedor } from "../regras/comissao";
import type { DadosComissoes } from "../servicos/comissoes";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const taxaTexto = (tipo: TipoComissao | null, taxa: string) =>
  tipo === "percentual" ? `${numero.format(Number(taxa))}% do VTC` : formatarReais(taxa);
const vendasTexto = (n: number) => `${n} ${n === 1 ? "venda" : "vendas"}`;

/** "Ver cálculo": a conta de cada produto do vendedor, para conferir. */
function VerCalculo({ vendedor }: { vendedor: ComissaoVendedor }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setAberto(true)}>
        <CalculatorIcon className="size-3.5" /> ver cálculo
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cálculo da comissão: {vendedor.nome}</DialogTitle>
            <DialogDescription>
              Quem bate a meta (em quantidade) de um produto no mês ganha o bônus em todas as vendas desse produto; senão, vale a base.
            </DialogDescription>
          </DialogHeader>
          {vendedor.produtos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma venda neste mês.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th className="py-2 pr-2 font-normal">Produto</th>
                    <th className="py-2 pr-2 text-right font-normal">Vendas / meta</th>
                    <th className="py-2 pr-2 font-normal">Regra</th>
                    <th className="py-2 pr-2 text-right font-normal">Vendido</th>
                    <th className="py-2 text-right font-normal">Comissão</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {vendedor.produtos.map((p) => (
                    <tr key={p.produtoId} className="border-b last:border-0">
                      <td className="py-2 pr-2">{p.nome}</td>
                      <td className="py-2 pr-2 text-right">
                        {p.vendas} / {p.meta || "—"}
                      </td>
                      <td className="py-2 pr-2">
                        {p.tipo ? (
                          <span className="inline-flex items-center gap-1">
                            {p.bateuMeta ? "Bônus" : "Base"}: {taxaTexto(p.tipo, p.taxa)}
                            {p.bateuMeta && <CheckIcon className="size-3.5 text-green-600" aria-label="Bateu a meta" />}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem regra</span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right">{formatarReais(p.vendido)}</td>
                      <td className="py-2 text-right font-medium">{formatarReais(p.comissao)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="pt-2" colSpan={3}>
                      Total
                    </td>
                    <td className="pt-2 pr-2 text-right">{formatarReais(vendedor.totalVendido)}</td>
                    <td className="pt-2 text-right">{formatarReais(vendedor.comissao)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CartaoVendedor({ v }: { v: DadosComissoes["vendedores"][number] }) {
  return (
    <article className="bg-card grid min-w-0 gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatares pessoas={[{ id: v.id, nome: v.nome, imagem: v.imagem }]} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{v.nome}</p>
          <p className="text-muted-foreground text-xs">{vendasTexto(v.vendas)} no mês</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-muted-foreground text-xs">Total vendido</p>
          <p className="font-semibold text-green-600 tabular-nums">{formatarReais(v.totalVendido)}</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex flex-wrap items-center justify-between gap-1">
            <p className="text-muted-foreground text-xs">Comissão</p>
            <VerCalculo vendedor={v} />
          </div>
          <p className="text-primary font-semibold tabular-nums">{formatarReais(v.comissao)}</p>
        </div>
      </div>
    </article>
  );
}

type Linha = { tipo: TipoComissao; base: string; bonus: string };
/** "1.25" → "1,25" para o campo; zero vira vazio. */
const paraCampo = (v: string) => (Number(v) === 0 ? "" : numero.format(Number(v)));

/** Tabela "Comissão por produto": R$ fixo por venda ou % do valor total do contrato, com base e bônus de meta. */
function ComissaoPorProduto({ produtos }: { produtos: DadosComissoes["produtos"] }) {
  const inicial = Object.fromEntries(produtos.map((p) => [p.id, { tipo: p.tipo, base: paraCampo(p.base), bonus: paraCampo(p.bonus) }]));
  const [linhas, setLinhas] = useState<Record<string, Linha>>(inicial);
  const [pendente, iniciar] = useTransition();
  const mudou = JSON.stringify(linhas) !== JSON.stringify(inicial);
  const mudar = (id: string, dados: Partial<Linha>) => setLinhas((l) => ({ ...l, [id]: { ...l[id]!, ...dados } }));
  const invalido = Object.values(linhas).some(
    (l) =>
      [l.base, l.bonus].some((v) => v.trim() && lerReais(v) === null) ||
      (l.tipo === "percentual" && [l.base, l.bonus].some((v) => Number(lerReais(v || "0")) > 100)),
  );

  function salvar() {
    iniciar(async () => {
      avisar(
        await salvarComissoesAcao({
          linhas: Object.entries(linhas).map(([produtoId, l]) => ({
            produtoId,
            comissaoTipo: l.tipo,
            comissaoBase: l.base,
            comissaoBonus: l.bonus,
          })),
        }),
      );
    });
  }

  return (
    <section aria-labelledby="sec-regras" className="bg-card grid gap-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="sec-regras" className="font-semibold">
            Comissão por produto
          </h2>
          <p className="text-muted-foreground text-sm">
            R$ fixo por venda ou % do valor total do contrato (VTC). O bônus vale quando o vendedor bate a meta do produto.
          </p>
        </div>
        <Button size="sm" onClick={salvar} disabled={pendente || !mudou || invalido}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      {invalido && <p className="text-destructive text-sm">Confira os valores: use números como 450 ou 1,25, e percentual até 100.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-muted-foreground text-left text-xs">
            <tr className="border-b">
              <th className="py-2 pr-2 font-normal">Produto</th>
              <th className="w-36 py-2 pr-2 font-normal">Tipo</th>
              <th className="w-28 py-2 pr-2 font-normal">Base</th>
              <th className="w-28 py-2 font-normal">Bônus meta</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => {
              const l = linhas[p.id]!;
              const unidade = l.tipo === "percentual" ? "%" : "R$";
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{p.nome}</td>
                  <td className="py-1.5 pr-2">
                    <select
                      aria-label={`Tipo de comissão de ${p.nome}`}
                      value={l.tipo}
                      onChange={(e) => mudar(p.id, { tipo: e.target.value as TipoComissao })}
                      className="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
                    >
                      <option value="valor">R$ fixo</option>
                      <option value="percentual">% do VTC</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      inputMode="decimal"
                      aria-label={`Base de ${p.nome}`}
                      placeholder={unidade}
                      value={l.base}
                      onChange={(e) => mudar(p.id, { base: e.target.value })}
                      className="h-8 text-right"
                    />
                  </td>
                  <td className="py-1.5">
                    <Input
                      inputMode="decimal"
                      aria-label={`Bônus de meta de ${p.nome}`}
                      placeholder={unidade}
                      value={l.bonus}
                      onChange={(e) => mudar(p.id, { bonus: e.target.value })}
                      className="h-8 text-right"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Aba Comissões: total vendido, comissões do mês, cartões por vendedor e as regras por produto. */
export function Comissoes({ dados }: { dados: DadosComissoes }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <CartaoNumero rotulo="Total vendido" icone={WalletIcon} valor={formatarReais(dados.totalVendido)} />
        <CartaoNumero
          rotulo={dados.equipe ? "Comissões do mês" : "Sua comissão no mês"}
          icone={PercentIcon}
          valor={formatarReais(dados.totalComissao)}
        >
          Calculadas a partir das vendas registradas
        </CartaoNumero>
      </div>
      <section aria-labelledby="sec-vendedores" className="grid gap-3">
        <h2 id="sec-vendedores" className="font-semibold">
          {dados.equipe ? "Vendedores por comissão" : "Sua comissão"}
        </h2>
        <div className={cn("grid gap-3", dados.vendedores.length > 1 && "md:grid-cols-2 xl:grid-cols-3")}>
          {dados.vendedores.map((v) => (
            <CartaoVendedor key={v.id} v={v} />
          ))}
        </div>
      </section>
      {dados.podeEditarRegras && (
        // A key remonta a tabela quando o servidor devolve as regras salvas.
        <ComissaoPorProduto key={JSON.stringify(dados.produtos)} produtos={dados.produtos} />
      )}
    </div>
  );
}
