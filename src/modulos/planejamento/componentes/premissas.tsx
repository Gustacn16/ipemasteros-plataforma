"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { formatarReais } from "@/lib/dinheiro";
import { lerNumero } from "@/lib/numeros";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { removerPremissaProdutoAcao, salvarPremissaProdutoAcao, salvarPremissasFunilAcao } from "../acoes/planejamento";
import { conversaoGeral } from "../regras/funil";
import type { CadastroDoPlano } from "../servicos/planos";
import { formatarPct } from "./formatar";
import { CampoReais, CampoSimples, Escolha, paraCampo, pctCampo, useAcao } from "./ui-plano";

export function PremissasFunil({ plano }: { plano: CadastroDoPlano }) {
  const [estado, executar, salvando] = useAcao(salvarPremissasFunilAcao);
  const p = plano.premissasFunil;
  const e = estado.erros ?? {};
  // Conversão geral recalculada enquanto digita.
  const [taxas, setTaxas] = useState({ convLeadAgendada: pctCampo(p.convLeadAgendada), comparecimento: pctCampo(p.comparecimento), convReuniaoVenda: pctCampo(p.convReuniaoVenda) });
  const fracao = (v: string) => (lerNumero(v) ?? 0) / 100;
  const geral = conversaoGeral({ ...p, convLeadAgendada: fracao(taxas.convLeadAgendada), comparecimento: fracao(taxas.comparecimento), convReuniaoVenda: fracao(taxas.convReuniaoVenda) });
  const taxa = (campo: keyof typeof taxas) => ({ name: campo, value: taxas[campo], inputMode: "decimal" as const, onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setTaxas((t) => ({ ...t, [campo]: ev.target.value })) });
  return (
    <form action={executar} className="bg-card grid gap-4 rounded-xl border p-4">
      <input type="hidden" name="planoId" value={plano.id} />
      <div>
        <h2 className="font-semibold">Premissas do funil</h2>
        <p className="text-muted-foreground text-sm">
          Daqui sai, mês a mês, quantos leads, reuniões e quanto de mídia são necessários para bater a meta de vendas.
        </p>
        <p className="mt-2 text-sm">
          Conversão geral (lead → venda): <strong className="text-base">{formatarPct(geral)}</strong>
          <span className="text-muted-foreground"> · calculada sozinha: agendamento × comparecimento × venda{geral > 0 ? `, ou 1 venda a cada ${Math.ceil(1 / geral)} leads` : ""}.</span>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CampoSimples rotulo="Lead → reunião agendada (%)" {...taxa("convLeadAgendada")} erros={e.convLeadAgendada} ajuda="De cada 100 leads, quantos agendam." />
        <CampoSimples rotulo="Comparecimento (%)" {...taxa("comparecimento")} erros={e.comparecimento} ajuda="De cada 100 agendadas, quantas acontecem." />
        <CampoSimples rotulo="Reunião realizada → venda (%)" {...taxa("convReuniaoVenda")} erros={e.convReuniaoVenda} ajuda="De cada 100 reuniões, quantas viram matrícula." />
        <CampoReais rotulo="Custo por lead (R$)" name="custoPorLead" defaultValue={paraCampo(p.custoPorLeadCentavos / 100)} erros={e.custoPorLead} />
        <CampoSimples rotulo="Comissão comercial (% da venda)" name="comissaoPct" defaultValue={pctCampo(p.comissaoPct)} erros={e.comissaoPct} />
        <CampoSimples rotulo="Teto de CAC (% do vendido)" name="tetoCacPct" defaultValue={pctCampo(p.tetoCacPct)} erros={e.tetoCacPct} ajuda="Mídia + comissão não deve passar disso." />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar premissas do funil"}
        </Button>
      </div>
    </form>
  );
}

type Premissa = CadastroDoPlano["premissas"][number];

export function PremissasProdutos({ plano }: { plano: CadastroDoPlano }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Premissa | null>(null);
  const [chave, setChave] = useState(0);
  const limpar = () => {
    setEditando(null);
    setChave((c) => c + 1);
  };
  const [estado, executar, salvando] = useAcao(salvarPremissaProdutoAcao, limpar);
  const [removendo, iniciar] = useTransition();
  const e = estado.erros ?? {};
  const produtoPadrao = plano.produtos.find((p) => p.id === editando?.produtoId);
  return (
    <section className="bg-card grid gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">Premissas por produto</h2>
        <p className="text-muted-foreground text-sm">Cadastre uma vez. As turmas herdam estes números quando os campos delas ficam vazios.</p>
      </div>
      {plano.premissas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 font-normal">Produto</th>
                <th className="py-2 pr-3 text-right font-normal">Contrato médio</th>
                <th className="py-2 pr-3 text-right font-normal">Alunos por turma</th>
                <th className="py-2 pr-3 text-right font-normal">Janela de vendas</th>
                <th className="py-2 pr-3 text-right font-normal">Duração</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {plano.premissas.map((p) => (
                <tr key={p.produtoId} className="border-b last:border-0">
                  <td className="py-2 pr-3">{p.produto}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatarReais(p.contratoMedio)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.alunosPorTurma}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.janelaVendasMeses} meses</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.duracaoMeses} meses</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => { setEditando(p); setChave((c) => c + 1); }}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Tirar ${p.produto}`}
                      disabled={removendo}
                      onClick={() => {
                        if (!confirm(`Tirar ${p.produto} das premissas? As turmas dele passam a usar só os próprios números.`)) return;
                        iniciar(async () => {
                          if (avisar(await removerPremissaProdutoAcao(plano.id, p.produtoId))) router.refresh();
                        });
                      }}
                    >
                      <TrashIcon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form key={chave} action={executar} className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input type="hidden" name="planoId" value={plano.id} />
        <Escolha rotulo="Produto" name="produtoId" defaultValue={editando?.produtoId ?? ""} erros={e.produtoId} className="lg:col-span-2">
          <option value="">Escolha…</option>
          {plano.produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Escolha>
        <CampoReais rotulo="Contrato médio (R$)" name="contratoMedio" defaultValue={paraCampo(editando?.contratoMedio)} erros={e.contratoMedio} />
        <CampoSimples rotulo="Alunos por turma" name="alunosPorTurma" type="number" min={1} defaultValue={editando?.alunosPorTurma ?? ""} erros={e.alunosPorTurma} />
        <CampoSimples rotulo="Janela (meses)" name="janelaVendasMeses" type="number" min={1} defaultValue={editando?.janelaVendasMeses ?? 4} erros={e.janelaVendasMeses} ajuda="Conta o mês de abertura." />
        <CampoSimples rotulo="Duração (meses)" name="duracaoMeses" type="number" min={1} defaultValue={editando?.duracaoMeses ?? produtoPadrao?.duracaoMeses ?? 12} erros={e.duracaoMeses} />
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6 lg:justify-end">
          {editando && (
            <Button type="button" variant="outline" onClick={limpar}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar produto" : "Adicionar produto"}
          </Button>
        </div>
      </form>
    </section>
  );
}
