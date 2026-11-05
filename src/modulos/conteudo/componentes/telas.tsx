// Telas do módulo Conteúdo (só apresentação). As páginas em src/app/(app)/conteudo buscam os dados e
// passam para cá; assim a prévia visual usa exatamente o mesmo desenho.
import {
  CalendarX,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  FolderOpenIcon,
  HeartIcon,
  KanbanIcon,
  LightbulbIcon,
  PercentIcon,
  SendIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { formatarDataHora } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { CLASSE_TITULO_SECAO } from "@/modulos/tarefas/componentes/exibicao";
import { diaDaDataEntrega } from "@/modulos/tarefas/regras/prazo";
import { COR_PLATAFORMA, ROTULO_FORMATO, ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import { mesAnterior, mesAtual, proximoMes, taxaEngajamento, type DiaGrade } from "../regras/calendario";
import { COR_ETAPA, ETAPAS_DO_QUADRO, ROTULO_ETAPA } from "../regras/etapas";
import type { CartaoConteudo, LinhaPublicado, obterConteudo } from "../servicos/conteudos";
import { Separator } from "@/componentes/ui/separator";
import { BadgeEtapa, Cartao, ChipPublicacao, NomeCanal, SeloPlataforma } from "./exibicao";
import { EditorConteudo } from "./editor-conteudo";
import { PublicacoesConteudo } from "./publicacoes-conteudo";
import { SeletorEtapa } from "./seletor-etapa";
import { BlocoInstagram } from "./bloco-instagram";
import type { VisaoInstagram } from "../servicos/visao-instagram";

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

function TituloBloco({ id, titulo, total, perigo }: { id: string; titulo: string; total: number; perigo?: boolean }) {
  return (
    <h2 id={id} className={cn("font-semibold", perigo && total > 0 ? "text-perigo" : "text-foreground")}>
      {titulo} <span className="text-muted-foreground font-normal tabular-nums">{total}</span>
    </h2>
  );
}

// ---------------------------------------------------------------- Visão geral

export type DadosVisaoGeral = {
  atrasados: CartaoConteudo[];
  proximos: CartaoConteudo[];
  gravacoes: CartaoConteudo[];
  aguardandoEdicao: number;
  ideias: number;
  publicadosMes: { canal: { plataforma: Plataforma } }[];
};

function Bloco(props: {
  id: string;
  titulo: string;
  itens: CartaoConteudo[];
  vazio: string;
  icone: LucideIcon;
  perigo?: boolean;
  gravacao?: boolean;
  agora: Date;
}) {
  const { id, titulo, itens, vazio, icone, perigo, gravacao, agora } = props;
  return (
    <section className="grid min-w-0 content-start gap-2" aria-labelledby={id}>
      <TituloBloco id={id} titulo={titulo} total={itens.length} perigo={perigo} />
      {itens.length === 0 ? (
        <EstadoVazio icone={icone} titulo={vazio} compacto />
      ) : (
        <div className="grid gap-2">
          {itens.map((i) => (
            <Cartao key={i.id} item={i} mostrarGravacao={gravacao} agora={agora} />
          ))}
        </div>
      )}
    </section>
  );
}

const estiloLinkNumero =
  "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none hover:[&>div]:bg-muted/50 [&>div]:transition-colors";

export function TelaVisaoGeral({
  v,
  instagram,
  agora = new Date(),
}: {
  v: DadosVisaoGeral;
  /** Bloco do Instagram (C2a); `dados` é `null` quando nenhuma conta do filtro está ligada. */
  instagram?: { dados: VisaoInstagram | null; podeIntegrar: boolean };
  agora?: Date;
}) {
  // Publicados do mês por plataforma.
  const porPlataforma = new Map<Plataforma, number>();
  for (const p of v.publicadosMes) porPlataforma.set(p.canal.plataforma, (porPlataforma.get(p.canal.plataforma) ?? 0) + 1);

  return (
    <div className="grid grid-cols-1 gap-6">
      <CabecalhoPagina titulo="Visão geral" descricao="O que precisa de atenção na produção de conteúdo." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <Link href="/conteudo/planejamento" className={estiloLinkNumero}>
          <CartaoNumero
            rotulo="Atrasados"
            icone={CalendarX}
            valor={v.atrasados.length}
            tom={v.atrasados.length > 0 ? "perigo" : "neutro"}
          />
        </Link>
        <Link href="/conteudo/planejamento" className={estiloLinkNumero}>
          <CartaoNumero rotulo="Banco de ideias" icone={LightbulbIcon} valor={v.ideias} />
        </Link>
        <Link href="/conteudo/gravacoes" className={estiloLinkNumero}>
          <CartaoNumero rotulo="Gravados aguardando edição" icone={ClapperboardIcon} valor={v.aguardandoEdicao} />
        </Link>
        <Link href="/conteudo/publicados" className={estiloLinkNumero}>
          <CartaoNumero rotulo="Publicados no mês" icone={SendIcon} valor={v.publicadosMes.length} />
        </Link>
      </div>

      {porPlataforma.size > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Publicados no mês por plataforma">
          {[...porPlataforma].map(([plataforma, total]) => (
            <li key={plataforma} className="min-w-0">
              <ChipSituacao cor={COR_PLATAFORMA[plataforma]}>
                <span className="inline-flex items-center gap-1.5">
                  <SeloPlataforma plataforma={plataforma} />
                  {ROTULO_PLATAFORMA[plataforma]}: {total}
                </span>
              </ChipSituacao>
            </li>
          ))}
        </ul>
      )}

      {instagram && <BlocoInstagram dados={instagram.dados} podeIntegrar={instagram.podeIntegrar} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Bloco id="bloco-atrasados" titulo="Atrasados" itens={v.atrasados} vazio="Nada atrasado." icone={CalendarX} perigo agora={agora} />
        <Bloco
          id="bloco-proximos"
          titulo="Publicar nos próximos 7 dias"
          itens={v.proximos}
          vazio="Nada previsto para a semana."
          icone={SendIcon}
          agora={agora}
        />
        <Bloco
          id="bloco-gravacoes"
          titulo="Gravações marcadas"
          itens={v.gravacoes}
          vazio="Nenhuma gravação marcada."
          icone={VideoIcon}
          gravacao
          agora={agora}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Planejamento

export function TelaPlanejamento({
  quadro,
  agora = new Date(),
}: {
  quadro: Record<(typeof ETAPAS_DO_QUADRO)[number], CartaoConteudo[]>;
  agora?: Date;
}) {
  const total = ETAPAS_DO_QUADRO.reduce((n, e) => n + quadro[e].length, 0);
  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPagina titulo="Planejamento" descricao="Da ideia à aprovação. Publicados ficam na aba Publicados." />
      {total === 0 ? (
        <EstadoVazio
          icone={KanbanIcon}
          titulo="Nenhum conteúdo em produção"
          descricao="Crie um conteúdo em “Novo conteúdo”, no menu do módulo. Ele começa como ideia."
        />
      ) : (
        // No celular as colunas empilham; da tela média em diante o quadro rola dentro do próprio espaço.
        <div className="relative min-w-0 md:overflow-x-auto md:pb-2">
          <div className="flex flex-col gap-3 md:flex-row">
            {ETAPAS_DO_QUADRO.map((etapa) => (
              <section
                key={etapa}
                aria-labelledby={`col-${etapa}`}
                className="bg-muted/40 grid min-w-0 content-start gap-2 rounded-xl border p-2 md:w-64 md:shrink-0"
              >
                <h2 id={`col-${etapa}`} className="flex items-center gap-2 px-1 py-0.5 text-sm font-semibold">
                  <ChipSituacao cor={COR_ETAPA[etapa]} tamanho="sm">
                    {ROTULO_ETAPA[etapa]}
                  </ChipSituacao>
                  <span className="text-muted-foreground font-normal tabular-nums">{quadro[etapa].length}</span>
                </h2>
                {quadro[etapa].map((item) => (
                  <Cartao
                    key={item.id}
                    item={item}
                    agora={agora}
                    mostrarGravacao={etapa === "a_gravar"}
                    acoes={<SeletorEtapa conteudoId={item.id} etapa={item.etapa} compacto />}
                  />
                ))}
                {quadro[etapa].length === 0 && <p className="text-muted-foreground px-1 py-2 text-xs">Vazio</p>}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Calendário

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function TelaCalendario({
  mes,
  comGravacoes,
  grade,
  itens,
  hoje,
}: {
  mes: string;
  comGravacoes: boolean;
  grade: DiaGrade[][];
  itens: CartaoConteudo[];
  hoje: string;
}) {
  type Evento = { id: string; tipo: "publicacao" | "gravacao"; item: CartaoConteudo };
  const porDia = new Map<string, Evento[]>();
  const adicionar = (dia: string, e: Evento) => porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  for (const item of itens) {
    if (item.dataPublicacao) adicionar(diaDaDataEntrega(item.dataPublicacao), { id: `${item.id}-p`, tipo: "publicacao", item });
    if (comGravacoes && item.dataGravacao) adicionar(diaDaDataEntrega(item.dataGravacao), { id: `${item.id}-g`, tipo: "gravacao", item });
  }

  const url = (extra: Record<string, string>) =>
    `/conteudo/calendario?${new URLSearchParams({ ...(comGravacoes ? { gravacoes: "1" } : {}), mes, ...extra })}`;

  return (
    <div className="grid grid-cols-1 gap-4">
      <CabecalhoPagina
        titulo="Calendário"
        descricao={nomeMes(mes)}
        acoes={
          <>
            <NavegacaoMes mes={mes} url={(m) => url({ mes: m })} mostrarHoje />
            <Link
              href={`/conteudo/calendario?${new URLSearchParams({ mes, ...(comGravacoes ? {} : { gravacoes: "1" }) })}`}
              className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1 text-sm"
              aria-pressed={comGravacoes}
            >
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded border",
                  comGravacoes && "border-primary bg-primary text-primary-foreground",
                )}
                aria-hidden
              >
                {comGravacoes && <CheckIcon className="size-3" />}
              </span>
              Mostrar gravações
            </Link>
          </>
        }
      />

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
                <p
                  className={cn(
                    "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    ehHoje && "bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {Number(dia.slice(8))}
                  {ehHoje && <span className="sr-only"> (hoje)</span>}
                </p>
                <ul className="grid gap-1">
                  {eventos.map(({ id, tipo, item }) => (
                    <li key={id} className="min-w-0">
                      <Link
                        href={`/conteudo/itens/${item.id}`}
                        title={`${item.titulo} · ${tipo === "gravacao" ? "Gravação" : ROTULO_ETAPA[item.etapa]}`}
                        className={cn(
                          "text-foreground hover:bg-muted flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
                          tipo === "gravacao" && "bg-informacao-suave border-informacao/40 border-dashed",
                        )}
                        style={
                          tipo === "publicacao"
                            ? {
                                backgroundColor: `color-mix(in oklab, ${COR_ETAPA[item.etapa]} 14%, transparent)`,
                                borderColor: COR_ETAPA[item.etapa],
                              }
                            : undefined
                        }
                      >
                        {tipo === "gravacao" ? (
                          <ClapperboardIcon className="text-informacao size-3 shrink-0" aria-label="Gravação" />
                        ) : (
                          item.publicacoes
                            .slice(0, 2)
                            .map((p, i) => <SeloPlataforma key={i} plataforma={p.canal.plataforma} publicado={p.status === "publicado"} />)
                        )}
                        <span className="truncate">{item.titulo}</span>
                        {tipo === "publicacao" && <span className="sr-only"> ({ROTULO_ETAPA[item.etapa]})</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        A cor do item indica a etapa; gravações aparecem tracejadas. Selos com contorno verde já foram publicados naquele canal.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Gravações

export function TelaGravacoes({
  aGravar,
  gravados,
  agora = new Date(),
}: {
  aGravar: CartaoConteudo[];
  gravados: (CartaoConteudo & { linkMaterial: string | null })[];
  agora?: Date;
}) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <CabecalhoPagina titulo="Gravações" descricao="Agenda de gravação e o banco de material gravado que ainda não foi publicado." />

      <section aria-labelledby="sec-agravar" className="grid gap-3">
        <TituloBloco id="sec-agravar" titulo="A gravar" total={aGravar.length} />
        {aGravar.length === 0 ? (
          <EstadoVazio
            icone={VideoIcon}
            titulo="Nada para gravar"
            descricao="Mova um conteúdo para a etapa “A gravar” e marque a data no detalhe."
            compacto
          />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {aGravar.map((i) => (
              <Cartao
                key={i.id}
                item={i}
                agora={agora}
                mostrarGravacao
                acoes={<SeletorEtapa conteudoId={i.id} etapa={i.etapa} compacto />}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="sec-gravados" className="grid gap-3">
        <div>
          <TituloBloco id="sec-gravados" titulo="Banco de gravados" total={gravados.length} />
          <p className="text-muted-foreground text-sm">Material gravado ou em edição, esperando para ser publicado.</p>
        </div>
        {gravados.length === 0 ? (
          <EstadoVazio icone={ClapperboardIcon} titulo="Nenhum material gravado pendente." compacto />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {gravados.map((i) => (
              <Cartao
                key={i.id}
                item={i}
                agora={agora}
                acoes={
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <SeletorEtapa conteudoId={i.id} etapa={i.etapa} compacto />
                    </div>
                    {i.linkMaterial && (
                      <a
                        href={i.linkMaterial}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-muted focus-visible:ring-ring inline-flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs focus-visible:ring-2 focus-visible:outline-none"
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

// ---------------------------------------------------------------- Publicados

type CampoMetrica = "alcance" | "visualizacoes" | "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos";

function somar(linhas: LinhaPublicado[], campo: CampoMetrica) {
  const valores = linhas.map((l) => l[campo]).filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

function metricasDe(linhas: LinhaPublicado[]) {
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

export function TelaPublicados({ mes, linhas }: { mes: string; linhas: LinhaPublicado[] }) {
  // Totais por canal no mês.
  const porCanal = new Map<string, LinhaPublicado[]>();
  for (const l of linhas) porCanal.set(l.canal.id, [...(porCanal.get(l.canal.id) ?? []), l]);
  const totais = [...porCanal.values()].map((ls) => {
    const t = metricasDe(ls);
    return { canal: ls[0].canal, marca: ls[0].conteudo.marca, quantidade: ls.length, alcance: t.alcance, engajamento: taxaEngajamento(t) };
  });
  // Totais do mês (mesmos dados, somados).
  const geral = metricasDe(linhas);
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
        <CartaoNumero rotulo="Publicações" icone={SendIcon} valor={linhas.length} />
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

      {linhas.length === 0 ? (
        <EstadoVazio
          icone={SendIcon}
          titulo="Nada publicado neste mês"
          descricao="Marque as publicações como feitas no detalhe de cada conteúdo aprovado."
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
                        {l.conteudo.marca.nome} · {ROTULO_FORMATO[l.conteudo.formato]}
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
                      {l.conteudo.marca.nome} · {ROTULO_FORMATO[l.conteudo.formato]}
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
      ? ` · Aprovado por ${conteudo.aprovadoPor.nome} em ${formatarDataHora(conteudo.aprovadoEm)}`
      : "");

  return (
    // A key remonta os formulários quando o conteúdo muda no servidor.
    <div key={conteudo.atualizadoEm.toISOString()} className="grid max-w-4xl grid-cols-1 gap-6">
      <div className="grid gap-3">
        <Link
          href="/conteudo/planejamento"
          className="text-muted-foreground flex min-w-0 items-center gap-1.5 justify-self-start text-sm hover:underline"
        >
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: conteudo.marca.cor }} />
          <span className="truncate">
            {conteudo.marca.nome} · {ROTULO_FORMATO[conteudo.formato]}
          </span>
        </Link>
        <CabecalhoPagina titulo={conteudo.titulo} descricao={autoria} />
        <div className="flex flex-wrap items-center gap-2">
          <BadgeEtapa etapa={conteudo.etapa} tamanho="md" />
          <ChipPublicacao dataPublicacao={conteudo.dataPublicacao} etapa={conteudo.etapa} tamanho="md" />
          <SeletorEtapa conteudoId={conteudo.id} etapa={conteudo.etapa} />
          {conteudo.etapa === "revisao" && !podeAprovar && (
            <span className="text-muted-foreground text-sm">Aguardando aprovação de um gestor.</span>
          )}
        </div>
      </div>

      <Separator />

      <section aria-labelledby="sec-dados" className="grid gap-4">
        <h2 id="sec-dados" className={CLASSE_TITULO_SECAO}>
          Dados do conteúdo
        </h2>
        <EditorConteudo
          conteudo={conteudo}
          canais={conteudo.marca.canais}
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
