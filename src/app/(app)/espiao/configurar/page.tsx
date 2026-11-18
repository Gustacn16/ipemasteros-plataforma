import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { TestarPerfil } from "@/modulos/espiao/componentes/testar-perfil";

export const metadata: Metadata = { title: "Configurar espião — IPEMaster OS" };

export default async function PaginaConfigurarEspiao() {
  await exigirPermissaoPagina("espiao:configurar");
  return (
    <div className="grid gap-6">
      <CabecalhoPagina titulo="Configurar espião" descricao="Concorrentes, páginas acompanhadas, teto de gasto e coletas." />
      <Card>
        <CardHeader>
          <CardTitle>Testar perfil</CardTitle>
          <CardDescription>Mostra o que a Meta devolve de um perfil profissional do Instagram, sem guardar nada.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestarPerfil />
        </CardContent>
      </Card>
    </div>
  );
}
