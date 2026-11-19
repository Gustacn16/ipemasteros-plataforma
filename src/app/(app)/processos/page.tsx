import { AlertTriangleIcon, CalendarClockIcon, FileTextIcon, FolderTreeIcon, SearchXIcon, WorkflowIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { formatarData } from "@/modulos/processos/componentes/datas";
import { ICONE_CATEGORIA } from "@/modulos/processos/componentes/icones";
import { NovoDocumento } from "@/modulos/processos/componentes/novo-documento";
import { BotaoAcao } from "@/modulos/academico/componentes/campos";
import { criarEstruturaInicialAcao } from "@/modulos/processos/acoes/processos";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { buscarDocumentos, obterResumos } from "@/modulos/processos/servicos/documentos";
import { listarOpcoesArea, obterArvore } from "@/modulos/processos/servicos/estrutura";
import { obterPainel } from "@/modulos/processos/servicos/indicadores";

export const metadata: Metadata = { title: "Processos internos — IPEMaster OS" };

async function Resultados({ termo }: { termo: string }) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const resultados = await buscarDocumentos(usuario, termo);
  return (
    <section className="grid gap-4" aria-label="Resultados da busca">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {resultados.length} resultado{resultados.length === 1 ? "" : "s"} para “{termo}”
        </h2>
        <Link href="/processos" className="text-primary text-sm">
          Limpar busca
        </Link>
      </div>
      {resultados.length === 0 ? (
        <EstadoVazio icone={SearchXIcon} titulo="Nada encontrado" descricao="Tente outra palavra, ou procure pela árvore ao lado." />
      ) : (
        <ul className="grid gap-2">
          {resultados.map((r) => (
            <li key={r.id}>
              <Link href={`/processos/documentos/${r.id}`} className="bg-card hover:border-primary/50 grid gap-1 rounded-xl border p-4 transition-colors">
                <span className="text-muted-foreground text-xs">{r.caminho}</span>
                <span className="flex items-center gap-2 font-semibold">
                  {r.tipo === "processo" ? <WorkflowIcon className="text-primary size-4" aria-hidden /> : <FileTextIcon className="text-primary size-4" aria-hidden />}
                  {r.titulo}
                </span>
                {r.trecho && <span className="text-muted-foreground line-clamp-2 text-sm">{r.trecho}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PaginaProcessos({ searchParams }: PageProps<"/processos">) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const { busca } = await searchParams;
  const termo = typeof busca === "string" ? busca.trim().slice(0, 100) : "";
  if (termo) return <Resultados termo={termo} />;

  const editor = podeEditar(usuario);
  const [arvore, resumos, painel, areas] = await Promise.all([
    obterArvore(usuario),
    obterResumos(usuario),
    obterPainel(usuario),
    editor ? listarOpcoesArea() : Promise.resolve([]),
  ]);

  if (arvore.length === 0) {
    return (
      <EstadoVazio
        icone={FolderTreeIcon}
        titulo="A área de processos está vazia"
        descricao={
          editor
            ? "Comece pela estrutura sugerida (Institucional, Gestão, Marketing, Comercial e Acadêmico, com rascunhos de Missão, Captura de lead e Funil) ou monte a sua em Organizar."
            : "Os documentos aparecem aqui quando a gestão publicar."
        }
        acao={
          editor && (
            <div className="flex flex-wrap justify-center gap-2">
              <BotaoAcao acao={criarEstruturaInicialAcao} rotulo="Criar estrutura sugerida" />
              <Button asChild variant="ghost">
                <Link href="/processos/organizar">Montar do zero</Link>
              </Button>
            </div>
          )
        }
      />
    );
  }

  const foraDaMeta = painel.filter((i) => i.situacao === "fora_da_meta");
  const atrasados = painel.filter((i) => i.situacao === "atrasado");
  const totalDocs = arvore.reduce((n, c) => n + c.areas.reduce((m, a) => m + a.documentos.length, 0), 0);
  const totalProcessos = arvore.reduce((n, c) => n + c.areas.reduce((m, a) => m + a.documentos.filter((d) => d.tipo === "processo").length, 0), 0);

  return (
    <div className="grid gap-8">
      {editor && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {resumos.rascunhos > 0 ? `${resumos.rascunhos} documento${resumos.rascunhos === 1 ? "" : "s"} ainda em rascunho (o time não vê).` : "Tudo publicado."}
          </p>
          <NovoDocumento areas={areas} />
        </div>
      )}

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoNumero rotulo="Documentos" icone={FileTextIcon} valor={totalDocs} />
        <CartaoNumero rotulo="Processos" icone={WorkflowIcon} valor={totalProcessos} tom="informacao" />
        <Link href="/processos/indicadores" className="focus-visible:ring-ring rounded-xl transition-opacity hover:opacity-80 focus-visible:ring-2">
          <CartaoNumero rotulo="Fora da meta" icone={AlertTriangleIcon} valor={foraDaMeta.length} tom={foraDaMeta.length ? "perigo" : undefined}>
            {atrasados.length ? `${atrasados.length} com lançamento atrasado` : "Ver indicadores →"}
          </CartaoNumero>
        </Link>
        <CartaoNumero rotulo="Para revisar" icone={CalendarClockIcon} valor={resumos.paraRevisar.length} tom={resumos.paraRevisar.length ? "atencao" : undefined} />
      </section>

      {(foraDaMeta.length > 0 || resumos.paraRevisar.length > 0) && (
        <section className="grid gap-3 md:grid-cols-2" aria-label="Pontos de atenção">
          {foraDaMeta.length > 0 && (
            <div className="border-perigo/30 bg-perigo-suave/40 grid content-start gap-2 rounded-xl border p-4">
              <h2 className="text-sm font-semibold">Indicadores fora da meta</h2>
              <ul className="grid gap-1 text-sm">
                {foraDaMeta.slice(0, 6).map((i) => (
                  <li key={i.id}>
                    <Link href={`/processos/documentos/${i.documento.id}#titulo-indicadores`} className="hover:underline">
                      <span className="font-medium">{i.nome}</span> <span className="text-muted-foreground">· {i.documento.titulo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resumos.paraRevisar.length > 0 && (
            <div className="border-atencao/30 bg-atencao-suave/40 grid content-start gap-2 rounded-xl border p-4">
              <h2 className="text-sm font-semibold">Padrões com revisão vencida</h2>
              <ul className="grid gap-1 text-sm">
                {resumos.paraRevisar.slice(0, 6).map((d) => (
                  <li key={d.id}>
                    <Link href={`/processos/documentos/${d.id}`} className="hover:underline">
                      <span className="font-medium">{d.titulo}</span> <span className="text-muted-foreground">· venceu em {formatarData(d.venceuEm)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {arvore.map((c) => {
        const Icone = ICONE_CATEGORIA[c.icone] ?? ICONE_CATEGORIA.pasta;
        return (
          <section key={c.id} aria-labelledby={`cat-${c.id}`} className="grid gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Icone className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id={`cat-${c.id}`} className="text-foreground text-lg font-semibold tracking-tight">
                  {c.nome}
                </h2>
                {c.descricao && <p className="text-muted-foreground text-sm">{c.descricao}</p>}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {c.areas.map((a) => (
                <div key={a.id} className="bg-card grid content-start gap-3 rounded-xl border p-4 shadow-sm">
                  <div>
                    <h3 className="font-semibold">{a.nome}</h3>
                    {a.descricao && <p className="text-muted-foreground text-xs">{a.descricao}</p>}
                  </div>
                  {a.documentos.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic">Nenhum documento {editor ? "ainda" : "publicado"}.</p>
                  ) : (
                    <ul className="grid gap-1">
                      {a.documentos.map((d) => (
                        <li key={d.id}>
                          <Link href={`/processos/documentos/${d.id}`} className="hover:bg-muted -mx-2 grid gap-0.5 rounded-lg px-2 py-1.5">
                            <span className="flex items-center gap-2 text-sm font-medium">
                              {d.tipo === "processo" ? <WorkflowIcon className="text-primary size-3.5 shrink-0" aria-hidden /> : <FileTextIcon className="text-primary size-3.5 shrink-0" aria-hidden />}
                              <span className="truncate">{d.titulo}</span>
                              {!d.publicado && <span className="text-atencao text-[0.65rem] font-semibold uppercase">rascunho</span>}
                            </span>
                            {resumos.resumos.get(d.id) && <span className="text-muted-foreground line-clamp-2 pl-5.5 text-xs">{resumos.resumos.get(d.id)}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {c.areas.length === 0 && <p className="text-muted-foreground text-sm italic">Nenhuma área nesta categoria.</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
