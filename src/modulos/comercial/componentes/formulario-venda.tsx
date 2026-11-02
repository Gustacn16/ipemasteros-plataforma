"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Label } from "@/componentes/ui/label";
import { formatarReais, lerReais } from "@/lib/dinheiro";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirVendaAcao, salvarVendaAcao } from "../acoes/vendas";
import { FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO } from "../esquemas/produto";
import { preencherPelaOferta, valorTotal } from "../regras/venda";
import type { ProdutoParaVenda } from "../servicos/produtos";
import type { LinhaVenda } from "../servicos/vendas";
import { estiloCampo, estiloSelect } from "./exibicao";
import { opcoesDoFormulario } from "./opcoes-venda";

type Pessoa = { id: string; nome: string };

export type OpcoesVenda = {
  produtos: ProdutoParaVenda[];
  vendedores: Pessoa[];
  canais: Pessoa[];
  usuario: Pessoa;
  podeEscolherVendedor: boolean;
  /** "AAAA-MM-DD" de hoje em São Paulo. */
  hoje: string;
};

type Props = OpcoesVenda & {
  venda: LinhaVenda | null;
  somenteLeitura: boolean;
  fechar: () => void;
};

/** "2000.00" → "2.000,00", para os campos de reais. */
const paraCampo = (v: string) => formatarReais(v).replace("R$ ", "");

function Selecao({
  id,
  rotulo,
  obrigatorio,
  erros,
  children,
  ...props
}: React.ComponentProps<"select"> & { rotulo: string; obrigatorio?: boolean; erros?: string[] }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span className="text-destructive">*</span>}
      </Label>
      <select id={id} className={`${estiloSelect} w-full`} aria-invalid={erros?.length ? true : undefined} {...props}>
        {children}
      </select>
      {erros?.length ? <p className="text-destructive text-sm">{erros.join(" ")}</p> : null}
    </div>
  );
}

