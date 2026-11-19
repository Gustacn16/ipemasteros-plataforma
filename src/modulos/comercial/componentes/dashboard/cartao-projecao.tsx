import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { faixaMeta } from "../../regras/dashboard";
import type { DadosProjecao } from "../../servicos/projecao";
import { COR_FAIXA, cartao, reaisCompacto, textoApagado, tituloCartao } from "./estilos";

const reais = (c: number) => (c / 100).toFixed(2);
const inteiro = new Intl.NumberFormat("pt-BR");
const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Dado({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="grid content-start gap-0.5">
      <p className={cn("text-xs", textoApagado)}>{rotulo}</p>
      <p className="text-lg font-semibold whitespace-nowrap text-white">{valor}</p>
      {detalhe && <p className={cn("text-xs", textoApagado)}>{detalhe}</p>}
    </div>
  );
}

/**
 * Para onde o mês está indo: projeção pelos leads (conversão e ticket dos últimos
 * meses) e pelo ritmo de vendas, contra a meta. No mês fechado, o resultado final.
 */
export function CartaoProjecao({ projecao: p }: { projecao: DadosProjecao }) {
  if (p.situacao === "futuro" || p.valor === null) return null;
  const faixa = faixaMeta(p.percentual);
  const fechado = p.situacao === "passado";
  const { base } = p;

  return (
    <section className={cn(cartao, "grid gap-5")} aria-label="Projeção do mês">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={tituloCartao}>{fechado ? "Fechamento do mês" : "Projeção de fechamento"}</h3>
        {!fechado && (
          <p className={cn("text-sm", textoApagado)}>
            Dia {p.diasPassados} de {p.diasDoMes} · {p.diasRestantes === 1 ? "falta 1 dia" : `faltam ${p.diasRestantes} dias`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <p className="text-3xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-4xl">{formatarReais(reais(p.valor))}</p>
        {p.percentual !== null && (
          <p className={cn("text-xl font-semibold", faixa && COR_FAIXA[faixa].texto)}>{p.percentual}% da meta</p>
        )}
        {p.diferenca !== null && (
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              p.diferenca >= 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300",
            )}
          >
            {p.diferenca >= 0 ? "Acima" : "Abaixo"} da meta em {reaisCompacto(reais(Math.abs(p.diferenca)))}
            {fechado ? "" : " (projetado)"}
          </span>
        )}
        {p.percentual === null && <p className={cn("text-sm", textoApagado)}>Sem meta neste mês</p>}
      </div>

      {!fechado && (
        <p className={cn("text-sm", textoApagado)}>
          {p.pelosLeads !== null && (
            <>
              Pelos leads: <span className="text-white">{reaisCompacto(reais(p.pelosLeads))}</span>
              {p.vendasProjetadas !== null && <> ({inteiro.format(Math.round(p.vendasProjetadas))} vendas)</>} ·{" "}
            </>
          )}
          Pelo ritmo de vendas: <span className="text-white">{p.ritmo !== null ? reaisCompacto(reais(p.ritmo)) : "—"}</span>
        </p>
      )}

      {!fechado && (
        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          <Dado rotulo="Falta vender" valor={p.falta > 0 ? reaisCompacto(reais(p.falta)) : "Meta batida"} />
          <Dado rotulo="Por dia, até o fim do mês" valor={p.faltaPorDia !== null ? reaisCompacto(reais(p.faltaPorDia)) : "—"} />
          {p.leads !== null && p.leadsProjetados !== null && (
            <Dado
              rotulo="Leads no mês"
              valor={inteiro.format(p.leads)}
              detalhe={`→ ${inteiro.format(p.leadsProjetados)} no mês, neste ritmo`}
            />
          )}
          <Dado
            rotulo={`Conversão média (${base.meses || "—"} ${base.meses === 1 ? "mês" : "meses"})`}
            valor={base.conversao !== null ? porcento.format(base.conversao) : "—"}
            detalhe={base.conversao !== null ? `${inteiro.format(base.vendas)} vendas ÷ ${inteiro.format(base.leads)} leads` : undefined}
          />
          <Dado rotulo="Ticket médio da base" valor={base.ticket !== null ? reaisCompacto(reais(base.ticket)) : "—"} />
        </div>
      )}

      {!fechado && p.leadsNecessarios !== null && p.leadsProjetados !== null && (
        <p className="text-sm text-white/80">
          Para bater a meta faltam cerca de <strong className="text-white">{inteiro.format(p.leadsNecessarios)} leads</strong> até o fim
          do mês, na conversão média. Neste ritmo devem chegar {inteiro.format(Math.max(p.leadsProjetados - (p.leads ?? 0), 0))}.
        </p>
      )}

      <p className={cn("text-xs", textoApagado)}>
        {p.semLeads === "permissao"
          ? "Projeção pelo ritmo de vendas do mês."
          : p.semLeads === "filtro"
            ? "Com filtro de produto ou vendedor, a projeção é só pelo ritmo de vendas: os leads da Meta ainda não são ligados a produto nem a vendedor."
            : "Leads são os da Meta (formulário, site e conversas no WhatsApp). A conversão divide todas as vendas, de todos os canais, por esses leads, nos meses anteriores que têm leads."}
      </p>
    </section>
  );
}
