import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";

export const metadata: Metadata = { title: "Espião — IPEMaster OS" };

export default async function PaginaEspiao() {
  const usuario = await exigirPermissaoPagina("espiao:ver");
  return (
    <div className="grid gap-6">
      <CabecalhoPagina titulo="Espião" descricao="O que mudou nos concorrentes nesta semana." />
      <p className="text-muted-foreground text-sm">Em construção.</p>
      {temPermissao(usuario.papel, "espiao:configurar") && (
        <Link href="/espiao/configurar" className="text-sm underline">
          Configurar o espião
        </Link>
      )}
    </div>
  );
}
