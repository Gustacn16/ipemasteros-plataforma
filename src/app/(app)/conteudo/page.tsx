import { redirect } from "next/navigation";

/** O Conteúdo abre nos Relatórios do Instagram (a antiga visão geral saiu em 2026-11-19). */
export default function PaginaConteudo() {
  redirect("/conteudo/relatorios");
}
