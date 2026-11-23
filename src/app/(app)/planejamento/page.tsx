import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { rotuloMesLongo } from "@/modulos/planejamento/componentes/formatar";
import { GraficoMetaRealizado } from "@/modulos/planejamento/componentes/graficos-painel";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { TabelaDesempenho } from "@/modulos/planejamento/componentes/tabela-desempenho";
import { obterPainel } from "@/modulos/planejamento/servicos/visoes";

export const metadata: Metadata = { title: "Planejamento — IPEMaster OS" };

/** Painel "estamos no caminho?": mês e acumulado de cada indicador, e os gráficos de vendas e leads. */
export default async function PaginaPainel({ searchParams }: PageProps<"/planejamento">) {
  const usuario = await exigirPermissaoPagina("planejamento:ver");
  const { ano, mes } = await lerAnoMes(usuario, await searchParams);
  const dados = await obterPainel(usuario, ano, mes);
  if (!dados) {
    return (
      <div className="grid gap-4">
        <SeletorAnoMes ano={ano} />
        <SemPlano ano={ano} editor={temPermissao(usuario.papel, "planejamento:editar")} />
      </div>
    );
  }
  const { noCaminho, comDado, total } = dados.statusGeral;
  const proporcao = comDado ? noCaminho / comDado : null;
  return (
    <div className="grid gap-6">
      <SeletorAnoMes ano={ano} mes={mes} />
      <section
        className={cn(
          "grid gap-1 rounded-xl border p-4",
          proporcao === null || dados.parcial ? "bg-muted/40" : proporcao >= 1 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40" : proporcao >= 0.8 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/40" : "border-red-300 bg-red-50 dark:bg-red-950/40",
        )}
      >
        <p className="text-muted-foreground text-xs tracking-wide uppercase">Status geral · <span className="capitalize">{rotuloMesLongo(mes)}</span>
          {dados.parcial && " · mês em andamento (parcial)"}
        </p>
        {comDado === 0 ? (
          <p className="text-lg font-semibold">Nenhum realizado ainda neste mês.</p>
        ) : (
          <p className="text-lg font-semibold">
            {noCaminho} de {comDado} indicadores no caminho
            <span className="text-muted-foreground text-sm font-normal"> · {total - comDado} ainda sem número</span>
          </p>
        )}
      </section>
      <TabelaDesempenho linhas={dados.linhas} />
      <p className="text-muted-foreground -mt-4 text-xs">O acumulado vai do 1º mês até o escolhido, sem o mês em andamento: a meta dele só é cobrada quando o mês fecha.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <GraficoMetaRealizado titulo="Vendas (R$): meta × realizado" dados={dados.graficoVendas} reais />
        <GraficoMetaRealizado titulo="Leads: necessários × gerados" dados={dados.graficoLeads} rotuloMeta="Necessários" />
      </div>
    </div>
  );
}
