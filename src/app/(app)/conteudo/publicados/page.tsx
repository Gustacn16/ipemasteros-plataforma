import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatarDataHora } from "@/lib/datas";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { NomeCanal } from "@/modulos/conteudo/componentes/exibicao";
import { lerFiltro, lerMes } from "@/modulos/conteudo/componentes/filtro";
import { ROTULO_FORMATO } from "@/modulos/conteudo/esquemas/conteudo";
import { mesAnterior, proximoMes, taxaEngajamento } from "@/modulos/conteudo/regras/calendario";
import { listarPublicados, type LinhaPublicado } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Publicados — IPEMaster OS" };

const numero = new Intl.NumberFormat("pt-BR");
const fmt = (v: number | null) => (v === null ? "—" : numero.format(v));
const nomeMes = (mes: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(`${mes}-01T00:00:00Z`));

function somar(linhas: LinhaPublicado[], campo: "alcance" | "visualizacoes" | "curtidas" | "comentarios" | "compartilhamentos" | "salvamentos") {
  const valores = linhas.map((l) => l[campo]).filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
}

export default async function PaginaPublicados({ searchParams }: PageProps<"/conteudo/publicados">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const mes = lerMes(busca);
  const linhas = await listarPublicados(usuario, mes, filtro);

  // Totais por canal no mês.
  const porCanal = new Map<string, LinhaPublicado[]>();
  for (const l of linhas) porCanal.set(l.canal.id, [...(porCanal.get(l.canal.id) ?? []), l]);
  const totais = [...porCanal.values()].map((ls) => {
    const t = {
      alcance: somar(ls, "alcance"),
      curtidas: somar(ls, "curtidas"),
      comentarios: somar(ls, "comentarios"),
      compartilhamentos: somar(ls, "compartilhamentos"),
      salvamentos: somar(ls, "salvamentos"),
    };
    return { canal: ls[0].canal, marca: ls[0].conteudo.marca, quantidade: ls.length, alcance: t.alcance, engajamento: taxaEngajamento(t) };
  });

  const url = (m: string) => `/conteudo/publicados?mes=${m}`;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Publicados</h1>
          <p className="text-muted-foreground">Cada publicação por canal, com link e métricas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={url(mesAnterior(mes))} className="hover:bg-muted rounded-md border p-1.5" aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <span className="min-w-40 text-center font-medium capitalize">{nomeMes(mes)}</span>
          <Link href={url(proximoMes(mes))} className="hover:bg-muted rounded-md border p-1.5" aria-label="Próximo mês">
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
      </header>

      {totais.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {totais.map((t) => (
            <div key={t.canal.id} className="grid gap-1 rounded-lg border p-4 text-sm">
              <p className="flex items-center gap-1.5 text-xs">
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: t.marca.cor }} />
                {t.marca.nome}
              </p>
              <NomeCanal plataforma={t.canal.plataforma} identificador={t.canal.identificador} />
              <p className="text-muted-foreground">
                {t.quantidade} {t.quantidade === 1 ? "publicação" : "publicações"} · alcance {fmt(t.alcance)} · engajamento{" "}
                {t.engajamento === null ? "—" : `${numero.format(t.engajamento)}%`}
              </p>
            </div>
          ))}
        </div>
      )}

      {linhas.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
          Nada publicado neste mês. Marque as publicações como feitas no detalhe de cada conteúdo aprovado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 font-medium">Conteúdo</th>
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 font-medium">Publicado em</th>
                <th className="px-3 py-2 text-right font-medium">Alcance</th>
                <th className="px-3 py-2 text-right font-medium">Visualizações</th>
                <th className="px-3 py-2 text-right font-medium">Curtidas</th>
                <th className="px-3 py-2 text-right font-medium">Coment.</th>
                <th className="px-3 py-2 text-right font-medium">Compart.</th>
                <th className="px-3 py-2 text-right font-medium">Salvos</th>
                <th className="px-3 py-2 text-right font-medium">Engaj.</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const taxa = taxaEngajamento(l);
                return (
                  <tr key={l.id} className="border-t">
                    <td className="max-w-72 px-3 py-2">
                      <Link href={`/conteudo/itens/${l.conteudo.id}`} className="block truncate font-medium hover:underline">
                        {l.conteudo.titulo}
                      </Link>
                      <span className="text-muted-foreground text-xs">
                        {l.conteudo.marca.nome} · {ROTULO_FORMATO[l.conteudo.formato]}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <NomeCanal plataforma={l.canal.plataforma} identificador={null} />
                        {l.url && (
                          <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir publicação" className="text-muted-foreground hover:text-foreground">
                            <ExternalLinkIcon className="size-3.5" />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{l.publicadoEm ? formatarDataHora(l.publicadoEm).split(",")[0] : "—"}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.alcance)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.visualizacoes)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.curtidas)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.comentarios)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.compartilhamentos)}</td>
                    <td className="px-3 py-2 text-right">{fmt(l.salvamentos)}</td>
                    <td className="px-3 py-2 text-right font-medium">{taxa === null ? "—" : `${numero.format(taxa)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Engajamento = (curtidas + comentários + compartilhamentos + salvos) ÷ alcance. As métricas são preenchidas no detalhe do conteúdo; a
        sincronização automática com o Instagram vem na próxima fase.
      </p>
    </div>
  );
}
