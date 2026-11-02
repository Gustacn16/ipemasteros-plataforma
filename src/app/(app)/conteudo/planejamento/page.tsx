import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Cartao } from "@/modulos/conteudo/componentes/exibicao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { SeletorEtapa } from "@/modulos/conteudo/componentes/seletor-etapa";
import { COR_ETAPA, ETAPAS_DO_QUADRO, ROTULO_ETAPA } from "@/modulos/conteudo/regras/etapas";
import { listarQuadro } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Planejamento — IPEMaster OS" };

export default async function PaginaPlanejamento({ searchParams }: PageProps<"/conteudo/planejamento">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const quadro = await listarQuadro(usuario, lerFiltro(await searchParams));

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Planejamento</h1>
        <p className="text-muted-foreground">Da ideia à aprovação. Publicados ficam na aba Publicados.</p>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:px-8">
        <div className="flex gap-3">
          {ETAPAS_DO_QUADRO.map((etapa) => (
            <section key={etapa} aria-labelledby={`col-${etapa}`} className="bg-muted/40 grid w-64 shrink-0 content-start gap-2 rounded-lg p-2">
              <h2 id={`col-${etapa}`} className="flex items-center gap-2 px-1 text-sm font-semibold">
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: COR_ETAPA[etapa] }} />
                {ROTULO_ETAPA[etapa]}
                <span className="text-muted-foreground font-normal">{quadro[etapa].length}</span>
              </h2>
              {quadro[etapa].map((item) => (
                <Cartao
                  key={item.id}
                  item={item}
                  mostrarGravacao={etapa === "a_gravar"}
                  acoes={<SeletorEtapa conteudoId={item.id} etapa={item.etapa} compacto />}
                />
              ))}
              {quadro[etapa].length === 0 && <p className="text-muted-foreground px-1 py-2 text-xs">Vazio</p>}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
