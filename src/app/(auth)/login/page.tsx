import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { obterUsuarioAtual } from "@/lib/sessao";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Entrar — IPEMaster OS" };

export default async function PaginaLogin() {
  if (await obterUsuarioAtual()) redirect("/inicio");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Use o e-mail e a senha do seu convite.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioLogin />
      </CardContent>
    </Card>
  );
}
