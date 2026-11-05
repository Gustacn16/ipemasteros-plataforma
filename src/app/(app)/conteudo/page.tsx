import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { TelaVisaoGeral } from "@/modulos/conteudo/componentes/telas";
import { visaoGeral } from "@/modulos/conteudo/servicos/conteudos";
import { visaoInstagram } from "@/modulos/conteudo/servicos/visao-instagram";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export const metadata: Metadata = { title: "Conteúdo — IPEMaster OS" };

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const filtro = await lerFiltro();
  const [v, instagram] = await Promise.all([
    visaoGeral(usuario, filtro),
    visaoInstagram(usuario, filtro, diaEmSaoPaulo(new Date()).slice(0, 7)),
  ]);
  return (
    <TelaVisaoGeral
      v={v}
      instagram={{ dados: instagram, podeIntegrar: temPermissao(usuario.papel, "conteudo:gerenciar_integracao_instagram") }}
    />
  );
}
