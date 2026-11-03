import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SeloSituacao } from "@/modulos/academico/componentes/exibicao";
import { obterVisaoGeral } from "@/modulos/academico/servicos/visao";
import { ROTULO_TIPO_PRODUTO, type TipoProduto } from "@/modulos/comercial/esquemas/produto";

export const metadata: Metadata = { title: "Acadêmico — IPEMaster OS" };

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const visao = await obterVisaoGeral(usuario);

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
      <section aria-label="Total" className="flex flex-wrap gap-3">
        <div className="rounded-lg border px-4 py-3">
          <p className="text-muted-foreground text-xs">Alunos ativos</p>
          <p className="text-3xl font-semibold tabular-nums">{visao.total}</p>
        </div>
        <div className="rounded-lg border px-4 py-3">
          <p className="text-muted-foreground text-xs">Produtos com turmas</p>
          <p className="text-3xl font-semibold tabular-nums">{visao.produtos.length}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {visao.produtos.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="grid gap-1">
                <span className="text-muted-foreground text-xs">{ROTULO_TIPO_PRODUTO[p.tipo as TipoProduto]}</span>
                <CardTitle className="leading-snug">{p.nome}</CardTitle>
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
                    <TableHead className="text-right">Matrículas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.turmas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link href={`/academico/turmas/${t.id}`} className="hover:underline">
                          {t.nome}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <SeloSituacao situacao={t.situacao} de="turma" />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.ativos}</TableCell>
                      <TableCell className="text-muted-foreground text-right tabular-nums">{t.total}</TableCell>
                    </TableRow>
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
