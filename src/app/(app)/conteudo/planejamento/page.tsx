import { redirect } from "next/navigation";

/** Endereço antigo: Planejamento, Calendário e Gravações viraram a Produção (2026-11-26). */
export default function PaginaAntiga() {
  redirect("/conteudo/producao");
}
