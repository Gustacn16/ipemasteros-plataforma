import type { Metadata } from "next";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { PencilLineIcon } from "lucide-react";
import { rotuloMesLongo } from "@/modulos/planejamento/componentes/formatar";
import { LancarResultados } from "@/modulos/planejamento/componentes/lancar";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { listarParaLancar } from "@/modulos/planejamento/servicos/lancamento";

export const metadata: Metadata = { title: "Lançar resultados — IPEMaster OS" };

export default async function PaginaLancar({ searchParams }: PageProps<"/planejamento/lancar">) {
  const usuario = await exigirPermissaoPagina("planejamento:lancar");
  const { ano, mes, temPlano } = await lerAnoMes(usuario, await searchParams);
  const itens = temPlano ? await listarParaLancar(usuario, ano, mes) : [];
  return (
    <div className="grid gap-4">
      <SeletorAnoMes ano={ano} mes={mes} />
      <p className="text-muted-foreground text-sm">
        Só aparecem os números que a plataforma não tem sozinha. Lance o resultado de <span className="capitalize">{rotuloMesLongo(mes)}</span>; deixar vazio e
        salvar apaga.
      </p>
      {itens.length === 0 ? (
        <EstadoVazio icone={PencilLineIcon} titulo="Nada para lançar" descricao={temPlano ? "Nenhum indicador manual para você neste plano." : `Ainda não há plano para ${ano}.`} />
      ) : (
        <LancarResultados itens={itens} mes={mes} />
      )}
    </div>
  );
}
