import { FolderCogIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Button } from "@/componentes/ui/button";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { ArvoreProcessos } from "@/modulos/processos/componentes/arvore";
import { BuscaProcessos } from "@/modulos/processos/componentes/busca-processos";
import { NavegacaoMovel } from "@/modulos/processos/componentes/navegacao-movel";
import { NovoDocumento } from "@/modulos/processos/componentes/novo-documento";
import { TemaProcessos } from "@/modulos/processos/componentes/tema-processos";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { listarOpcoesArea, obterArvore } from "@/modulos/processos/servicos/estrutura";

/** Wiki de Processos internos: cabeçalho com busca e, ao lado, a árvore de navegação. */
export default async function LayoutProcessos({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const editor = podeEditar(usuario);
  const [arvore, areas] = await Promise.all([obterArvore(usuario), editor ? listarOpcoesArea() : Promise.resolve([])]);
  return (
    <div className="grid gap-6">
      <TemaProcessos />
      <CabecalhoPagina
        titulo="Processos internos"
        descricao="A wiki da IPEMaster: como a empresa funciona, passo a passo."
        acoes={
          <>
            <Suspense>
              <BuscaProcessos />
            </Suspense>
            {editor && (
              <>
                <Button variant="outline" asChild>
                  <Link href="/processos/organizar">
                    <FolderCogIcon /> Organizar
                  </Link>
                </Button>
                <NovoDocumento areas={areas} />
              </>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <NavegacaoMovel categorias={arvore} />
          <div className="hidden lg:block">
            <ArvoreProcessos categorias={arvore} />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
