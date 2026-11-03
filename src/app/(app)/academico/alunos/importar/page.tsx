import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Importador } from "@/modulos/academico/componentes/importador";

export const metadata: Metadata = { title: "Importar alunos — IPEMaster OS" };

export default async function PaginaImportarAlunos() {
  await exigirPermissaoPagina("academico:importar_alunos");
  return (
    <div className="grid gap-6">
      <Link href="/academico/alunos" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Alunos
      </Link>
      <h2 className="text-xl font-semibold">Importar planilha de alunos</h2>
      <Importador />
    </div>
  );
}
