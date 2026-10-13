import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { primeiroAcessoAcao } from "@/modulos/core/acoes/autenticacao";
import { primeiroAcessoConfigurado } from "@/modulos/core/servicos/primeiro-acesso";
import { existeAlgumUsuario } from "@/modulos/core/servicos/usuarios";
import { FormularioSenhaNova } from "../formulario-senha-nova";

export const metadata: Metadata = { title: "Primeiro acesso — IPEMaster OS" };

/** Cria o primeiro admin. Some (404) assim que existir qualquer usuário. */
export default async function PaginaPrimeiroAcesso() {
  await connection(); // decide a cada requisição, nunca no build
  if (!primeiroAcessoConfigurado() || (await existeAlgumUsuario())) notFound();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Primeiro acesso</CardTitle>
        <CardDescription>Crie a conta do primeiro administrador do sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioSenhaNova acao={primeiroAcessoAcao} rotuloBotao="Criar admin e entrar" comTokenEEmail />
      </CardContent>
    </Card>
  );
}
