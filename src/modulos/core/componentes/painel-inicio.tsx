import {
  AlertTriangleIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ListChecksIcon,
} from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/componentes/ui/card";
import { FUSO_PADRAO } from "@/lib/datas";
import { urlAgenda } from "@/modulos/agenda/componentes/item-agenda";
import type { EventoAgenda } from "@/modulos/agenda/servicos/eventos";
import {
  agruparPorDia,
  DIAS_INICIO,
  rotuloDia,
} from "@/modulos/core/regras/inicio";
import { ChipPrazo } from "@/modulos/tarefas/componentes/chips-tarefa";
import {
  ChipPrioridade,
  PontoCor,
} from "@/modulos/tarefas/componentes/exibicao";
import {
  GRUPOS_MINHAS,
  ROTULO_GRUPO_MINHAS,
} from "@/modulos/tarefas/regras/prazo";
import type { listarMinhasTarefas } from "@/modulos/tarefas/servicos/tarefas";

export type GruposInicio = Awaited<ReturnType<typeof listarMinhasTarefas>>;

/** Grupos de "Minhas tarefas" que entram no início. */
const GRUPOS_INICIO = ["atrasadas", "hoje", "proximos7"] as const;

const formatoHoje = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO_PADRAO,
  weekday: "long",
  day: "numeric",
  month: "long",
});

export function PainelInicio({
  nome,
  grupos,
  eventos,
  comTarefas,
  comAgenda,
  abreLista,
  hoje,
  agora,
  erro,
}: {
  nome: string;
  grupos: GruposInicio | null;
  eventos: EventoAgenda[];
  comTarefas: boolean;
  comAgenda: boolean;
  abreLista: boolean;
  hoje: string;
  agora: Date;
  erro?: string | string[];
}) {
  const abertas = grupos
    ? GRUPOS_MINHAS.reduce((n, g) => n + grupos[g].length, 0)
    : 0;
  const tarefasProximas = grupos
    ? GRUPOS_INICIO.filter((g) => grupos[g].length > 0)
    : [];
  const dias = agruparPorDia(eventos, hoje);
  const rotuloEventos =
    DIAS_INICIO === 7 ? "Eventos na semana" : `Eventos em ${DIAS_INICIO} dias`;
  const temNumeros = comTarefas || comAgenda;

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6">
      <CabecalhoPagina
        titulo={`Olá, ${nome}`}
        descricao={formatoHoje
          .format(agora)
          .replace(/^./, (c) => c.toUpperCase())}
        acoes={
          comTarefas ? (
            <Button asChild variant="outline">
              <Link href="/tarefas/minhas">
                <ListChecksIcon />
                Minhas tarefas
                <span className="bg-muted rounded-md px-1.5 text-xs tabular-nums">
                  {abertas}
                </span>
              </Link>
            </Button>
          ) : undefined
        }
      />

      {temNumeros && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {grupos && (
            <>
              <CartaoNumero
                rotulo="Atrasadas"
                icone={AlertTriangleIcon}
                valor={grupos.atrasadas.length}
                tom={grupos.atrasadas.length > 0 ? "perigo" : "neutro"}
              />
              <CartaoNumero
                rotulo="Vencem hoje"
                icone={CalendarClockIcon}
                valor={grupos.hoje.length}
                tom={grupos.hoje.length > 0 ? "atencao" : "neutro"}
              />
              <CartaoNumero
                rotulo="Próximos 7 dias"
                icone={CalendarCheckIcon}
                valor={grupos.proximos7.length}
              />
            </>
          )}
          {comAgenda && (
            <CartaoNumero
              rotulo={rotuloEventos}
              icone={CalendarDaysIcon}
              valor={eventos.length}
            />
          )}
        </div>
      )}

      {erro === "sem-permissao" && (
        <Alert variant="destructive">
          <AlertDescription>
            Você não tem permissão para acessar aquela página.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {grupos && (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecksIcon className="size-4" /> Suas tarefas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 grid-cols-1 gap-4">
              {tarefasProximas.length === 0 && (
                <EstadoVazio
                  icone={CheckCircle2Icon}
                  titulo="Tudo em dia"
                  descricao={`Nenhuma tarefa com prazo nos próximos ${DIAS_INICIO} dias.`}
                />
              )}
              {tarefasProximas.map((g) => (
                <section
                  key={g}
                  aria-labelledby={`inicio-${g}`}
                  className="grid min-w-0 grid-cols-1 gap-1.5"
                >
                  <h2
                    id={`inicio-${g}`}
                    className={
                      g === "atrasadas"
                        ? "text-perigo text-sm font-semibold"
                        : "text-sm font-semibold"
                    }
                  >
                    {ROTULO_GRUPO_MINHAS[g]}{" "}
                    <span className="text-muted-foreground font-normal">
                      {grupos[g].length}
                    </span>
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {grupos[g].map((t) => {
                      const conteudo = (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {t.titulo}
                            </span>
                            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                              <PontoCor
                                cor={t.lista.espaco.cor}
                                className="size-2"
                              />
                              <span className="truncate">
                                {t.lista.espaco.nome} › {t.lista.nome}
                              </span>
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <ChipPrazo
                              dataEntrega={t.dataEntrega}
                              concluidaEm={null}
                              agora={agora}
                            />
                            <ChipPrioridade prioridade={t.prioridade} />
                          </span>
                        </>
                      );
                      return (
                        <li key={t.id}>
                          <Link
                            href={
                              abreLista
                                ? `/tarefas/listas/${t.lista.id}?tarefa=${t.id}`
                                : "/tarefas/minhas"
                            }
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
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDaysIcon className="size-4" /> Próximos eventos
              </CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 grid-cols-1 gap-4">
              {dias.length === 0 && (
                <EstadoVazio
                  icone={CalendarDaysIcon}
                  titulo="Agenda livre"
                  descricao={`Nenhum evento na agenda nos próximos ${DIAS_INICIO} dias.`}
                />
              )}
              {dias.map(({ dia, itens }) => (
                <section
                  key={dia}
                  aria-labelledby={`dia-${dia}`}
                  className="grid min-w-0 grid-cols-1 gap-1.5"
                >
                  <h2
                    id={`dia-${dia}`}
                    className="text-sm font-semibold first-letter:uppercase"
                  >
                    {rotuloDia(dia, hoje)}
                  </h2>
                  <ul className="divide-y rounded-md border">
                    {itens.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={urlAgenda({}, { data: dia, evento: e.id })}
                          className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2"
                        >
                          <span className="grid min-w-0 flex-1 justify-items-start gap-1">
                            <ChipSituacao cor={e.tipo.cor} tamanho="sm">
                              {e.tipo.nome}
                            </ChipSituacao>
                            <span className="block w-full truncate text-sm font-medium">
                              {e.titulo}
                            </span>
                            {(e.turma || e.local) && (
                              <span className="text-muted-foreground block w-full truncate text-xs">
                                {[e.turma, e.local].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground text-sm whitespace-nowrap tabular-nums">
                            {e.horaInicio
                              ? `${e.horaInicio}${e.horaFim ? `–${e.horaFim}` : ""}`
                              : "Dia todo"}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <Link
                href="/agenda"
                className="text-primary dark:text-informacao text-sm font-medium hover:underline"
              >
                Abrir a agenda
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
