import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/componentes/ui/button";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoAcao } from "@/modulos/academico/componentes/campos";
import { excluirDocumentoAcao } from "@/modulos/processos/acoes/processos";
import { EditorDocumento } from "@/modulos/processos/componentes/editor-documento";
import { obterDocumentoParaEditar } from "@/modulos/processos/servicos/documentos";
import { listarOpcoesArea, listarOpcoesPessoas } from "@/modulos/processos/servicos/estrutura";

export const metadata: Metadata = { title: "Editar processo — IPEMaster OS" };

export default async function PaginaEditar({ params }: PageProps<"/processos/documentos/[id]/editar">) {
  const usuario = await exigirPermissaoPagina("processos:editar");
  const { id } = await params;
  let doc;
  try {
    doc = await obterDocumentoParaEditar(usuario, id);
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
  const [areas, pessoas] = await Promise.all([listarOpcoesArea(), listarOpcoesPessoas()]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
            <Link href={`/processos/documentos/${id}`}>
              <ArrowLeftIcon /> Voltar ao documento
            </Link>
          </Button>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">Editar: {doc.titulo}</h1>
          <p className="text-muted-foreground text-sm">
            {doc.area.categoria.nome} · {doc.area.nome}
          </p>
        </div>
        <BotaoAcao
          acao={excluirDocumentoAcao.bind(null, id)}
          rotulo="Excluir documento"
          confirmar={`Excluir "${doc.titulo}"? Ele some para o time (o histórico fica guardado).`}
          irPara="/processos"
          variante="destructive"
        />
      </div>
      <EditorDocumento doc={doc} areas={areas} pessoas={pessoas} />
    </div>
  );
}
