import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { editarTurmaAcao, excluirTurmaAcao, matricularAlunoAcao } from "@/modulos/academico/acoes/academico";
import { BotaoAcao, CampoSelecao, FormularioAcao, Oculto } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { SeloSituacao, ou404 } from "@/modulos/academico/componentes/exibicao";
import { CamposMatricula, CamposTurma } from "@/modulos/academico/componentes/formularios";
import { TabelaMatriculas } from "@/modulos/academico/componentes/matriculas";
import { listarOpcoesAluno } from "@/modulos/academico/servicos/alunos";
import { obterTurma } from "@/modulos/academico/servicos/turmas";
import { listarProdutosAtivos } from "@/modulos/comercial/servicos/produtos";

export const metadata: Metadata = { title: "Turma — IPEMaster OS" };

export default async function PaginaTurma({ params }: PageProps<"/academico/turmas/[id]">) {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const { id } = await params;
  const turma = await ou404(obterTurma(usuario, id));
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");
  const [produtos, alunos] = podeEditar ? await Promise.all([listarProdutosAtivos(), listarOpcoesAluno()]) : [[], []];
  // O produto atual continua escolhível mesmo se tiver sido desativado.
  const opcoesProduto = [
    ...(produtos.some((p) => p.id === turma.produto.id) ? [] : [{ valor: turma.produto.id, rotulo: turma.produto.nome }]),
    ...produtos.map((p) => ({ valor: p.id, rotulo: p.nome })),
  ];
  const ativos = turma.matriculas.filter((m) => m.situacao === "ativa").length;
  const naTurma = new Set(turma.matriculas.map((m) => m.aluno.id));

  return (
    <div className="grid gap-6">
      <Link href="/academico/turmas" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Turmas
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-muted-foreground text-sm">{turma.produto.nome}</span>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {turma.nome} <SeloSituacao situacao={turma.situacao} de="turma" />
          </h2>
          <p className="text-muted-foreground text-sm">
            {ativos} ativos · {turma.matriculas.length} matrículas
          </p>
        </div>
        {podeEditar && turma.matriculas.length === 0 && (
          <BotaoAcao
            acao={excluirTurmaAcao.bind(null, turma.id)}
            rotulo="Excluir turma"
            confirmar="Excluir esta turma?"
            irPara="/academico/turmas"
            variante="destructive"
          />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Alunos</CardTitle>
          {podeEditar && (
            <Dialogo rotuloBotao="Adicionar aluno" titulo="Adicionar aluno à turma" descricao="Para um aluno novo, cadastre-o antes em Alunos.">
              <FormularioAcao acao={matricularAlunoAcao} rotuloBotao="Matricular">
                <Oculto name="turmaId" value={turma.id} />
                <CampoSelecao
                  rotulo="Aluno"
                  name="alunoId"
                  opcoes={alunos.filter((a) => !naTurma.has(a.id)).map((a) => ({ valor: a.id, rotulo: a.nome }))}
                  vazio="Escolha o aluno"
                  largo
                />
                <CamposMatricula />
              </FormularioAcao>
            </Dialogo>
          )}
        </CardHeader>
        <CardContent>
          <TabelaMatriculas
            rotuloTitulo="Aluno"
            podeEditar={podeEditar}
            matriculas={turma.matriculas.map((m) => ({ ...m, turmaId: turma.id, titulo: m.aluno.nome, href: `/academico/alunos/${m.aluno.id}` }))}
          />
        </CardContent>
      </Card>

      {podeEditar && (
        <Card>
          <CardHeader>
            <CardTitle>Dados da turma</CardTitle>
          </CardHeader>
          <CardContent>
            <FormularioAcao acao={editarTurmaAcao} rotuloBotao="Salvar">
              <Oculto name="id" value={turma.id} />
              <CamposTurma produtos={opcoesProduto} turma={turma} />
            </FormularioAcao>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
