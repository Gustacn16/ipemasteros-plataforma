import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { editarAlunoAcao, matricularAlunoAcao } from "@/modulos/academico/acoes/academico";
import { CampoSelecao, FormularioAcao, Oculto } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { ou404 } from "@/modulos/academico/componentes/exibicao";
import { CamposAluno, CamposMatricula } from "@/modulos/academico/componentes/formularios";
import { TabelaMatriculas } from "@/modulos/academico/componentes/matriculas";
import { obterAluno } from "@/modulos/academico/servicos/alunos";
import { listarOpcoesTurma } from "@/modulos/academico/servicos/turmas";

export const metadata: Metadata = { title: "Aluno — IPEMaster OS" };

function Item({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm whitespace-pre-line">{valor || "—"}</dd>
    </div>
  );
}

export default async function PaginaAluno({ params }: PageProps<"/academico/alunos/[id]">) {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const { id } = await params;
  const aluno = await ou404(obterAluno(usuario, id));
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");
  const turmas = podeEditar ? await listarOpcoesTurma() : [];
  const jaMatriculado = new Set(aluno.matriculas.map((m) => m.turma.id));

  return (
    <div className="grid gap-6">
      <Link href="/academico/alunos" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Alunos
      </Link>
      <h2 className="text-xl font-semibold">{aluno.nome}</h2>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Matrículas</CardTitle>
          {podeEditar && (
            <Dialogo rotuloBotao="Matricular em turma" titulo="Matricular em turma" descricao={aluno.nome}>
              <FormularioAcao acao={matricularAlunoAcao} rotuloBotao="Matricular">
                <Oculto name="alunoId" value={aluno.id} />
                <CampoSelecao
                  rotulo="Turma"
                  name="turmaId"
                  opcoes={turmas.filter((t) => !jaMatriculado.has(t.id)).map((t) => ({ valor: t.id, rotulo: t.rotulo }))}
                  vazio="Escolha a turma"
                  largo
                />
                <CamposMatricula />
              </FormularioAcao>
            </Dialogo>
          )}
        </CardHeader>
        <CardContent>
          <TabelaMatriculas
            rotuloTitulo="Turma"
            podeEditar={podeEditar}
            matriculas={aluno.matriculas.map((m) => ({
              ...m,
              titulo: m.turma.nome,
              subtitulo: m.turma.produto.nome,
              href: `/academico/turmas/${m.turma.id}`,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do aluno</CardTitle>
        </CardHeader>
        <CardContent>
          {podeEditar ? (
            <FormularioAcao acao={editarAlunoAcao} rotuloBotao="Salvar">
              <Oculto name="id" value={aluno.id} />
              <CamposAluno aluno={aluno} />
            </FormularioAcao>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item rotulo="E-mail" valor={aluno.email} />
              <Item rotulo="Telefone" valor={aluno.telefone} />
              <Item rotulo="CRM" valor={[aluno.crm, aluno.crmUf].filter(Boolean).join(" / ")} />
              <Item rotulo="Observações" valor={aluno.observacoes} />
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
