import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { formatarPct, rotuloMesCurto } from "@/modulos/planejamento/componentes/formatar";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { GradeMensal } from "@/modulos/planejamento/componentes/tabela-desempenho";
import { obterPlanoMarketing } from "@/modulos/planejamento/servicos/visoes";

export const metadata: Metadata = { title: "Plano de marketing — IPEMaster OS" };

export default async function PaginaPlanoMarketing({ searchParams }: PageProps<"/planejamento/marketing">) {
  const usuario = await exigirPermissaoPagina("planejamento:ver");
  const { ano, mes } = await lerAnoMes(usuario, await searchParams);
  const d = await obterPlanoMarketing(usuario, ano, mes);
  if (!d) {
    return (
      <div className="grid gap-4">
        <SeletorAnoMes ano={ano} />
        <SemPlano ano={ano} editor={temPermissao(usuario.papel, "planejamento:editar")} />
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <SeletorAnoMes ano={ano} />
      <section className="bg-card overflow-x-auto rounded-xl border p-3">
        <p className="mb-2 text-sm font-medium">% dos indicadores de marketing batidos no mês</p>
        <div className="grid min-w-[700px] grid-cols-12 gap-1 text-center text-xs">
          {d.batidos.map((b) => (
            <div key={b.mes} className="grid gap-0.5">
              <span className="text-muted-foreground capitalize">{rotuloMesCurto(b.mes)}</span>
              <span className="font-medium tabular-nums">{formatarPct(b.pct)}</span>
            </div>
          ))}
        </div>
      </section>
      {d.grupos.map((g) => (
        <section key={g.grupo || "sem-grupo"} className="grid gap-2">
          <h2 className="font-semibold">{g.grupo || "Outros"}</h2>
          <GradeMensal linhas={g.linhas} meses={d.meses} />
        </section>
      ))}
    </div>
  );
}
