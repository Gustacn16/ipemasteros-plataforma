import { ChevronLeftIcon, ChevronRightIcon, ClapperboardIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { SeloPlataforma } from "@/modulos/conteudo/componentes/exibicao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { mesAnterior, mesAtual, proximoMes } from "@/modulos/conteudo/regras/calendario";
import { COR_ETAPA, ROTULO_ETAPA } from "@/modulos/conteudo/regras/etapas";
import { listarCalendario } from "@/modulos/conteudo/servicos/conteudos";
import { diaDaDataEntrega, diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export const metadata: Metadata = { title: "Calendário — IPEMaster OS" };

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomeMes = (mes: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${mes}-01T00:00:00Z`));

export default async function PaginaCalendario({ searchParams }: PageProps<"/conteudo/calendario">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const mes = lerMes(busca);
  const comGravacoes = busca.gravacoes === "1";
  const { grade, itens } = await listarCalendario(usuario, mes, filtro, comGravacoes);
  const hoje = diaEmSaoPaulo(new Date());

  type Evento = { id: string; tipo: "publicacao" | "gravacao"; item: (typeof itens)[number] };
  const porDia = new Map<string, Evento[]>();
  const adicionar = (dia: string, e: Evento) => porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  for (const item of itens) {
    if (item.dataPublicacao) adicionar(diaDaDataEntrega(item.dataPublicacao), { id: `${item.id}-p`, tipo: "publicacao", item });
    if (comGravacoes && item.dataGravacao) adicionar(diaDaDataEntrega(item.dataGravacao), { id: `${item.id}-g`, tipo: "gravacao", item });
  }

  const url = (extra: Record<string, string>) =>
    `/conteudo/calendario?${new URLSearchParams({ ...(comGravacoes ? { gravacoes: "1" } : {}), mes, ...extra })}`;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={url({ mes: mesAnterior(mes) })} className="hover:bg-muted rounded-md border p-1.5" aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <h1 className="min-w-44 text-center text-xl font-semibold capitalize">{nomeMes(mes)}</h1>
          <Link href={url({ mes: proximoMes(mes) })} className="hover:bg-muted rounded-md border p-1.5" aria-label="Próximo mês">
            <ChevronRightIcon className="size-4" />
          </Link>
          {mes !== mesAtual() && (
            <Link href={url({ mes: mesAtual() })} className="text-muted-foreground ml-2 text-sm underline-offset-4 hover:underline">
              Hoje
            </Link>
          )}
        </div>
        <Link
          href={`/conteudo/calendario?${new URLSearchParams({ mes, ...(comGravacoes ? {} : { gravacoes: "1" }) })}`}
          className="flex items-center gap-2 text-sm"
          aria-pressed={comGravacoes}
        >
          <span className={cn("inline-block size-4 rounded border", comGravacoes && "border-orange-500 bg-orange-500")} aria-hidden />
          Mostrar gravações
        </Link>
      </header>

      <div className="overflow-x-auto">
        <div className="grid min-w-[48rem] grid-cols-7 overflow-hidden rounded-lg border">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="bg-muted/40 border-b px-2 py-1.5 text-xs font-medium">
              {d}
            </div>
          ))}
          {grade.flat().map(({ dia, doMes }) => {
            const eventos = porDia.get(dia) ?? [];
            return (
              <div
                key={dia}
                className={cn("min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0", !doMes && "bg-muted/30 text-muted-foreground")}
              >
                <p className={cn("mb-1 text-xs", dia === hoje && "inline-flex size-5 items-center justify-center rounded-full bg-orange-500 font-semibold text-white")}>
                  {Number(dia.slice(8))}
                </p>
                <ul className="grid gap-1">
                  {eventos.map(({ id, tipo, item }) => (
                    <li key={id}>
                      <Link
                        href={`/conteudo/itens/${item.id}`}
                        title={`${item.titulo} · ${ROTULO_ETAPA[item.etapa]}`}
                        className={cn(
                          "hover:bg-muted flex items-center gap-1 rounded border-l-4 bg-white px-1 py-0.5 text-xs shadow-xs",
                          tipo === "gravacao" && "border-dashed bg-orange-50",
                        )}
                        style={{ borderLeftColor: tipo === "gravacao" ? "#f97316" : COR_ETAPA[item.etapa] }}
                      >
                        {tipo === "gravacao" ? (
                          <ClapperboardIcon className="size-3 shrink-0 text-orange-600" aria-label="Gravação" />
                        ) : (
                          item.publicacoes.slice(0, 2).map((p, i) => <SeloPlataforma key={i} plataforma={p.canal.plataforma} publicado={p.status === "publicado"} />)
                        )}
                        <span className="truncate">{item.titulo}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">A cor da borda indica a etapa. Selos com contorno verde já foram publicados naquele canal.</p>
    </div>
  );
}
