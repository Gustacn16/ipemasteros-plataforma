import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { ListaGrupos } from "@/modulos/whatsapp/componentes/lista-grupos";
import { listarGrupos, listarTurmasParaGrupo } from "@/modulos/whatsapp/servicos/conversas";

export const metadata: Metadata = { title: "Grupos do WhatsApp — IPEMaster OS" };

export default async function PaginaGrupos() {
  const usuario = await exigirPermissaoPagina("whatsapp:ver_grupos");
  const [grupos, turmas] = await Promise.all([listarGrupos(usuario), listarTurmasParaGrupo(usuario)]);
  const linhas = grupos.map((g) => ({
    ...g,
    provisoriaAte: g.provisoriaAte?.toISOString() ?? null,
    ultimaMensagemEm: g.ultimaMensagemEm?.toISOString() ?? null,
  }));

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina
        titulo="Grupos do WhatsApp"
        descricao="Marque os grupos que a escola acompanha. Grupos sem acompanhamento guardam só o histórico recente, por 48 horas."
      />
      <AbasWhatsapp papel={usuario.papel} ativa="grupos" />
      <ListaGrupos grupos={linhas} turmas={turmas} />
    </div>
  );
}
