import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { GerenciarTipos } from "@/modulos/agenda/componentes/gerenciar-tipos";
import { listarTipos } from "@/modulos/agenda/servicos/tipos";

export const metadata: Metadata = { title: "Configurações da Agenda — IPEMaster OS" };

export default async function PaginaConfiguracoesAgenda() {
  const usuario = await exigirPermissaoPagina("agenda:usar");
  const gerenciaTipos = temPermissao(usuario.papel, "agenda:gerenciar_tipos");
  const tipos = gerenciaTipos ? await listarTipos(usuario, { incluirInativos: true }) : [];

  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <Link href="/agenda" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeftIcon className="size-4" /> Agenda
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Configurações da Agenda</h1>
      </header>
      {gerenciaTipos ? (
        <section className="grid gap-3" aria-labelledby="titulo-tipos">
          <div className="grid gap-1">
            <h2 id="titulo-tipos" className="text-base font-medium">
              Tipos de evento
            </h2>
            <p className="text-muted-foreground text-sm">
              Tipos inativos somem do formulário de novo evento, mas os eventos que já usam o tipo continuam no calendário.
            </p>
          </div>
          <GerenciarTipos tipos={tipos} />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">Nada para configurar por enquanto.</p>
      )}
    </div>
  );
}
