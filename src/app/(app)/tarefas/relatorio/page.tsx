import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { DataEntrega, PontoCor, formatarDiaEntrega } from "@/modulos/tarefas/componentes/exibicao";
import { FiltrosDoRelatorio } from "@/modulos/tarefas/componentes/filtros-relatorio";
import { esquemaFiltrosRelatorio } from "@/modulos/tarefas/esquemas/relatorio";
import {
  ROTULO_SITUACAO_PRAZO,
  faixaPercentual,
  type LinhaRelatorio,
  type SituacaoPrazo,
} from "@/modulos/tarefas/regras/relatorio";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { obterRelatorio } from "@/modulos/tarefas/servicos/relatorio";

export const metadata: Metadata = { title: "Relatório de tarefas — IPEMaster OS" };

const COR_FAIXA = { verde: "text-green-700", amarelo: "text-amber-600", vermelho: "text-red-600" } as const;

const COR_SITUACAO: Record<SituacaoPrazo, string> = {
  no_prazo: "bg-green-100 text-green-800",
  atrasada: "bg-red-100 text-red-700",
  sem_data: "bg-neutral-100 text-neutral-600",
};

const formatoConclusao = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dataDoDia = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`));

function Percentual({ valor, className }: { valor: number | null; className?: string }) {
  const faixa = faixaPercentual(valor);
  if (faixa === null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return <span className={cn("font-semibold", COR_FAIXA[faixa], className)}>{valor}%</span>;
}

function SeloSituacao({ situacao }: { situacao: SituacaoPrazo }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", COR_SITUACAO[situacao])}>
      {ROTULO_SITUACAO_PRAZO[situacao]}
    </span>
  );
}

function CartaoNumero({ titulo, children, descricao }: { titulo: string; children: React.ReactNode; descricao?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="text-3xl">{children}</CardTitle>
      </CardHeader>
      {descricao && <CardContent className="text-muted-foreground px-4 text-xs">{descricao}</CardContent>}
    </Card>
  );
}

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

  const { intervalo, equipe, espacos, linhas, minhaLinha, detalhe } = await obterRelatorio(usuario, filtros);
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
      <header className="grid gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatório</h1>
          <p className="text-muted-foreground">
            Entregas de {dataDoDia(intervalo.primeiroDia)} a {dataDoDia(intervalo.ultimoDia)}. Abertas e atrasadas são contadas agora.
          </p>
        </div>
        <FiltrosDoRelatorio
          periodo={intervalo.periodo}
          primeiroDia={intervalo.primeiroDia}
          ultimoDia={intervalo.ultimoDia}
          espacos={abreLista ? espacos : null}
        />
      </header>

      <section aria-label="Meus números" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CartaoNumero titulo="Minhas abertas">{eu.abertas}</CartaoNumero>
        <CartaoNumero titulo="Atrasadas agora">
          <span className={cn(eu.atrasadas > 0 && "text-red-600")}>{eu.atrasadas}</span>
        </CartaoNumero>
        <CartaoNumero titulo="Entregues no período">{eu.entregues}</CartaoNumero>
        <CartaoNumero
          titulo="% no prazo"
          descricao={eu.entreguesComData > 0 ? `${eu.noPrazo} de ${eu.entreguesComData} com data` : "Nenhuma entrega com data"}
        >
          <Percentual valor={eu.percentual} />
        </CartaoNumero>
      </section>

      <section aria-labelledby="titulo-pessoas" className="grid gap-2">
        <h2 id="titulo-pessoas" className="font-semibold">
          {equipe ? "Por pessoa" : "Meu resumo"}
        </h2>
        {linhasTabela.length === 0 ? (
          <p className="text-muted-foreground text-sm">Ninguém tem tarefas neste filtro.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-right">Abertas</TableHead>
                  <TableHead className="text-right">Atrasadas agora</TableHead>
                  <TableHead className="text-right">Entregues</TableHead>
                  <TableHead className="text-right">No prazo</TableHead>
                  <TableHead className="text-right">% no prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasTabela.map((l) => (
                  <TableRow key={l.pessoa.id} data-state={detalhe?.linha.pessoa.id === l.pessoa.id ? "selected" : undefined}>
                    <TableCell>
                      <Link href={urlCom(l.pessoa.id)} scroll={false} className="font-medium underline-offset-4 hover:underline">
                        {l.pessoa.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{l.abertas}</TableCell>
                    <TableCell className={cn("text-right", l.atrasadas > 0 && "font-medium text-red-600")}>{l.atrasadas}</TableCell>
                    <TableCell className="text-right">{l.entregues}</TableCell>
                    <TableCell className="text-right">{l.noPrazo}</TableCell>
                    <TableCell className="text-right">
                      <Percentual valor={l.percentual} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                          <span className="text-sm">
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
