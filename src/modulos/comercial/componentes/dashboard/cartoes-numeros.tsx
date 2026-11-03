import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { faixaMeta, tomVariacao } from "../../regras/dashboard";
import type { DadosDashboard } from "../../servicos/dashboard";
import { COR_FAIXA, cartao, textoApagado } from "./estilos";

const COR_VARIACAO = {
  subiu: "bg-emerald-400/20 text-emerald-300",
  caiu: "bg-rose-400/20 text-rose-300",
  igual: "bg-white/10 text-white/70",
} as const;

function Numero({ rotulo, valor, children }: { rotulo: string; valor: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cartao}>
      <p className={cn("text-sm", textoApagado)}>{rotulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight whitespace-nowrap text-white sm:text-3xl xl:text-[2rem]">{valor}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}

/** Vendido no mês (com variação), vendas, ticket médio e % da meta. */
export function CartoesNumeros({ numeros }: { numeros: DadosDashboard["numeros"] }) {
  const faixa = faixaMeta(numeros.percentualValor);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Numero rotulo="Vendido no mês" valor={formatarReais(numeros.vendido)}>
        {numeros.variacao !== null && (
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", COR_VARIACAO[tomVariacao(numeros.variacao)!])}>
            {numeros.variacao > 0 ? "+" : ""}
            {numeros.variacao}% vs mês passado
          </span>
        )}
      </Numero>
      <Numero rotulo="Vendas" valor={numeros.quantidade}>
        {numeros.metaQuantidade > 0 && <span className={textoApagado}>de {numeros.metaQuantidade} na meta</span>}
      </Numero>
      <Numero rotulo="Ticket médio" valor={numeros.ticket ? formatarReais(numeros.ticket) : "—"} />
      <Numero
        rotulo="% da meta"
        valor={
          <span className={faixa ? COR_FAIXA[faixa].texto : undefined}>
            {numeros.percentualValor === null ? "—" : `${numeros.percentualValor}%`}
          </span>
        }
      >
        <span className={textoApagado}>
          {Number(numeros.metaValor) > 0
            ? `${formatarReais(numeros.vendido)} de ${formatarReais(numeros.metaValor)}`
            : "Sem meta neste mês"}
        </span>
      </Numero>
    </div>
  );
}
