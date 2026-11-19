import { ListTreeIcon, SearchIcon } from "lucide-react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasProcessos } from "@/modulos/processos/componentes/abas-processos";
import { ArvoreProcessos } from "@/modulos/processos/componentes/arvore";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { obterArvore } from "@/modulos/processos/servicos/estrutura";

function Busca() {
  return (
    <form action="/processos" role="search" className="relative w-full sm:w-72">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
      <input
        type="search"
        name="busca"
        placeholder="Buscar nos processos…"
        aria-label="Buscar nos processos"
        className="border-input bg-card focus-visible:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
      />
    </form>
  );
}

/** Área de Processos internos: cabeçalho, abas e a árvore de navegação ao lado. */
export default async function LayoutProcessos({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const arvore = await obterArvore(usuario);
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <CabecalhoPagina titulo="Processos internos" descricao="Como a IPEMaster funciona: padrões, fluxos e indicadores." acoes={<Busca />} />
        <AbasProcessos editor={podeEditar(usuario)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
          <details className="bg-card rounded-xl border p-2 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-2 py-1 text-sm font-medium">
              <ListTreeIcon className="size-4" aria-hidden /> Navegar pelos documentos
            </summary>
            <div className="mt-2">
              <ArvoreProcessos categorias={arvore} />
            </div>
          </details>
          <div className="hidden lg:block">
            <ArvoreProcessos categorias={arvore} />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
