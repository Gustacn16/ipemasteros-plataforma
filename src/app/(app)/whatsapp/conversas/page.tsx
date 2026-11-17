import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { ListaConversas } from "@/modulos/whatsapp/componentes/lista-conversas";
import { listarConversas } from "@/modulos/whatsapp/servicos/conversas";
import { listarNumeros } from "@/modulos/whatsapp/servicos/numeros";

export const metadata: Metadata = { title: "Conversas do WhatsApp — IPEMaster OS" };

const CATEGORIAS = ["aluno", "lead", "equipe", "pessoal", "outro"] as const;

export default async function PaginaConversas({ searchParams }: { searchParams: Promise<{ numero?: string; categoria?: string }> }) {
  const usuario = await exigirUsuario();
  if (!temPermissao(usuario.papel, "whatsapp:ver_equipe") && !temPermissao(usuario.papel, "whatsapp:ver_proprio")) {
    redirect("/inicio?erro=sem-permissao");
  }
  const { numero = "", categoria = "" } = await searchParams;
  const categoriaValida = CATEGORIAS.find((c) => c === categoria);

  const [conversas, numeros] = await Promise.all([
    listarConversas(usuario, { numeroId: numero || undefined, categoria: categoriaValida }),
    listarNumeros(usuario),
  ]);
  const linhas = conversas.map((c) => ({ ...c, ultimaMensagemEm: c.ultimaMensagemEm?.toISOString() ?? null }));

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina titulo="Conversas do WhatsApp" descricao="Conversas individuais dos números conectados." />
      <AbasWhatsapp papel={usuario.papel} ativa="conversas" />
      <ListaConversas
        conversas={linhas}
        numeros={numeros.map((n) => ({ id: n.id, nome: n.nome }))}
        numeroId={numero}
        categoria={categoriaValida ?? ""}
      />
    </div>
  );
}
