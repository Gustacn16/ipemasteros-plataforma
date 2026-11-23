import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { IndicadoresCadastro } from "@/modulos/planejamento/componentes/indicadores-cadastro";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { hojeSp } from "@/modulos/planejamento/servicos/acesso";
import { listarIndicadoresDoPlano, listarOpcoesDoIndicador, mesCriacaoDoPlano } from "@/modulos/planejamento/servicos/indicadores";
import { idDoPlano } from "@/modulos/planejamento/servicos/planos";

export const metadata: Metadata = { title: "Indicadores do plano — IPEMaster OS" };

export default async function PaginaIndicadores({ searchParams }: PageProps<"/planejamento/cadastro/indicadores">) {
  const usuario = await exigirPermissaoPagina("planejamento:editar");
  const { ano } = await lerAnoMes(usuario, await searchParams);
  const planoId = await idDoPlano(ano);
  if (!planoId) {
    return (
      <div className="grid gap-4">
        <SeletorAnoMes ano={ano} />
        <SemPlano ano={ano} editor />
      </div>
    );
  }
  const [indicadores, opcoes, mesCriacao] = await Promise.all([listarIndicadoresDoPlano(usuario, planoId), listarOpcoesDoIndicador(), mesCriacaoDoPlano(planoId)]);
  return (
    <div className="grid gap-4">
      <SeletorAnoMes ano={ano} />
      <p className="text-muted-foreground text-sm">
        Clique num indicador para mudar nome, responsável, de onde vem o realizado e as metas de cada mês. Os do Comercial têm a meta calculada pelo plano.
      </p>
      <IndicadoresCadastro planoId={planoId} ano={ano} hoje={hojeSp()} mesCriacao={mesCriacao} indicadores={indicadores} opcoes={opcoes} />
    </div>
  );
}
