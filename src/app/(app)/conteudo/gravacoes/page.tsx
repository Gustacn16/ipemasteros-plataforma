import { FolderOpenIcon } from "lucide-react";
import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Cartao } from "@/modulos/conteudo/componentes/exibicao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { SeletorEtapa } from "@/modulos/conteudo/componentes/seletor-etapa";
import { listarGravacoes } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Gravações — IPEMaster OS" };

export default async function PaginaGravacoes() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const { aGravar, gravados } = await listarGravacoes(usuario, await lerFiltro());

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Gravações</h1>
        <p className="text-muted-foreground">Agenda de gravação e o banco de material gravado que ainda não foi publicado.</p>
      </header>

      <section aria-labelledby="sec-agravar" className="grid gap-3">
        <h2 id="sec-agravar" className="font-semibold">
          A gravar <span className="text-muted-foreground font-normal">{aGravar.length}</span>
        </h2>
        {aGravar.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            Nada para gravar. Mova um conteúdo para a etapa &quot;A gravar&quot; e marque a data no detalhe.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {aGravar.map((i) => (
              <Cartao key={i.id} item={i} mostrarGravacao acoes={<SeletorEtapa conteudoId={i.id} etapa={i.etapa} compacto />} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sec-gravados" className="grid gap-3">
        <div>
          <h2 id="sec-gravados" className="font-semibold">
            Banco de gravados <span className="text-muted-foreground font-normal">{gravados.length}</span>
          </h2>
          <p className="text-muted-foreground text-sm">Material gravado ou em edição, esperando para ser publicado.</p>
        </div>
        {gravados.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">Nenhum material gravado pendente.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gravados.map((i) => (
              <Cartao
                key={i.id}
                item={i}
                acoes={
                  <div className="flex items-center gap-2">
                    <SeletorEtapa conteudoId={i.id} etapa={i.etapa} compacto />
                    {i.linkMaterial && (
                      <a
                        href={i.linkMaterial}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-muted inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs"
                      >
                        <FolderOpenIcon className="size-3.5" aria-hidden /> Material
                      </a>
                    )}
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
