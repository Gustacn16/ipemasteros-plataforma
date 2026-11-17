import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { MensagensConversa } from "@/modulos/whatsapp/componentes/mensagens-conversa";
import { mensagensDaConversa } from "@/modulos/whatsapp/servicos/conversas";

export const metadata: Metadata = { title: "Conversa do WhatsApp — IPEMaster OS" };

export default async function PaginaConversa({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  let conversa;
  try {
    conversa = await mensagensDaConversa(usuario, id);
  } catch (erro) {
    if (erro instanceof ErroPermissao) redirect("/inicio?erro=sem-permissao");
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }

  // Grupo volta para a lista de grupos; individual, para as conversas.
  const grupo = conversa.tipo === "grupo";

  return (
    <div className="grid max-w-3xl gap-6">
      <CabecalhoPagina
        titulo="Conversa"
        descricao="As últimas 200 mensagens guardadas."
        acoes={
          <Link href={grupo ? "/whatsapp/grupos" : "/whatsapp/conversas"} className="text-sm underline-offset-4 hover:underline">
            {grupo ? "Voltar aos grupos" : "Voltar às conversas"}
          </Link>
        }
      />
      <MensagensConversa mensagens={conversa.mensagens} />
    </div>
  );
}
