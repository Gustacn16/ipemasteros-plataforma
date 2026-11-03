import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import {
  NumerosRelatorio,
  PodioEGrafico,
  SeloSituacao,
  TabelaPorPessoa,
} from "@/modulos/tarefas/componentes/blocos-relatorio";
import { DataEntrega, PontoCor, formatarDiaEntrega } from "@/modulos/tarefas/componentes/exibicao";
import { FiltrosDoRelatorio } from "@/modulos/tarefas/componentes/filtros-relatorio";
import { esquemaFiltrosRelatorio } from "@/modulos/tarefas/esquemas/relatorio";
import type { LinhaRelatorio } from "@/modulos/tarefas/regras/relatorio";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { obterRelatorio } from "@/modulos/tarefas/servicos/relatorio";

export const metadata: Metadata = { title: "Relatório de tarefas — IPEMaster OS" };

const formatoConclusao = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dataDoDia = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`));

export default async function PaginaRelatorio({ searchParams }: PageProps<"/tarefas/relatorio">) {
  const usuario = await exigirPermissaoPagina("tarefas:usar");
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosRelatorio.parse({
    periodo: texto(busca.periodo),
    de: texto(busca.de),
    ate: texto(busca.ate),
    espaco: texto(busca.espaco),
    pessoa: texto(busca.pessoa),
  });

  const { intervalo, equipe, espacos, linhas, minhaLinha, anterior, serie, podio, detalhe } = await obterRelatorio(
    usuario,
    filtros,
  );
  const abreLista = navegaEmEspacos(usuario);
  const eu = minhaLinha;

  // Links mantêm os filtros da tela.
  const urlCom = (pessoa: string | null) => {
    const p = new URLSearchParams(
      Object.entries({ periodo: texto(busca.periodo), de: texto(busca.de), ate: texto(busca.ate), espaco: filtros.espaco })
        .filter((e): e is [string, string] => Boolean(e[1])),
    );
    if (pessoa) p.set("pessoa", pessoa);
    return p.size ? `/tarefas/relatorio?${p}` : "/tarefas/relatorio";
  };
  const linhasTabela: LinhaRelatorio[] = equipe ? linhas : [eu];

  return (
    <div className="grid max-w-5xl gap-6">
      <div className="grid gap-2">
        <CabecalhoPagina
          titulo="Relatório"
          descricao="Entregas e prazos no período"
          acoes={
            <FiltrosDoRelatorio
              periodo={intervalo.periodo}
              primeiroDia={intervalo.primeiroDia}
              ultimoDia={intervalo.ultimoDia}
              espacos={abreLista ? espacos : null}
            />
          }
        />
        <p className="text-muted-foreground text-xs">
          De {dataDoDia(intervalo.primeiroDia)} a {dataDoDia(intervalo.ultimoDia)}. Abertas e atrasadas são contadas agora; a
          variação compara com o período anterior de mesma duração.
        </p>
      </div>

      <NumerosRelatorio eu={eu} anterior={anterior.minhaLinha} />

      <PodioEGrafico podio={podio} serie={serie} />

      <section aria-labelledby="titulo-pessoas" className="grid gap-2">
        <h2 id="titulo-pessoas" className="font-semibold">
          {equipe ? "Por pessoa" : "Meu resumo"}
        </h2>
        {linhasTabela.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguém tem tarefas neste filtro.</p>
        ) : (
          <TabelaPorPessoa linhas={linhasTabela} selecionada={detalhe?.linha.pessoa.id} urlDaPessoa={urlCom} />
        )}
        <p className="text-muted-foreground text-xs">
          % no prazo = entregues até o fim do dia da entrega ÷ entregues com data. Verde a partir de 80%, amarelo de 60% a 79%,
          vermelho abaixo de 60%.
        </p>
      </section>

      {filtros.pessoa && (
        <section aria-labelledby="titulo-detalhe" className="grid gap-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="titulo-detalhe" className="font-semibold">
              {detalhe ? `Tarefas de ${detalhe.linha.pessoa.nome}` : "Tarefas da pessoa"}
            </h2>
            <Link href={urlCom(null)} scroll={false} className="text-muted-foreground text-sm hover:underline">
              Fechar
            </Link>
          </div>
          {!detalhe ? (
            <p className="text-muted-foreground text-sm">Nenhuma tarefa desta pessoa entrou no relatório.</p>
          ) : (
            (
              [
                ["Entregues no período", detalhe.entregues],
                ["Abertas", detalhe.abertas],
              ] as const
            ).map(([titulo, tarefas]) => (
              <div key={titulo} className="grid gap-2">
                <h3 className="text-sm font-medium">
                  {titulo} <span className="text-muted-foreground font-normal">{tarefas.length}</span>
                </h3>
                {tarefas.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {tarefas.map((t) => {
                      const conteudo = (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{t.titulo}</span>
                            <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                              <PontoCor cor={t.lista.espaco.cor} className="size-2" />
                              {t.lista.espaco.nome} › {t.lista.nome}
                              {t.concluidaEm && ` · concluída em ${formatoConclusao.format(t.concluidaEm)}`}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums">
                            {t.dataEntrega ? (
                              t.concluidaEm ? (
                                formatarDiaEntrega(t.dataEntrega)
                              ) : (
                                <DataEntrega data={t.dataEntrega} />
                              )
                            ) : null}
                          </span>
                          <SeloSituacao situacao={t.situacao} />
                        </>
                      );
                      return (
                        <li key={t.id}>
                          {abreLista ? (
                            <Link
                              href={`/tarefas/listas/${t.lista.id}?tarefa=${t.id}`}
                              className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                            >
                              {conteudo}
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 px-3 py-2">{conteudo}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
