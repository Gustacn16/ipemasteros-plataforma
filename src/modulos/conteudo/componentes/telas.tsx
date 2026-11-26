// Telas do módulo Conteúdo (só apresentação). As páginas em src/app/(app)/conteudo buscam os dados e
// passam para cá; assim a prévia visual usa exatamente o mesmo desenho.
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  HeartIcon,
  KanbanIcon,
  ListIcon,
  CalendarDaysIcon,
  PercentIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { formatarDataHora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { CLASSE_TITULO_SECAO } from "@/modulos/tarefas/componentes/exibicao";
import { diaDaDataEntrega } from "@/modulos/tarefas/regras/prazo";
import { rotuloCanalFormato } from "../regras/formatos";
import { conteudoAtrasado, mesAnterior, mesAtual, proximoMes, taxaEngajamento, type DiaGrade } from "../regras/calendario";
import { COR_ETAPA, ETAPAS_DO_QUADRO, ROTULO_ETAPA } from "../regras/etapas";
import type { CartaoConteudo, LinhaPublicado, obterConteudo } from "../servicos/conteudos";
import { Separator } from "@/componentes/ui/separator";
import { BadgeEtapa, ChipPublicacao, NomeCanal, SeloPlataforma } from "./exibicao";
import { EditorBlocos } from "./editor-blocos";
import { EditorConteudo } from "./editor-conteudo";
import { PublicacoesConteudo } from "./publicacoes-conteudo";
import { SeletorEtapa } from "./seletor-etapa";
import { BotaoNovoConteudo } from "./novo-conteudo";
import { QuadroConteudo } from "./quadro-conteudo";
import { FotoConta, RelatorioInstagram as BlocoRelatorio } from "./relatorio-instagram";
import { ListaMidiasInstagram } from "./ligar-midia";
import type { OrdemMidia } from "../regras/instagram";
import type { LinhaMidia, RelatorioInstagram } from "../servicos/visao-instagram";

const numero = new Intl.NumberFormat("pt-BR");
const fmt = (v: number | null) => (v === null ? "—" : numero.format(v));
const nomeMes = (mes: string) => {
  const t = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${mes}-01T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const estiloBotaoIcone =
  "hover:bg-muted focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-md border focus-visible:ring-2 focus-visible:outline-none";

function NavegacaoMes({ mes, url, mostrarHoje }: { mes: string; url: (m: string) => string; mostrarHoje?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={url(mesAnterior(mes))} className={estiloBotaoIcone} aria-label="Mês anterior">
        <ChevronLeftIcon className="size-4" />
      </Link>
      <Link href={url(proximoMes(mes))} className={estiloBotaoIcone} aria-label="Próximo mês">
        <ChevronRightIcon className="size-4" />
      </Link>
      {mostrarHoje && mes !== mesAtual() && (
        <Link href={url(mesAtual())} className="hover:bg-muted rounded-md border px-2.5 py-1 text-sm">
          Hoje
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Produção

export const VISOES_PRODUCAO = ["quadro", "lista", "calendario"] as const;
export type VisaoProducao = (typeof VISOES_PRODUCAO)[number];
const ROTULO_VISAO: Record<VisaoProducao, { rotulo: string; icone: typeof KanbanIcon }> = {
  quadro: { rotulo: "Quadro", icone: KanbanIcon },
  lista: { rotulo: "Lista", icone: ListIcon },
  calendario: { rotulo: "Calendário", icone: CalendarDaysIcon },
};
type QuadroProducao = Record<(typeof ETAPAS_DO_QUADRO)[number], CartaoConteudo[]>;

/** Quadro, Lista ou Calendário: botões que trocam a visão pela URL (`?visao=`). */
function TrocaVisao({ atual }: { atual: VisaoProducao }) {
  return (
    <div role="group" aria-label="Jeito de ver" className="bg-muted/50 inline-flex rounded-lg border p-0.5">
      {VISOES_PRODUCAO.map((v) => {
        const { rotulo, icone: Icone } = ROTULO_VISAO[v];
        return (
          <Link
            key={v}
            href={v === "quadro" ? "/conteudo/producao" : `/conteudo/producao?visao=${v}`}
            aria-current={v === atual ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none",
              v === atual ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icone className="size-3.5" aria-hidden /> {rotulo}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Produção do conteúdo numa tela só: Quadro (Kanban por etapa), Lista (agrupada por etapa) e
 * Calendário (gravações e publicações do mês). Publicados ficam na aba Publicados.
 */
export function TelaProducao(
  props:
    | { visao: "quadro" | "lista"; quadro: QuadroProducao; agora?: Date }
    | { visao: "calendario"; mes: string; grade: DiaGrade[][]; itens: CartaoConteudo[]; hoje: string },
) {
  const descricao =
    props.visao === "calendario"
      ? `${nomeMes(props.mes)}: gravações e publicações, na cor da etapa.`
      : "Da ideia ao finalizado: gravação, edição e finalizado. Publicados ficam na aba Publicados.";
  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPagina
        titulo="Produção"
        descricao={descricao}
        acoes={
          <>
            {props.visao === "calendario" && (
              <NavegacaoMes
                mes={props.mes}
                url={(m) => `/conteudo/producao?${new URLSearchParams({ visao: "calendario", mes: m })}`}
                mostrarHoje
              />
            )}
            <BotaoNovoConteudo />
          </>
        }
      />
      <TrocaVisao atual={props.visao} />
      {props.visao === "calendario" ? (
        <CalendarioProducao mes={props.mes} grade={props.grade} itens={props.itens} hoje={props.hoje} />
      ) : ETAPAS_DO_QUADRO.every((e) => props.quadro[e].length === 0) ? (
        <EstadoVazio
          icone={KanbanIcon}
          titulo="Nenhum conteúdo em produção"
          descricao="Crie o primeiro: ele começa como ideia. Atalho: tecla N."
          acao={<BotaoNovoConteudo />}
        />
      ) : props.visao === "lista" ? (
        <ListaProducao quadro={props.quadro} agora={props.agora ?? new Date()} />
      ) : (
        <QuadroConteudo quadro={props.quadro} agora={props.agora ?? new Date()} />
      )}
    </div>
  );
}

const diaCurto = (d: Date | null) => (d ? diaDaDataEntrega(d).slice(8, 10) + "/" + diaDaDataEntrega(d).slice(5, 7) : "—");

/** Lista de produção: um bloco por etapa, uma linha por conteúdo. */
function ListaProducao({ quadro, agora }: { quadro: QuadroProducao; agora: Date }) {
  return (
    <div className="grid gap-6">
      {ETAPAS_DO_QUADRO.map((etapa) => (
        <section key={etapa} aria-labelledby={`lista-${etapa}`} className="grid gap-2">
          <div className="flex items-center gap-2">
            <h2 id={`lista-${etapa}`} className="flex items-center gap-2 text-sm font-semibold">
              <BadgeEtapa etapa={etapa} tamanho="md" />
              <span className="text-muted-foreground font-normal tabular-nums">{quadro[etapa].length}</span>
            </h2>
            <BotaoNovoConteudo icone etapa={etapa} rotulo={`Novo conteúdo em ${ROTULO_ETAPA[etapa]}`} />
          </div>
          {quadro[etapa].length === 0 ? (
            <p className="text-muted-foreground px-1 text-sm">Nada nesta etapa.</p>
          ) : (
            <div className="bg-card overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="text-muted-foreground text-left text-xs">
                  <tr className="border-b">
                    <th className="px-3 py-2 font-normal">Conteúdo</th>
                    <th className="px-3 py-2 font-normal">Canal e formato</th>
                    <th className="px-3 py-2 font-normal">Responsável</th>
                    <th className="px-3 py-2 font-normal">Gravação</th>
                    <th className="px-3 py-2 font-normal">Publicação</th>
                    <th className="w-36 px-3 py-2 font-normal">Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {quadro[etapa].map((i) => {
                    const atrasado = conteudoAtrasado(i.dataPublicacao, i.etapa, agora);
                    return (
                      <tr key={i.id} className="border-b last:border-0">
                        <td className="max-w-72 px-3 py-2">
                          <Link href={`/conteudo/itens/${i.id}`} className="font-medium break-words hover:underline">
                            {i.titulo}
                          </Link>
                          <p className="text-muted-foreground flex items-center gap-1 text-xs">
                            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: i.marca.cor }} />
                            {i.marca.nome}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          {i.formatoRef ? (
                            <span className="inline-flex items-center gap-1.5">
                              <SeloPlataforma plataforma={i.formatoRef.canal.plataforma} /> {i.formatoRef.nome}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Sem formato</span>
                          )}
                        </td>
                        <td className="px-3 py-2">{i.responsavel?.nome ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2 tabular-nums">{diaCurto(i.dataGravacao)}</td>
                        <td className={cn("px-3 py-2 tabular-nums", atrasado && "text-perigo font-medium")}>
                          {diaCurto(i.dataPublicacao)}
                          {atrasado && <span className="sr-only"> (atrasado)</span>}
                        </td>
                        <td className="px-3 py-2">
                          <SeletorEtapa conteudoId={i.id} etapa={i.etapa} compacto />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Calendário da produção: cada conteúdo no dia da gravação (claquete) e no dia da publicação, na cor da etapa. */
function CalendarioProducao({ grade, itens, hoje }: { mes: string; grade: DiaGrade[][]; itens: CartaoConteudo[]; hoje: string }) {
  type Evento = { id: string; tipo: "publicacao" | "gravacao"; item: CartaoConteudo };
  const porDia = new Map<string, Evento[]>();
  const adicionar = (dia: string, e: Evento) => porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  for (const item of itens) {
    if (item.dataGravacao) adicionar(diaDaDataEntrega(item.dataGravacao), { id: `${item.id}-g`, tipo: "gravacao", item });
    if (item.dataPublicacao) adicionar(diaDaDataEntrega(item.dataPublicacao), { id: `${item.id}-p`, tipo: "publicacao", item });
  }

  return (
    <>
      {/* A grade rola dentro do próprio cartão quando não cabe; a página nunca rola de lado. */}
      <div className="bg-card relative min-w-0 overflow-x-auto rounded-xl border">
        <div className="grid min-w-[48rem] grid-cols-7">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="bg-muted/40 text-muted-foreground border-b px-2 py-1.5 text-xs font-medium">
              {d}
            </div>
          ))}
          {grade.flat().map(({ dia, doMes }) => {
            const eventos = porDia.get(dia) ?? [];
            const ehHoje = dia === hoje;
            return (
              <div
                key={dia}
                className={cn(
                  "min-h-28 min-w-0 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                  !doMes && "bg-muted/30 text-muted-foreground",
                )}
              >
                <div className="group/dia mb-1 flex items-center justify-between">
                  <p
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                      ehHoje && "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {Number(dia.slice(8))}
                    {ehHoje && <span className="sr-only"> (hoje)</span>}
                  </p>
                  <BotaoNovoConteudo
                    icone
                    dataPublicacao={dia}
                    rotulo={`Novo conteúdo para ${dia.slice(8)}/${dia.slice(5, 7)}`}
                    className="opacity-60 group-hover/dia:opacity-100 focus-visible:opacity-100"
                  />
                </div>
                <ul className="grid gap-1">
                  {eventos.map(({ id, tipo, item }) => (
                    <li key={id} className="min-w-0">
                      <Link
                        href={`/conteudo/itens/${item.id}`}
                        title={`${tipo === "gravacao" ? "Gravação" : "Publicação"}: ${item.titulo} · ${ROTULO_ETAPA[item.etapa]}`}
                        className={cn(
                          "text-foreground hover:bg-muted flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
                          tipo === "gravacao" && "border-dashed",
                        )}
                        style={{
                          backgroundColor: `color-mix(in oklab, ${COR_ETAPA[item.etapa]} 14%, transparent)`,
                          borderColor: COR_ETAPA[item.etapa],
                        }}
                      >
                        {tipo === "gravacao" ? (
                          <ClapperboardIcon className="size-3 shrink-0" aria-label="Gravação" />
                        ) : (
                          item.publicacoes
                            .slice(0, 2)
                            .map((p, i) => <SeloPlataforma key={i} plataforma={p.canal.plataforma} publicado={p.status === "publicado"} />)
                        )}
                        <span className="truncate">{item.titulo}</span>
                        <span className="sr-only"> ({ROTULO_ETAPA[item.etapa]})</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {ETAPAS_DO_QUADRO.concat("publicado" as never).map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: COR_ETAPA[e] }} />
            {ROTULO_ETAPA[e]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <ClapperboardIcon className="size-3" aria-hidden /> tracejado = dia da gravação
        </span>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Publicados

type CampoMetrica = "alcance" | "visualizacoes" | "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos";

type ComMetricas = Pick<LinhaPublicado, CampoMetrica>;

function somar(linhas: ComMetricas[], campo: CampoMetrica) {
  const valores = linhas.map((l) => l[campo]).filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

function metricasDe(linhas: ComMetricas[]) {
  return {
    alcance: somar(linhas, "alcance"),
    curtidas: somar(linhas, "curtidas"),
    comentarios: somar(linhas, "comentarios"),
    compartilhamentos: somar(linhas, "compartilhamentos"),
    salvamentos: somar(linhas, "salvamentos"),
  };
}

const COLUNAS_METRICA: { campo: CampoMetrica; rotulo: string; curto: string }[] = [
  { campo: "alcance", rotulo: "Alcance", curto: "Alcance" },
  { campo: "visualizacoes", rotulo: "Visualizações", curto: "Visualizações" },
  { campo: "curtidas", rotulo: "Curtidas", curto: "Curtidas" },
  { campo: "comentarios", rotulo: "Comentários", curto: "Coment." },
  { campo: "compartilhamentos", rotulo: "Compartilhamentos", curto: "Compart." },
  { campo: "salvamentos", rotulo: "Salvos", curto: "Salvos" },
];

const pct = (v: number | null) => (v === null ? "—" : `${numero.format(v)}%`);
const dataCurta = (d: Date | null) => (d ? formatarDataHora(d).split(",")[0] : "—");

function LinkAbrir({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir publicação"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

export function TelaPublicados({
  mes,
  linhas: todas,
  midias = [],
  ordem = "data",
}: {
  mes: string;
  linhas: LinhaPublicado[];
  /** Posts e stories do Instagram no mês (C2a), já na ordem escolhida. */
  midias?: LinhaMidia[];
  ordem?: OrdemMidia;
}) {
  // A publicação ligada a um post do Instagram aparece na seção Instagram, com os números do post.
  const linhas = todas.filter((l) => !l.midia);
  // Totais por canal no mês: as publicações manuais e os posts do Instagram de cada canal.
  type Grupo = { canal: LinhaPublicado["canal"]; marca: LinhaPublicado["conteudo"]["marca"]; itens: ComMetricas[] };
  const porCanal = new Map<string, Grupo>();
  const juntar = (canal: Grupo["canal"], marca: Grupo["marca"], item: ComMetricas) => {
    const g = porCanal.get(canal.id) ?? { canal, marca, itens: [] };
    g.itens.push(item);
    porCanal.set(canal.id, g);
  };
  for (const l of linhas) juntar(l.canal, l.conteudo.marca, l);
  for (const m of midias) if (m.conta.canal) juntar(m.conta.canal, m.conta.canal.marca, m);
  const totais = [...porCanal.values()].map((g) => {
    const t = metricasDe(g.itens);
    return { canal: g.canal, marca: g.marca, quantidade: g.itens.length, alcance: t.alcance, engajamento: taxaEngajamento(t) };
  });
  // Totais do mês (mesmos dados, somados).
  const geral = metricasDe([...linhas, ...midias]);
  const interacoes = [geral.curtidas, geral.comentarios, geral.compartilhamentos, geral.salvamentos].some((v) => v !== null)
    ? (geral.curtidas ?? 0) + (geral.comentarios ?? 0) + (geral.compartilhamentos ?? 0) + (geral.salvamentos ?? 0)
    : null;

  return (
    <div className="grid grid-cols-1 gap-6">
      <CabecalhoPagina
        titulo="Publicados"
        descricao={`${nomeMes(mes)} · cada publicação por canal, com link e métricas.`}
        acoes={<NavegacaoMes mes={mes} url={(m) => `/conteudo/publicados?mes=${m}`} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <CartaoNumero rotulo="Publicações" icone={SendIcon} valor={linhas.length + midias.length} />
        <CartaoNumero rotulo="Alcance" icone={UsersIcon} valor={fmt(geral.alcance)} />
        <CartaoNumero rotulo="Interações" icone={HeartIcon} valor={fmt(interacoes)} />
        <CartaoNumero rotulo="Engajamento médio" icone={PercentIcon} valor={pct(taxaEngajamento(geral))} />
      </div>

      {totais.length > 0 && (
        <section aria-labelledby="sec-canais" className="grid gap-3">
          <h2 id="sec-canais" className={CLASSE_TITULO_SECAO}>
            Por canal
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {totais.map((t) => (
              <div key={t.canal.id} className="bg-card text-card-foreground grid min-w-0 gap-1 rounded-xl border p-4 text-sm">
                <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.marca.cor }} />
                  <span className="truncate">{t.marca.nome}</span>
                </p>
                <NomeCanal plataforma={t.canal.plataforma} identificador={t.canal.identificador} />
                <p className="text-muted-foreground">
                  {t.quantidade} {t.quantidade === 1 ? "publicação" : "publicações"} · alcance {fmt(t.alcance)} · engajamento{" "}
                  {pct(t.engajamento)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {midias.length > 0 && <ListaMidiasInstagram midias={midias} ordem={ordem} mes={mes} />}

      {linhas.length === 0 && midias.length > 0 ? null : linhas.length === 0 ? (
        <EstadoVazio
          icone={SendIcon}
          titulo="Nada publicado neste mês"
          descricao="Marque as publicações como feitas no detalhe de cada conteúdo finalizado."
        />
      ) : (
        <section aria-labelledby="sec-lista" className="@container grid min-w-0 gap-3">
          <h2 id="sec-lista" className={CLASSE_TITULO_SECAO}>
            Publicações
          </h2>
          {/* Tabela quando o espaço permite; cartões quando não. */}
          <div className="bg-card relative hidden overflow-x-auto rounded-xl border @4xl:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Conteúdo</th>
                  <th className="px-3 py-2 font-medium">Canal</th>
                  <th className="px-3 py-2 font-medium">Publicado em</th>
                  {COLUNAS_METRICA.map((c) => (
                    <th key={c.campo} className="px-3 py-2 text-right font-medium">
                      {c.curto}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Engaj.</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/50 border-t">
                    <td className="max-w-72 px-3 py-2">
                      <Link
                        href={`/conteudo/itens/${l.conteudo.id}`}
                        className="text-foreground block truncate font-medium hover:underline"
                      >
                        {l.conteudo.titulo}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {l.conteudo.marca.nome} · {l.conteudo.formatoRef?.nome ?? "Sem formato"}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <NomeCanal plataforma={l.canal.plataforma} identificador={null} />
                        <LinkAbrir url={l.url} />
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{dataCurta(l.publicadoEm)}</td>
                    {COLUNAS_METRICA.map((c) => (
                      <td key={c.campo} className="px-3 py-2 text-right tabular-nums">
                        {fmt(l[c.campo])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{pct(taxaEngajamento(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid grid-cols-1 gap-2 @4xl:hidden">
            {linhas.map((l) => (
              <li key={l.id} className="bg-card text-card-foreground grid min-w-0 gap-2 rounded-xl border p-3 text-sm">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/conteudo/itens/${l.conteudo.id}`}
                      className="text-foreground block font-medium break-words hover:underline"
                    >
                      {l.conteudo.titulo}
                    </Link>
                    <span className="text-muted-foreground text-xs">
                      {l.conteudo.marca.nome} · {l.conteudo.formatoRef?.nome ?? "Sem formato"}
                    </span>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="text-muted-foreground block text-xs">Engaj.</span>
                    <span className="font-semibold tabular-nums">{pct(taxaEngajamento(l))}</span>
                  </span>
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-foreground inline-flex items-center gap-2">
                    <NomeCanal plataforma={l.canal.plataforma} identificador={null} />
                    <LinkAbrir url={l.url} />
                  </span>
                  <span>{dataCurta(l.publicadoEm)}</span>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                  {COLUNAS_METRICA.map((c) => (
                    <div key={c.campo} className="min-w-0">
                      <dt className="text-muted-foreground truncate">{c.rotulo}</dt>
                      <dd className="font-medium tabular-nums">{fmt(l[c.campo])}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-muted-foreground text-xs">
        Engajamento = (curtidas + comentários + compartilhamentos + salvos) ÷ alcance. As métricas são preenchidas no detalhe do conteúdo; a
        sincronização automática com o Instagram vem na próxima fase.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Detalhe

export type DadosItemConteudo = Awaited<ReturnType<typeof obterConteudo>>;

export function TelaItemConteudo({ conteudo, pessoas, podeAprovar }: DadosItemConteudo) {
  const liberada = conteudo.etapa === "aprovado" || conteudo.etapa === "publicado";
  const autoria =
    `Criado por ${conteudo.criadoPor.nome} em ${formatarDataHora(conteudo.criadoEm)}` +
    (conteudo.aprovadoPor && conteudo.aprovadoEm
      ? ` · Finalizado por ${conteudo.aprovadoPor.nome} em ${formatarDataHora(conteudo.aprovadoEm)}`
      : "");

  return (
    // A key remonta os formulários quando o conteúdo muda no servidor.
    <div key={conteudo.atualizadoEm.toISOString()} className="grid max-w-4xl grid-cols-1 gap-6">
      <div className="grid gap-3">
        <Link
          href="/conteudo/producao"
          className="text-muted-foreground flex min-w-0 items-center gap-1.5 justify-self-start text-sm hover:underline"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: conteudo.marca.cor }} />
          <span className="truncate">
            {conteudo.marca.nome} ·{" "}
            {rotuloCanalFormato({
              plataforma: conteudo.marca.canais.find((k) => k.id === conteudo.formatoRef?.canalId)?.plataforma ?? null,
              formato: conteudo.formatoRef?.nome ?? null,
            })}
          </span>
        </Link>
        <CabecalhoPagina titulo={conteudo.titulo} descricao={autoria} />
        <div className="flex flex-wrap items-center gap-2">
          <BadgeEtapa etapa={conteudo.etapa} tamanho="md" />
          <ChipPublicacao dataPublicacao={conteudo.dataPublicacao} etapa={conteudo.etapa} tamanho="md" />
          <SeletorEtapa conteudoId={conteudo.id} etapa={conteudo.etapa} />
          {conteudo.etapa === "edicao" && !podeAprovar && (
            <span className="text-muted-foreground text-sm">Um gestor move para Finalizado quando aprovar.</span>
          )}
        </div>
      </div>

      <section aria-labelledby="sec-anotacoes" className="grid gap-2">
        <h2 id="sec-anotacoes" className={CLASSE_TITULO_SECAO}>
          Anotações e roteiro
        </h2>
        <EditorBlocos conteudoId={conteudo.id} roteiro={conteudo.roteiro} />
      </section>

      <Separator />

      <section aria-labelledby="sec-dados" className="grid gap-4">
        <h2 id="sec-dados" className={CLASSE_TITULO_SECAO}>
          Dados do conteúdo
        </h2>
        <EditorConteudo
          conteudo={conteudo}
          conta={conteudo.marca}
          canaisSelecionados={conteudo.publicacoes.map((p) => p.canalId)}
          pessoas={pessoas}
        />
      </section>

      <Separator />

      <section aria-labelledby="sec-pub" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="sec-pub" className={CLASSE_TITULO_SECAO}>
            Publicações nos canais
          </h2>
          <p className="text-muted-foreground text-sm">
            Depois de publicar em cada canal, marque aqui com o link. Quando todos estiverem marcados, o conteúdo vira Publicado.
          </p>
        </div>
        <PublicacoesConteudo publicacoes={conteudo.publicacoes} liberada={liberada} />
      </section>
    </div>
  );
}

const formatoAtualizado = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Aba Relatórios: Instagrams conectados e os números do mês da conta escolhida (ou de todas). */
export function TelaRelatorios({
  mes,
  dados,
  podeIntegrar,
}: {
  mes: string;
  /** `null` quando nenhuma conta do filtro tem Instagram ligado. */
  dados: RelatorioInstagram | null;
  podeIntegrar: boolean;
}) {
  const url = (o: { mes?: string; conta?: string | null }) => {
    const p = new URLSearchParams({ mes: o.mes ?? mes });
    const conta = o.conta === undefined ? dados?.contaId : o.conta;
    if (conta) p.set("conta", conta);
    return `/conteudo/relatorios?${p}`;
  };
  const estiloConta = (ativa: boolean) =>
    cn(
      "bg-card focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left text-sm focus-visible:ring-2 focus-visible:outline-none",
      ativa ? "border-primary ring-primary/30 ring-1" : "hover:bg-muted/50",
    );

  return (
    <div className="grid grid-cols-1 gap-6">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao={`${nomeMes(mes)} · números do Instagram de cada conta conectada.`}
        acoes={<NavegacaoMes mes={mes} url={(m) => url({ mes: m })} mostrarHoje />}
      />

      {!dados ? (
        <EstadoVazio
          icone={UsersIcon}
          titulo="Nenhum Instagram conectado"
          descricao="Os números aparecem aqui quando uma conta do Instagram está ligada a um canal."
          acao={
            podeIntegrar ? (
              <Link href="/conteudo/integracao-instagram" className="text-primary text-sm underline-offset-4 hover:underline">
                Abrir a integração
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <section aria-labelledby="sec-contas" className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="sec-contas" className={CLASSE_TITULO_SECAO}>
                Instagrams conectados
              </h2>
              <p className="text-muted-foreground text-xs">
                {dados.atualizadoEm
                  ? `Atualizados em ${formatoAtualizado.format(dados.atualizadoEm).replace(",", " às")}`
                  : "Ainda sem atualização concluída."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dados.contas.length > 1 && (
                <Link
                  href={url({ conta: null })}
                  aria-current={!dados.contaId ? "true" : undefined}
                  className={estiloConta(!dados.contaId)}
                >
                  <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
                    <UsersIcon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">Todas as contas</span>
                    <span className="text-muted-foreground text-xs">{dados.contas.length} contas somadas</span>
                  </span>
                </Link>
              )}
              {dados.contas.map((c) => {
                const ativa = dados.contaId === c.id || dados.contas.length === 1;
                return (
                  <Link key={c.id} href={url({ conta: c.id })} aria-current={ativa ? "true" : undefined} className={estiloConta(ativa)}>
                    <FotoConta url={c.fotoUrl} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">@{c.usuario}</span>
                      <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                        {c.canal?.marca && (
                          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.canal.marca.cor }} />
                        )}
                        {c.canal?.marca?.nome}
                        {c.seguidores !== null && ` · ${numero.format(c.seguidores)} seguidores`}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
          <BlocoRelatorio dados={dados} mes={mes} />
        </>
      )}
    </div>
  );
}
