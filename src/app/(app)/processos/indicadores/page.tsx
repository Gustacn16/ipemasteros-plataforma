import { ActivityIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { CLASSE_TEXTO_TOM } from "@/componentes/regras-visuais";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { LancarResultado } from "@/modulos/processos/componentes/indicadores";
import { ROTULO_FREQUENCIA, VISUAL_SITUACAO_INDICADOR, formatarValor, rotuloPeriodo, tomDaMedicao, type SituacaoIndicador } from "@/modulos/processos/regras/indicadores";
import { obterPainel, type IndicadorPainel } from "@/modulos/processos/servicos/indicadores";

export const metadata: Metadata = { title: "Indicadores — IPEMaster OS" };

const ORDEM: SituacaoIndicador[] = ["fora_da_meta", "atrasado", "sem_medicao", "sem_meta", "na_meta"];

function Ultimo({ i }: { i: IndicadorPainel }) {
  const u = i.medicoes.at(-1);
  if (!u) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="grid">
      <span className={cn("font-semibold tabular-nums", CLASSE_TEXTO_TOM[tomDaMedicao(u.valor, u.meta, i.sentido)])}>{formatarValor(u.valor, i.unidade)}</span>
      <span className="text-muted-foreground text-xs">{rotuloPeriodo(u.periodo, i.frequencia)}</span>
    </span>
  );
}

export default async function PaginaIndicadores({ searchParams }: PageProps<"/processos/indicadores">) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const { situacao, meus } = await searchParams;
  const todos = await obterPainel(usuario);
  const filtroSituacao = ORDEM.find((s) => s === situacao);
  const soMeus = meus === "1";
  const lista = todos
    .filter((i) => (filtroSituacao ? i.situacao === filtroSituacao : true))
    .filter((i) => (soMeus ? i.responsavelId === usuario.id : true))
    .sort((a, b) => ORDEM.indexOf(a.situacao) - ORDEM.indexOf(b.situacao) || a.nome.localeCompare(b.nome, "pt-BR"));
  const contagem = (s: SituacaoIndicador) => todos.filter((i) => i.situacao === s).length;
  const meusTotal = todos.filter((i) => i.responsavelId === usuario.id).length;
  const href = (p: { situacao?: string; meus?: boolean }) => {
    const q = new URLSearchParams();
    if (p.situacao) q.set("situacao", p.situacao);
    if (p.meus) q.set("meus", "1");
    const s = q.toString();
    return s ? `/processos/indicadores?${s}` : "/processos/indicadores";
  };

  if (todos.length === 0) {
    return <EstadoVazio icone={ActivityIcon} titulo="Nenhum indicador ainda" descricao="Os itens de controle são criados dentro de cada processo." />;
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2" aria-label="Filtrar por situação">
        <Link href={href({ meus: soMeus })} className={cn("rounded-full border px-3 py-1 text-sm", !filtroSituacao ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted")}>
          Todos {todos.length}
        </Link>
        {ORDEM.filter((s) => contagem(s) > 0).map((s) => (
          <Link key={s} href={href({ situacao: s, meus: soMeus })} aria-current={filtroSituacao === s ? "true" : undefined} className={cn("rounded-full", filtroSituacao === s && "ring-primary ring-2")}>
            <ChipSituacao tom={VISUAL_SITUACAO_INDICADOR[s].tom}>
              {VISUAL_SITUACAO_INDICADOR[s].rotulo} {contagem(s)}
            </ChipSituacao>
          </Link>
        ))}
        {meusTotal > 0 && (
          <Link href={href({ situacao: filtroSituacao, meus: !soMeus })} className={cn("ml-auto rounded-full border px-3 py-1 text-sm", soMeus ? "border-primary bg-primary/10 text-primary font-medium" : "hover:bg-muted")}>
            Sob minha responsabilidade {meusTotal}
          </Link>
        )}
      </div>

      {lista.length === 0 ? (
        <EstadoVazio icone={ActivityIcon} titulo="Nada neste filtro" compacto />
      ) : (
        <>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Último</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lista.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <span className="grid">
                      <span className="font-medium">{i.nome}</span>
                      <span className="text-muted-foreground text-xs">{ROTULO_FREQUENCIA[i.frequencia]}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={`/processos/documentos/${i.documento.id}#titulo-indicadores`} className="hover:text-primary grid">
                      <span>{i.documento.titulo}</span>
                      <span className="text-muted-foreground text-xs">{i.documento.caminho}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Ultimo i={i} />
                  </TableCell>
                  <TableCell className="tabular-nums">{i.meta !== null ? formatarValor(i.meta, i.unidade) : "—"}</TableCell>
                  <TableCell>
                    <ChipSituacao tom={VISUAL_SITUACAO_INDICADOR[i.situacao].tom} tamanho="sm">
                      {VISUAL_SITUACAO_INDICADOR[i.situacao].rotulo}
                    </ChipSituacao>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{i.responsavel ?? "—"}</TableCell>
                  <TableCell>{i.podeLancar && <LancarResultado indicador={i} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ul className="grid gap-2 md:hidden">
            {lista.map((i) => (
              <li key={i.id} className="bg-card grid gap-2 rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/processos/documentos/${i.documento.id}#titulo-indicadores`} className="grid">
                    <span className="font-medium">{i.nome}</span>
                    <span className="text-muted-foreground text-xs">{i.documento.titulo}</span>
                  </Link>
                  <ChipSituacao tom={VISUAL_SITUACAO_INDICADOR[i.situacao].tom} tamanho="sm">
                    {VISUAL_SITUACAO_INDICADOR[i.situacao].rotulo}
                  </ChipSituacao>
                </div>
                <div className="flex items-end justify-between gap-2 text-sm">
                  <Ultimo i={i} />
                  <span className="text-muted-foreground">meta {i.meta !== null ? formatarValor(i.meta, i.unidade) : "—"}</span>
                </div>
                {i.podeLancar && <LancarResultado indicador={i} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
