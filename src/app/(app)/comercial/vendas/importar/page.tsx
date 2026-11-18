import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { ImportadorHistorico } from "@/modulos/comercial/componentes/importador-historico";

export const metadata: Metadata = { title: "Importar histórico — IPEMaster OS" };

export default async function PaginaImportarHistorico() {
  await exigirPermissaoPagina("comercial:importar_historico");
  return (
    <div className="grid gap-6">
      <Link href="/comercial/vendas" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Vendas
      </Link>
      <h2 className="text-xl font-semibold">Importar histórico da plataforma antiga</h2>
      <ImportadorHistorico />
    </div>
  );
}
