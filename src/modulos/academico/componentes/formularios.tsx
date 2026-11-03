import type { AlunoDetalhe } from "../servicos/alunos";
import type { ProfessorDetalhe } from "../servicos/professores";
import type { TurmaDetalhe } from "../servicos/turmas";
import { CampoAreaTexto, CampoCaixa, CampoSelecao, CampoTexto } from "./campos";
import { OPCOES_SITUACAO_MATRICULA, OPCOES_SITUACAO_TURMA, OPCOES_UF } from "./exibicao";

// Conjuntos de campos de cada cadastro, usados dentro de um FormularioAcao.

type Opcao = { valor: string; rotulo: string };

export function CamposTurma({ produtos, turma }: { produtos: Opcao[]; turma?: TurmaDetalhe }) {
  return (
    <>
      <CampoSelecao rotulo="Produto" name="produtoId" opcoes={produtos} defaultValue={turma?.produtoId} vazio="Escolha o produto" largo />
      <CampoTexto rotulo="Nome da turma" name="nome" defaultValue={turma?.nome} placeholder="Ex.: 6ª turma" required />
      <CampoSelecao rotulo="Situação" name="situacao" opcoes={OPCOES_SITUACAO_TURMA} defaultValue={turma?.situacao ?? "planejada"} />
      <CampoCaixa
        rotulo="Turma cíclica"
        name="ciclica"
        defaultChecked={turma?.ciclica}
        ajuda="Entrada contínua: o aluno começa a qualquer momento, sem data fixa de turma."
      />
      <CampoTexto rotulo="Início" name="dataInicio" type="date" defaultValue={turma?.dataInicio} />
      <CampoTexto rotulo="Fim" name="dataFim" type="date" defaultValue={turma?.dataFim} />
      <CampoAreaTexto rotulo="Observações" name="observacoes" defaultValue={turma?.observacoes} />
    </>
  );
}

export function CamposAluno({ aluno }: { aluno?: AlunoDetalhe }) {
  return (
    <>
      <CampoTexto rotulo="Nome" name="nome" defaultValue={aluno?.nome} required largo />
      <CampoTexto rotulo="E-mail" name="email" type="email" defaultValue={aluno?.email} />
      <CampoTexto rotulo="Telefone" name="telefone" defaultValue={aluno?.telefone} placeholder="(62) 99999-0000" />
      <CampoTexto rotulo="CRM" name="crm" defaultValue={aluno?.crm} />
      <CampoSelecao rotulo="UF do CRM" name="crmUf" opcoes={OPCOES_UF} defaultValue={aluno?.crmUf} vazio="—" />
      <CampoAreaTexto rotulo="Observações" name="observacoes" defaultValue={aluno?.observacoes} />
    </>
  );
}

export function CamposProfessor({ professor }: { professor?: ProfessorDetalhe }) {
  return (
    <>
      <CampoTexto rotulo="Nome" name="nome" defaultValue={professor?.nome} required largo />
      <CampoTexto rotulo="E-mail" name="email" type="email" defaultValue={professor?.email} />
      <CampoTexto rotulo="Telefone" name="telefone" defaultValue={professor?.telefone} />
      <CampoTexto rotulo="CRM" name="crm" defaultValue={professor?.crm} />
      <CampoSelecao rotulo="UF do CRM" name="crmUf" opcoes={OPCOES_UF} defaultValue={professor?.crmUf} vazio="—" />
      <CampoTexto rotulo="Especialidade" name="especialidade" defaultValue={professor?.especialidade} largo />
      <CampoAreaTexto rotulo="Minicurrículo" name="miniCurriculo" defaultValue={professor?.miniCurriculo} />
    </>
  );
}

type MatriculaInicial = {
  situacao: string;
  dataInicio: string | null;
  dataFormatura: string | null;
  vigencia?: string | null;
  plano?: string | null;
  observacoes?: string | null;
};

export function CamposMatricula({ matricula }: { matricula?: MatriculaInicial }) {
  return (
    <>
      <CampoSelecao rotulo="Situação" name="situacao" opcoes={OPCOES_SITUACAO_MATRICULA} defaultValue={matricula?.situacao ?? "ativa"} />
      <CampoTexto rotulo="Vigência" name="vigencia" defaultValue={matricula?.vigencia} placeholder="Ex.: 1 ano" />
      <CampoTexto rotulo="Início" name="dataInicio" type="date" defaultValue={matricula?.dataInicio} />
      <CampoTexto rotulo="Formatura" name="dataFormatura" type="date" defaultValue={matricula?.dataFormatura} />
      <CampoTexto rotulo="Plano contratado" name="plano" defaultValue={matricula?.plano} largo />
      <CampoAreaTexto rotulo="Observações" name="observacoes" defaultValue={matricula?.observacoes} />
    </>
  );
}
