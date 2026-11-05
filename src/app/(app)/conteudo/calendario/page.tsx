import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { TelaCalendario } from "@/modulos/conteudo/componentes/telas";
import { listarCalendario } from "@/modulos/conteudo/servicos/conteudos";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export const metadata: Metadata = { title: "Calendário — IPEMaster OS" };

export default async function PaginaCalendario({ searchParams }: PageProps<"/conteudo/calendario">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const mes = lerMes(busca);
  const comGravacoes = busca.gravacoes === "1";
  const { grade, itens } = await listarCalendario(usuario, mes, filtro, comGravacoes);
  return <TelaCalendario mes={mes} comGravacoes={comGravacoes} grade={grade} itens={itens} hoje={diaEmSaoPaulo(new Date())} />;
}
