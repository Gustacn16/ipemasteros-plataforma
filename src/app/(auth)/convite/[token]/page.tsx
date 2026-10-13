import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { ROTULO_PAPEL } from "@/lib/permissoes";
import { aceitarConviteAcao } from "@/modulos/core/acoes/autenticacao";
import { buscarConviteValido } from "@/modulos/core/servicos/convites";
import { FormularioSenhaNova } from "../../formulario-senha-nova";

export const metadata: Metadata = { title: "Convite — IPEMaster OS", referrer: "no-referrer" };

export default async function PaginaConvite({ params }: PageProps<"/convite/[token]">) {
  const { token } = await params;
  const convite = await buscarConviteValido(token);

  if (!convite) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Este convite expirou ou já foi usado. Peça um novo convite a quem administra o sistema.{" "}
          <Link href="/login" className="underline">Ir para o login</Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar seu acesso</CardTitle>
        <CardDescription>
          {convite.email} · {ROTULO_PAPEL[convite.papel]}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioSenhaNova
          acao={aceitarConviteAcao}
          rotuloBotao="Criar acesso e entrar"
          nomeInicial={convite.nome}
          camposOcultos={{ token }}
        />
      </CardContent>
    </Card>
  );
}
