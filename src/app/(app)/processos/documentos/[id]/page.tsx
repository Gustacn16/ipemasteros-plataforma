import { ArrowLeftIcon, ArrowRightIcon, CalendarClockIcon, FileTextIcon, HistoryIcon, Link2Icon, PencilIcon, WorkflowIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { formatarData } from "@/modulos/processos/componentes/datas";
import { FichaProcesso } from "@/modulos/processos/componentes/ficha";
import { Fluxograma } from "@/modulos/processos/componentes/fluxograma";
import { Sumario } from "@/modulos/processos/componentes/sumario";
import { TextoProcesso } from "@/modulos/processos/componentes/texto-processo";
import { ROTULO_TIPO_DOCUMENTO } from "@/modulos/processos/esquemas/processos";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { obterDocumento } from "@/modulos/processos/servicos/documentos";
import { documentosEmOrdem, obterArvore } from "@/modulos/processos/servicos/estrutura";
import { extrairSumario, vizinhos, type ItemSumario } from "@/modulos/processos/regras/sumario";

export const metadata: Metadata = { title: "Processo — IPEMaster OS" };

async function carregar(id: string) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  try {
    return { usuario, doc: await obterDocumento(usuario, id) };
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
}

export default async function PaginaDocumento({ params }: PageProps<"/processos/documentos/[id]">) {
  const { id } = await params;
  const { usuario, doc } = await carregar(id);
  const editor = podeEditar(usuario);
  const processo = doc.tipo === "processo";
  const arvore = await obterArvore(usuario);
  const { anterior, proximo } = vizinhos(documentosEmOrdem(arvore), id);
  const vazio = !doc.conteudo && doc.fluxo.length === 0 && !doc.objetivo;
  const temFicha = processo && Boolean(doc.objetivo || doc.donoNome || doc.entradas || doc.saidas);
  const temFluxo = processo && doc.fluxo.length > 0;
  const sumario: ItemSumario[] = [
    ...(temFicha ? [{ nivel: 2 as const, texto: "Ficha do processo", id: "ficha" }] : []),
    ...(temFluxo ? [{ nivel: 2 as const, texto: "Fluxo do processo", id: "titulo-fluxo" }] : []),
    ...(doc.conteudo && processo ? [{ nivel: 2 as const, texto: "Procedimento", id: "procedimento" }] : []),
    ...extrairSumario(doc.conteudo),
  ];

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_13rem]">
    <article className="grid min-w-0 content-start gap-8">
      <header className="grid gap-3">
        <nav aria-label="Caminho" className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          <Link href="/processos" className="hover:text-foreground">
            Processos
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/processos#cat-${doc.area.categoria.id}`} className="hover:text-foreground">
            {doc.area.categoria.nome}
          </Link>
          <span aria-hidden>/</span>
          <Link href={`/processos#area-${doc.area.id}`} className="hover:text-foreground">
            {doc.area.nome}
          </Link>
        </nav>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid min-w-0 gap-2">
            <h1 className="text-foreground flex items-start gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {doc.titulo}
            </h1>
            {doc.resumo && <p className="text-muted-foreground max-w-3xl">{doc.resumo}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <ChipSituacao icone={processo ? WorkflowIcon : FileTextIcon} tom="informacao" tamanho="sm">
                {ROTULO_TIPO_DOCUMENTO[doc.tipo]}
              </ChipSituacao>
              {doc.versaoPublicada > 0 ? (
                <ChipSituacao tamanho="sm">
                  Versão {doc.versaoPublicada} · {formatarData(doc.publicadoEm!)}
                </ChipSituacao>
              ) : (
                <ChipSituacao tom="atencao" tamanho="sm">
                  Rascunho
                </ChipSituacao>
              )}
              {doc.revisaoVencida ? (
                <ChipSituacao tom="atencao" icone={CalendarClockIcon} tamanho="sm">
                  Revisão vencida
                </ChipSituacao>
              ) : doc.proximaRevisao ? (
                <span className="text-muted-foreground text-xs">Próxima revisão: {formatarData(doc.proximaRevisao)}</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {doc.versaoPublicada > 0 && (
              <Button variant="outline" asChild>
                <Link href={`/processos/documentos/${id}/historico`}>
                  <HistoryIcon /> Histórico
                </Link>
              </Button>
            )}
            {editor && (
              <Button asChild>
                <Link href={`/processos/documentos/${id}/editar`}>
                  <PencilIcon /> Editar
                </Link>
              </Button>
            )}
          </div>
        </div>
        {editor && doc.mostrandoRascunho && (
          <Alert>
            <AlertDescription>
              {doc.versaoPublicada === 0
                ? "Este documento ainda não foi publicado: só a gestão vê. Edite e clique em Publicar quando estiver pronto."
                : `Você está vendo o rascunho, com alterações ainda não publicadas (salvo por ${doc.atualizadoPor}). O time vê a versão ${doc.versaoPublicada}.`}
            </AlertDescription>
          </Alert>
        )}
      </header>

      {vazio && (
        <EstadoVazio
          icone={processo ? WorkflowIcon : FileTextIcon}
          titulo="Documento em branco"
          descricao={editor ? "Clique em Editar para escrever o padrão, montar o fluxo e o texto." : "Ainda não há conteúdo."}
        />
      )}

      {temFicha && (
        <div id="ficha" className="scroll-mt-6">
          <FichaProcesso doc={doc} />
        </div>
      )}

      {temFluxo && (
        <section aria-labelledby="titulo-fluxo" className="grid gap-3">
          <h2 id="titulo-fluxo" className="text-foreground scroll-mt-6 text-lg font-semibold tracking-tight">
            Fluxo do processo
          </h2>
          <Fluxograma etapas={doc.fluxo} />
        </section>
      )}

      {doc.conteudo && (
        <section aria-label="Texto" className={processo ? "grid gap-3" : undefined}>
          {processo && (
            <h2 id="procedimento" className="text-foreground scroll-mt-6 text-lg font-semibold tracking-tight">
              Procedimento
            </h2>
          )}
          <div className="bg-card rounded-2xl border p-5 sm:p-8">
            <TextoProcesso texto={doc.conteudo} />
          </div>
        </section>
      )}

      <footer className="grid gap-3 border-t pt-4 text-sm">
        {doc.citadoPor.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Link2Icon className="text-muted-foreground size-4" aria-hidden />
            <span className="text-muted-foreground">Citado por:</span>
            {doc.citadoPor.map((c) => (
              <Link key={c.id} href={`/processos/documentos/${c.id}`} className="bg-muted hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-0.5 text-xs font-medium">
                {c.titulo}
              </Link>
            ))}
          </div>
        )}
        {doc.ultimaPublicacao && (
          <p className="text-muted-foreground text-xs">
            Publicado por {doc.ultimaPublicacao.por} em {formatarData(doc.ultimaPublicacao.em)} — “{doc.ultimaPublicacao.nota}”
          </p>
        )}
      </footer>

      {(anterior || proximo) && (
        <nav aria-label="Outros documentos" className="grid gap-3 sm:grid-cols-2">
          {anterior ? (
            <Link href={`/processos/documentos/${anterior.id}`} className="bg-card hover:border-primary/50 grid gap-0.5 rounded-xl border px-4 py-3 transition-colors">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <ArrowLeftIcon className="size-3" aria-hidden /> Anterior · {anterior.caminho}
              </span>
              <span className="truncate font-medium">{anterior.titulo}</span>
            </Link>
          ) : (
            <span />
          )}
          {proximo && (
            <Link href={`/processos/documentos/${proximo.id}`} className="bg-card hover:border-primary/50 grid gap-0.5 rounded-xl border px-4 py-3 text-right transition-colors">
              <span className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
                Próximo · {proximo.caminho} <ArrowRightIcon className="size-3" aria-hidden />
              </span>
              <span className="truncate font-medium">{proximo.titulo}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
    <Sumario itens={sumario} />
    </div>
  );
}
