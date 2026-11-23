import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { CalendarioTurmas, MetasAvulsas } from "@/modulos/planejamento/componentes/turmas";
import { obterCadastroDoPlano } from "@/modulos/planejamento/servicos/planos";

export const metadata: Metadata = { title: "Turmas do plano — IPEMaster OS" };

export default async function PaginaTurmas({ searchParams }: PageProps<"/planejamento/cadastro/turmas">) {
  const usuario = await exigirPermissaoPagina("planejamento:editar");
  const { ano } = await lerAnoMes(usuario, await searchParams);
  const plano = await obterCadastroDoPlano(usuario, ano);
  return (
    <div className="grid gap-4">
      <SeletorAnoMes ano={ano} />
      {plano ? (
        <>
          <CalendarioTurmas plano={plano} />
          <MetasAvulsas plano={plano} />
        </>
      ) : (
        <SemPlano ano={ano} editor />
      )}
    </div>
  );
}