/** Formulário de venda na ordem que a equipe já usa. Escolher produto ou oferta preenche o pagamento. */
export function FormularioVenda({
  produtos,
  vendedores,
  canais,
  usuario,
  podeEscolherVendedor,
  hoje,
  venda,
  somenteLeitura,
  fechar,
}: Props) {
  const router = useRouter();
  const [estado, executar, salvando] = useActionState(salvarVendaAcao, { ok: false });
  const [excluindo, iniciarExclusao] = useTransition();

  // Venda antiga: produto, oferta, vendedor e canal desativados depois continuam como opção.
  const opcoes = opcoesDoFormulario({ produtos, vendedores: podeEscolherVendedor ? vendedores : [usuario], canais, venda });
  const opcoesProduto = opcoes.produtos;
  const opcoesCanal = opcoes.canais;
  const opcoesVendedor = opcoes.vendedores;

  const [produtoId, setProdutoId] = useState(venda?.produtoId ?? "");
  const [ofertaId, setOfertaId] = useState(venda?.ofertaId ?? "");
  const [entrada, setEntrada] = useState(venda ? paraCampo(venda.entrada) : "");
  const [parcelas, setParcelas] = useState(venda ? String(venda.numeroParcelas) : "1");
  const [valorParcela, setValorParcela] = useState(venda ? paraCampo(venda.valorParcela) : "");

  const ofertas = opcoesProduto.find((p) => p.id === produtoId)?.ofertas ?? [];

  function aplicarOferta(id: string) {
    setOfertaId(id);
    const oferta = ofertas.find((o) => o.id === id);
    // Oferta sem preço (ex.: a de um produto desativado) não muda os valores já digitados.
    if (!oferta || Number(oferta.precoCheio) === 0) return;
    const pagamento = preencherPelaOferta(oferta);
    setEntrada(paraCampo(pagamento.entrada));
    setParcelas(String(pagamento.numeroParcelas));
    setValorParcela(paraCampo(pagamento.valorParcela));
  }

  function escolherProduto(id: string) {
    setProdutoId(id);
    const doProduto = opcoesProduto.find((p) => p.id === id)?.ofertas ?? [];
    const padrao = doProduto.find((o) => o.padrao) ?? doProduto[0];
    if (!padrao) {
      setOfertaId("");
      return;
    }
    setOfertaId(padrao.id);
    const pagamento = preencherPelaOferta(padrao);
    setEntrada(paraCampo(pagamento.entrada));
    setParcelas(String(pagamento.numeroParcelas));
    setValorParcela(paraCampo(pagamento.valorParcela));
  }

  // Total ao vivo; campo inválido conta como zero até ser corrigido.
  const total = valorTotal(
    lerReais(entrada || "0") ?? "0",
    Math.max(0, Math.trunc(Number(parcelas) || 0)),
    lerReais(valorParcela || "0") ?? "0",
  );

  useEffect(() => {
    if (estado.ok) {
      avisar(estado);
      fechar();
      router.refresh();
    }
  }, [estado, fechar, router]);
  const e = estado.erros;

  return (
    <form action={executar} className="grid gap-4">
      {venda && <input type="hidden" name="id" value={venda.id} />}
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={somenteLeitura} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            id="v-produto"
            name="produtoId"
            rotulo="Produto"
            obrigatorio
            value={produtoId}
            onChange={(ev) => escolherProduto(ev.target.value)}
            erros={e?.produtoId}
          >
            <option value="">Selecione o produto</option>
            {opcoesProduto.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="Data da venda *"
            name="dataVenda"
            type="date"
            defaultValue={venda?.dataVenda ?? hoje}
            erros={e?.dataVenda}
            required
          />
          <Selecao
            id="v-vendedor"
            name="vendedorId"
            rotulo="Vendedor"
            obrigatorio
            defaultValue={venda?.vendedorId ?? (podeEscolherVendedor ? "" : usuario.id)}
            erros={e?.vendedorId}
          >
            {podeEscolherVendedor && <option value="">Selecione o vendedor</option>}
            {opcoesVendedor.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </Selecao>
          <Campo
            rotulo="Data que o lead entrou"
            name="dataEntradaLead"
            type="date"
            defaultValue={venda?.dataEntradaLead ?? ""}
            erros={e?.dataEntradaLead}
          />
        </div>
        <Campo
          rotulo="Nome do cliente *"
          name="nomeCliente"
          placeholder="Ex.: Dr. João Silva"
          defaultValue={venda?.nomeCliente ?? ""}
          erros={e?.nomeCliente}
          required
        />
        <Campo
          rotulo="WhatsApp"
          name="whatsappCliente"
          inputMode="tel"
          placeholder="Ex.: (11) 99999-9999"
          defaultValue={venda?.whatsappCliente ?? ""}
          erros={e?.whatsappCliente}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao id="v-canal" name="canalId" rotulo="Canal" defaultValue={venda?.canalId ?? ""} erros={e?.canalId}>
            <option value="">Selecione o canal</option>
            {opcoesCanal.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
          <Campo rotulo="Data de entrega" name="dataEntrega" type="date" defaultValue={venda?.dataEntrega ?? ""} erros={e?.dataEntrega} />
        </div>

        <div className="bg-muted/30 grid gap-4 rounded-lg border p-4">
          <p className="font-medium">Forma de pagamento</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Selecao
              id="v-oferta"
              name="ofertaId"
              rotulo="Oferta"
              value={ofertaId}
              onChange={(ev) => aplicarOferta(ev.target.value)}
              disabled={ofertas.length === 0}
            >
              <option value="">{ofertas.length === 0 ? "Sem ofertas" : "Sem oferta"}</option>
              {ofertas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </Selecao>
            <Selecao
              id="v-metodo"
              name="metodoPagamento"
              rotulo="Método"
              obrigatorio
              defaultValue={venda?.metodoPagamento ?? ""}
              erros={e?.metodoPagamento}
            >
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f} value={f}>
                  {ROTULO_FORMA_PAGAMENTO[f]}
                </option>
              ))}
            </Selecao>
            <Campo
              rotulo="Entrada"
              name="entrada"
              inputMode="decimal"
              placeholder="0,00"
              value={entrada}
              onChange={(ev) => setEntrada(ev.target.value)}
              erros={e?.entrada}
            />
            <Campo
              rotulo="Nº de parcelas"
              name="numeroParcelas"
              type="number"
              min={0}
              max={60}
              value={parcelas}
              onChange={(ev) => setParcelas(ev.target.value)}
              erros={e?.numeroParcelas}
            />
            <Campo
              rotulo="Valor da parcela"
              name="valorParcela"
              inputMode="decimal"
              placeholder="0,00"
              value={valorParcela}
              onChange={(ev) => setValorParcela(ev.target.value)}
              erros={e?.valorParcela}
            />
            <Campo
              rotulo="1º vencimento"
              name="primeiroVencimento"
              type="date"
              defaultValue={venda?.primeiroVencimento ?? ""}
              erros={e?.primeiroVencimento}
              ajuda="Se vazio, vale a data da venda."
            />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-muted-foreground">Valor total da venda</span>
            <span className="text-xl font-semibold text-green-600">{formatarReais(total)}</span>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="v-observacoes">Observações</Label>
          <textarea
            id="v-observacoes"
            name="observacoes"
            rows={3}
            placeholder="Detalhes adicionais sobre a venda…"
            defaultValue={venda?.observacoes ?? ""}
            maxLength={2000}
            className={estiloCampo}
          />
          {e?.observacoes?.length ? <p className="text-destructive text-sm">{e.observacoes.join(" ")}</p> : null}
        </div>
      </fieldset>

      {!somenteLeitura && (
        <div className="flex flex-wrap justify-between gap-2">
          {venda ? (
            <Button
              type="button"
              variant="destructive"
              disabled={excluindo}
              onClick={() => {
                if (!confirm("Excluir esta venda?")) return;
                iniciarExclusao(async () => {
                  if (avisar(await excluirVendaAcao(venda.id))) {
                    fechar();
                    router.refresh();
                  }
                });
              }}
            >
              Excluir venda
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : venda ? "Salvar alterações" : "Registrar venda"}
          </Button>
        </div>
      )}
    </form>
  );
}
