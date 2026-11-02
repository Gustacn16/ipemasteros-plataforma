import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { obterUsuarioAtual } from "@/lib/sessao";
import { completarCadastroAcao, sairAcao } from "@/modulos/core/acoes/autenticacao";
import { FormularioCadastro } from "@/modulos/core/componentes/formulario-cadastro";

export const metadata: Metadata = { title: "Complete seu cadastro — IPEMaster OS" };

/** Etapa obrigatória para contas que ainda não têm dados básicos e foto (o resto do sistema redireciona para cá). */
export default async function PaginaCompletarCadastro() {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  if (usuario.perfilCompleto) redirect("/inicio");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete seu cadastro</CardTitle>
        <CardDescription>
          {usuario.email}. Antes de continuar, preencha seus dados e adicione uma foto.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <FormularioCadastro acao={completarCadastroAcao} rotuloBotao="Salvar e continuar" nomeInicial={usuario.nome} />
        <form action={sairAcao}>
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            Sair
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
