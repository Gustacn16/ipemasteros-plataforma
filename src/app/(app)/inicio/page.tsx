import { CalendarDaysIcon, ListChecksIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { FUSO_PADRAO } from "@/lib/datas";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { urlAgenda } from "@/modulos/agenda/componentes/item-agenda";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { listarEventos } from "@/modulos/agenda/servicos/eventos";
import { agruparPorDia, DIAS_INICIO, rotuloDia } from "@/modulos/core/regras/inicio";
import { BadgePrioridade, DataEntrega, PontoCor } from "@/modulos/tarefas/componentes/exibicao";
import { diaEmSaoPaulo, GRUPOS_MINHAS, ROTULO_GRUPO_MINHAS, somarDias } from "@/modulos/tarefas/regras/prazo";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { listarMinhasTarefas } from "@/modulos/tarefas/servicos/tarefas";

export const metadata: Metadata = { title: "Início — IPEMaster OS" };

/** Grupos de "Minhas tarefas" que entram no início. */
const GRUPOS_INICIO = ["atrasadas", "hoje", "proximos7"] as const;

const formatoHoje = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO_PADRAO, weekday: "long", day: "numeric", month: "long" });

export default async function PaginaInicio({ searchParams }: PageProps<"/inicio">) {
  const usuario = await exigirUsuario();
  const { erro } = await searchParams;
  const hoje = diaEmSaoPaulo(new Date());
  const comTarefas = temPermissao(usuario.papel, "tarefas:usar");
  const comAgenda = temPermissao(usuario.papel, "agenda:usar") && podeVerInstitucional(usuario.papel);

  const [grupos, eventos] = await Promise.all([
    comTarefas ? listarMinhasTarefas(usuario) : null,
    comAgenda ? listarEventos(usuario, { de: hoje, ate: somarDias(hoje, DIAS_INICIO) }) : [],
  ]);
  const abertas = grupos ? GRUPOS_MINHAS.reduce((n, g) => n + grupos[g].length, 0) : 0;
  const tarefasProximas = grupos ? GRUPOS_INICIO.filter((g) => grupos[g].length > 0) : [];
  // O professor não abre listas; ele conclui pela tela "Minhas tarefas".
  const abreLista = navegaEmEspacos(usuario);
  const dias = agruparPorDia(eventos, hoje);

  return (
    <div className="grid max-w-5xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {usuario.apelido ?? usuario.nome.split(" ")[0]}</h1>
          <p className="text-muted-foreground first-letter:uppercase">{formatoHoje.format(new Date())}</p>
        </div>
        {comTarefas && (
          <Button asChild variant="outline">
            <Link href="/tarefas/minhas">
              <ListChecksIcon />
              Minhas tarefas
              <span className="bg-muted rounded-md px-1.5 text-xs tabular-nums">{abertas}</span>
            </Link>
          </Button>
        )}
      </header>

      {erro === "sem-permissao" && (
        <Alert variant="destructive">
          <AlertDescription>Você não tem permissão para acessar aquela página.</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {grupos && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecksIcon className="size-4" /> Suas tarefas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {tarefasProximas.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma tarefa com prazo nos próximos {DIAS_INICIO} dias.</p>
              )}
              {tarefasProximas.map((g) => (
                <section key={g} aria-labelledby={`inicio-${g}`} className="grid gap-1.5">
                  <h2 id={`inicio-${g}`} className={g === "atrasadas" ? "text-sm font-semibold text-red-600" : "text-sm font-semibold"}>
                    {ROTULO_GRUPO_MINHAS[g]} <span className="text-muted-foreground font-normal">{grupos[g].length}</span>
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {grupos[g].map((t) => {
                      const conteudo = (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{t.titulo}</span>
                            <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                              <PontoCor cor={t.lista.espaco.cor} className="size-2" />
                              {t.lista.espaco.nome} › {t.lista.nome}
                            </span>
                          </span>
                          <BadgePrioridade prioridade={t.prioridade} />
                          <span className="w-12 text-right text-sm">
                            <DataEntrega data={t.dataEntrega} />
                          </span>
                        </>
                      );
                      return (
                        <li key={t.id}>
                          <Link
                            href={abreLista ? `/tarefas/listas/${t.lista.id}?tarefa=${t.id}` : "/tarefas/minhas"}
                            className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                          >
                            {conteudo}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </CardContent>
          </Card>
        )}

        {comAgenda && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDaysIcon className="size-4" /> Próximos eventos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {dias.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum evento na agenda nos próximos {DIAS_INICIO} dias.</p>
              )}
              {dias.map(({ dia, itens }) => (
                <section key={dia} aria-labelledby={`dia-${dia}`} className="grid gap-1.5">
                  <h2 id={`dia-${dia}`} className="text-sm font-semibold first-letter:uppercase">
                    {rotuloDia(dia, hoje)}
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {itens.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={urlAgenda({}, { data: dia, evento: e.id })}
                          className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                        >
                          <PontoCor cor={e.tipo.cor} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{e.titulo}</span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {[e.tipo.nome, e.turma, e.local].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
                            {e.horaInicio ? `${e.horaInicio}${e.horaFim ? `–${e.horaFim}` : ""}` : "Dia todo"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <Link href="/agenda" className="text-primary text-sm font-medium hover:underline">
                Abrir a agenda
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
