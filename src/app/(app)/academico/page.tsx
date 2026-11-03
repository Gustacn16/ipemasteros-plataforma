import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { ROTULO_SITUACAO_MATRICULA, SITUACOES_MATRICULA } from "@/modulos/academico/esquemas/academico";
import { SeloSituacao } from "@/modulos/academico/componentes/exibicao";
import { LinhaTurma, SeletorSituacaoTurma } from "@/modulos/academico/componentes/turma-na-lista";
import { obterVisaoGeral } from "@/modulos/academico/servicos/visao";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "@/modulos/comercial/esquemas/produto";

export const metadata: Metadata = { title: "Acadêmico — IPEMaster OS" };

function Numero({ rotulo, valor, href }: { rotulo: string; valor: number; href?: string }) {
  const conteudo = (
    <>
      <p className="text-muted-foreground text-xs">{rotulo}</p>
      <p className="text-3xl font-semibold tabular-nums">{valor}</p>
    </>
  );
  return href ? (
    <Link href={href} className="hover:bg-muted/50 rounded-lg border px-4 py-3">
      {conteudo}
    </Link>
  ) : (
    <div className="rounded-lg border px-4 py-3">{conteudo}</div>
  );
}

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const visao = await obterVisaoGeral(usuario);
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");

  if (visao.produtos.length === 0) {
    return (
      <div className="grid gap-2 text-sm">
        <p>Ainda não há turmas cadastradas.</p>
        <p className="text-muted-foreground">
          Crie uma turma em <Link href="/academico/turmas" className="underline">Turmas</Link>
          {temPermissao(usuario.papel, "academico:importar_alunos") && (
            <>
              {" "}ou{" "}
              <Link href="/academico/alunos/importar" className="underline">
                importe a planilha de alunos
              </Link>
            </>
          )}
          .
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section aria-label="Totais" className="flex flex-wrap gap-3">
        <Numero rotulo="Alunos ativos" valor={visao.ativos} />
        <Numero rotulo="Todos os alunos da base" valor={visao.totalAlunos} href="/academico/alunos" />
        <Numero rotulo="Produtos com turmas" valor={visao.produtos.length} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {visao.produtos.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">{ROTULO_TIPO_PRODUTO[p.tipo as TipoProduto]}</span>
                <CardTitle className="leading-snug">{p.nome}</CardTitle>
                <p className="text-muted-foreground text-xs">
                  {SITUACOES_MATRICULA.filter((s) => s !== "ativa" && p.situacoes[s] > 0)
                    .map((s) => `${ROTULO_SITUACAO_MATRICULA[s]}: ${p.situacoes[s]}`)
                    .join(" · ")}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tabular-nums">{p.ativos}</p>
                <p className="text-muted-foreground text-xs">ativos</p>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
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
                      <TableCell>
                        {podeEditar ? (
                          <SeletorSituacaoTurma id={t.id} situacao={t.situacao} rotulo={t.nome} />
                        ) : (
                          <SeloSituacao situacao={t.situacao} de="turma" />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.ativos}</TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">{t.total}</TableCell>
                    </LinhaTurma>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
