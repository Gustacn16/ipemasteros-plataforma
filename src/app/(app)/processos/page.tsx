import { CalendarClockIcon, ClockIcon, FileTextIcon, FolderTreeIcon, SearchXIcon, WorkflowIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { formatarData } from "@/modulos/processos/componentes/datas";
import { ICONE_CATEGORIA } from "@/modulos/processos/componentes/icones";
import { BotaoAcao } from "@/modulos/academico/componentes/campos";
import { criarEstruturaInicialAcao } from "@/modulos/processos/acoes/processos";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { buscarDocumentos, obterResumos } from "@/modulos/processos/servicos/documentos";
import { obterArvore } from "@/modulos/processos/servicos/estrutura";

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
  const [arvore, resumos] = await Promise.all([obterArvore(usuario), obterResumos(usuario)]);

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

  return (
    <div className="grid gap-8">
      {editor && resumos.rascunhos > 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span className="bg-atencao size-2 rounded-full" aria-hidden />
          {resumos.rascunhos} documento{resumos.rascunhos === 1 ? "" : "s"} em rascunho: o time só vê depois de publicar.
        </p>
      )}

      {resumos.recentes.length > 0 && (
        <section aria-labelledby="titulo-recentes" className="grid gap-3">
          <h2 id="titulo-recentes" className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
            <ClockIcon className="size-3.5" aria-hidden /> {editor ? "Mexidos recentemente" : "Atualizados recentemente"}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
            {resumos.recentes.map((d) => (
              <li key={d.id}>
                <Link href={`/processos/documentos/${d.id}`} className="bg-card hover:border-primary/50 grid h-full gap-0.5 rounded-xl border px-4 py-3 transition-colors">
                  <span className="text-muted-foreground truncate text-xs">{d.caminho}</span>
                  <span className={d.rascunho ? "truncate font-medium italic" : "truncate font-medium"}>{d.titulo}</span>
                  <span className="text-muted-foreground text-xs">
                    {d.rascunho ? "Rascunho · " : ""}
                    {formatarData(d.em)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resumos.paraRevisar.length > 0 && (
        <section aria-label="Para revisar" className="border-atencao/30 bg-atencao-suave/40 grid gap-2 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClockIcon className="text-atencao size-4" aria-hidden /> Padrões com revisão vencida
          </h2>
          <ul className="grid gap-1 text-sm">
            {resumos.paraRevisar.slice(0, 6).map((d) => (
              <li key={d.id}>
                <Link href={`/processos/documentos/${d.id}`} className="hover:underline">
                  <span className="font-medium">{d.titulo}</span> <span className="text-muted-foreground">· venceu em {formatarData(d.venceuEm)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {arvore.map((c) => {
        const Icone = ICONE_CATEGORIA[c.icone] ?? ICONE_CATEGORIA.pasta;
        return (
          <section key={c.id} id={`cat-${c.id}`} aria-labelledby={`titulo-cat-${c.id}`} className="grid scroll-mt-6 gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Icone className="size-5" aria-hidden />
              </span>
              <div>
                <h2 id={`titulo-cat-${c.id}`} className="text-foreground text-lg font-semibold tracking-tight">
                  {c.nome}
                </h2>
                {c.descricao && <p className="text-muted-foreground text-sm">{c.descricao}</p>}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {c.areas.map((a) => (
                <div key={a.id} id={`area-${a.id}`} className="bg-card grid scroll-mt-6 content-start gap-3 rounded-xl border p-4 shadow-sm target:ring-primary target:ring-2">
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
