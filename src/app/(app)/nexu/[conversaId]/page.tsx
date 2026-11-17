import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { prisma } from "@/lib/prisma";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { TelaNexu } from "@/modulos/nexu/componentes/tela-nexu";
import { obterConversa } from "@/modulos/nexu/servicos/conversas";
import { mensagensParaTela } from "@/modulos/nexu/servicos/historico";
import { dadosDaTelaNexu } from "../dados";

export const metadata: Metadata = { title: "Nexu — IPEMaster OS" };

export default async function PaginaConversaNexu({ params }: { params: Promise<{ conversaId: string }> }) {
  const ator = await exigirPermissaoPagina("nexu:usar");
  const { conversaId } = await params;
  const [conversa, dados] = await Promise.all([
    obterConversa(ator, conversaId).catch((e: unknown) => (e instanceof ErroNegocio ? null : Promise.reject(e))),
    dadosDaTelaNexu(ator),
  ]);
  if (!conversa) notFound();
  const propostas = await prisma.propostaNexu.findMany({
    where: { conversaId: conversa.id },
    orderBy: { criadoEm: "asc" },
    select: { id: true, toolUseId: true, tipo: true, resumo: true, status: true, erro: true, resultadoUrl: true },
  });
  const mensagens = mensagensParaTela(
    conversa.mensagens.map((m) => ({ id: m.id, papel: m.papel, conteudo: m.conteudo })),
    propostas,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <CabecalhoPagina titulo="Nexu" descricao="Seu assistente de IA. As conversas são só suas e somem após 90 dias sem uso." />
      <TelaNexu key={conversa.id} {...dados} atual={{ id: conversa.id, mensagens }} />
    </div>
  );
}
