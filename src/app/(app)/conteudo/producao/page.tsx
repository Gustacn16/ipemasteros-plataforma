import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { TelaProducao, VISOES_PRODUCAO, type VisaoProducao } from "@/modulos/conteudo/componentes/telas";
import { listarCalendario, listarQuadro } from "@/modulos/conteudo/servicos/conteudos";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export const metadata: Metadata = { title: "Produção — IPEMaster OS" };

/** Produção do conteúdo: `?visao=` quadro (padrão), lista ou calendario; o calendário usa `?mes=`. */
export default async function PaginaProducao({ searchParams }: PageProps<"/conteudo/producao">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const visao: VisaoProducao = VISOES_PRODUCAO.find((v) => v === busca.visao) ?? "quadro";
  if (visao === "calendario") {
    const mes = lerMes(busca);
    const { grade, itens } = await listarCalendario(usuario, mes, filtro);
    return <TelaProducao visao="calendario" mes={mes} grade={grade} itens={itens} hoje={diaEmSaoPaulo(new Date())} />;
  }
  return <TelaProducao visao={visao} quadro={await listarQuadro(usuario, filtro)} />;
}
