import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { PremissasFunil, PremissasProdutos } from "@/modulos/planejamento/componentes/premissas";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { obterCadastroDoPlano } from "@/modulos/planejamento/servicos/planos";

export const metadata: Metadata = { title: "Premissas do plano — IPEMaster OS" };

export default async function PaginaPremissas({ searchParams }: PageProps<"/planejamento/cadastro/premissas">) {
  const usuario = await exigirPermissaoPagina("planejamento:editar");
  const { ano } = await lerAnoMes(usuario, await searchParams);
  const plano = await obterCadastroDoPlano(usuario, ano);
  return (
    <div className="grid gap-4">
      <SeletorAnoMes ano={ano} />
      {plano ? (
        <>
          <PremissasProdutos plano={plano} />
          <PremissasFunil plano={plano} />
        </>
      ) : (
        <SemPlano ano={ano} editor />
      )}
    </div>
  );
}
