import { FolderOpenIcon, GraduationCapIcon, LayersIcon, UploadIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SeloSituacao } from "@/modulos/academico/componentes/exibicao";
import { visualSituacao } from "@/modulos/academico/componentes/situacao-visual";
import { CartaoTurma, LinhaTurma, SeletorSituacaoTurma } from "@/modulos/academico/componentes/turma-na-lista";
import { SITUACOES_MATRICULA, type SituacaoTurma } from "@/modulos/academico/esquemas/academico";
import { obterVisaoGeral } from "@/modulos/academico/servicos/visao";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "@/modulos/comercial/esquemas/produto";

export const metadata: Metadata = { title: "Acadêmico — IPEMaster OS" };

const ROTULO_PLURAL = { ativa: "Ativas", trancada: "Trancadas", concluida: "Concluídas", cancelada: "Canceladas" } as const;

/** Barra "ativos de N alunos", só com tokens. */
function BarraAtivos({ ativos, total }: { ativos: number; total: number }) {
  const pct = total > 0 ? Math.round((ativos / total) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="text-foreground text-2xl font-semibold tabular-nums">{ativos}</span>{" "}
          <span className="text-muted-foreground">ativos de {total} alunos</span>
        </span>
        <span className="text-muted-foreground tabular-nums">{pct}%</span>
      </div>
      <div
        className="bg-muted h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Alunos ativos no produto"
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const visao = await obterVisaoGeral(usuario);
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");
  const podeImportar = temPermissao(usuario.papel, "academico:importar_alunos");
  const botaoImportar = podeImportar && (
    <Button variant="outline" asChild>
      <Link href="/academico/alunos/importar">
        <UploadIcon /> Importar planilha
      </Link>
    </Button>
  );

  if (visao.produtos.length === 0) {
    return (
      <EstadoVazio
        icone={GraduationCapIcon}
        titulo="Ainda não há turmas"
        descricao="Crie uma turma em Turmas ou importe a planilha de alunos para ver os números por produto."
        acao={
          botaoImportar || (
            <Button asChild>
              <Link href="/academico/turmas">Ir para Turmas</Link>
            </Button>
          )
        }
      />
    );
  }

  const situacao = (t: { id: string; nome: string; situacao: SituacaoTurma }) =>
    podeEditar ? <SeletorSituacaoTurma id={t.id} situacao={t.situacao} rotulo={t.nome} /> : <SeloSituacao situacao={t.situacao} de="turma" />;

  return (
    <div className="grid gap-6">
      {botaoImportar && <div className="flex justify-end">{botaoImportar}</div>}

      <section aria-label="Totais" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoNumero rotulo="Alunos ativos" icone={GraduationCapIcon} valor={visao.ativos} tom="informacao" />
        <Link href="/academico/alunos" className="focus-visible:ring-ring rounded-xl transition-opacity hover:opacity-80 focus-visible:ring-2">
          <CartaoNumero rotulo="Alunos na base" icone={UsersIcon} valor={visao.totalAlunos}>
            Ver todos →
          </CartaoNumero>
        </Link>
        <CartaoNumero rotulo="Produtos com turmas" icone={FolderOpenIcon} valor={visao.produtos.length} />
        <CartaoNumero rotulo="Turmas em andamento" icone={LayersIcon} valor={visao.turmasEmAndamento} />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {visao.produtos.map((p) => (
          <Card key={p.id}>
            <CardHeader className="grid gap-4">
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">{ROTULO_TIPO_PRODUTO[p.tipo as TipoProduto]}</span>
                <CardTitle className="leading-snug">{p.nome}</CardTitle>
              </div>
              <BarraAtivos ativos={p.ativos} total={p.alunos} />
              <div className="flex flex-wrap gap-1.5" aria-label="Matrículas por situação">
                {SITUACOES_MATRICULA.filter((s) => p.situacoes[s] > 0).map((s) => {
                  const v = visualSituacao(s, "matricula");
                  return (
                    <ChipSituacao key={s} tom={v.tom} icone={v.icone} tamanho="sm">
                      {ROTULO_PLURAL[s]} {p.situacoes[s]}
                    </ChipSituacao>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.turmas.map((t) => (
                    <LinhaTurma key={t.id} href={`/academico/turmas/${t.id}`}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell>{situacao(t)}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.ativos}</TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">{t.total}</TableCell>
                    </LinhaTurma>
                  ))}
                </TableBody>
              </Table>
              <ul className="grid gap-2 md:hidden">
                {p.turmas.map((t) => (
                  <CartaoTurma key={t.id} href={`/academico/turmas/${t.id}`} nome={t.nome} situacao={situacao(t)}>
                    {t.ativos} ativos · {t.total} no total
                  </CartaoTurma>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
