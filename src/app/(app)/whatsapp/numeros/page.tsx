import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { ListaNumeros } from "@/modulos/whatsapp/componentes/lista-numeros";
import { NovoNumero } from "@/modulos/whatsapp/componentes/novo-numero";
import { listarNumeros, listarVendedoresAtivos } from "@/modulos/whatsapp/servicos/numeros";

export const metadata: Metadata = { title: "Números do WhatsApp — IPEMaster OS" };

export default async function PaginaNumeros() {
  const usuario = await exigirUsuario();
  const gestao = temPermissao(usuario.papel, "whatsapp:gerenciar_numeros");
  if (!gestao && !temPermissao(usuario.papel, "whatsapp:conectar_proprio")) redirect("/inicio?erro=sem-permissao");

  const [numeros, vendedores] = await Promise.all([listarNumeros(usuario), gestao ? listarVendedoresAtivos(usuario) : Promise.resolve([])]);
  const linhas = numeros.map((n) => ({
    ...n,
    conectadoEm: n.conectadoEm?.toISOString() ?? null,
    ultimoSinalEm: n.ultimoSinalEm?.toISOString() ?? null,
  }));

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina
        titulo="Números do WhatsApp"
        descricao="Conecte cada número lendo o QR no celular. A escola e cada vendedor têm o seu."
        acoes={gestao ? <NovoNumero vendedores={vendedores} /> : undefined}
      />
      <AbasWhatsapp papel={usuario.papel} ativa="numeros" />
      <ListaNumeros numeros={linhas} podeExcluir={gestao} />
    </div>
  );
}
