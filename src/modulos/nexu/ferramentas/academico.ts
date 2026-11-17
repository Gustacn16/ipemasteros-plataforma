import { z } from "zod";
import { listarTurmas, obterTurma } from "@/modulos/academico/servicos/turmas";
import { buscarAlunosParaNexu, formaturasDasTurmas } from "../servicos/consultas-academico";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";
import { validarDia } from "./validacao";

type Dia = Date | string | null;
const comoDia = (d: Dia) => (d instanceof Date ? d.toISOString().slice(0, 10) : d);

type AlunoBruto = {
  id: string;
  nome: string;
  matriculas: { situacao: string; dataInicio: Dia; dataFormatura: Dia; turma: { nome: string } }[];
};

/** Único formato em que um aluno sai do Nexu: nome e matrículas. Nada de contato, CRM ou observações (LGPD). */
export function alunoMinimo(a: AlunoBruto) {
  return {
    id: a.id,
    nome: a.nome,
    matriculas: a.matriculas.map((m) => ({
      turma: m.turma.nome,
      situacao: m.situacao,
      dataInicio: comoDia(m.dataInicio),
      dataFormatura: comoDia(m.dataFormatura),
    })),
  };
}

const entradaTurmas = z.object({
  formamDe: z.string().optional().describe("só turmas que se formam a partir deste dia, no formato AAAA-MM-DD"),
  formamAte: z.string().optional().describe("só turmas que se formam até este dia, no formato AAAA-MM-DD"),
  turmaId: z.string().optional().describe("id da turma: devolve também a lista de alunos dela"),
});

export const ferramentaTurmasEFormaturas: FerramentaNexu<typeof entradaTurmas> = {
  nome: "turmas_e_formaturas",
  descricao:
    "Lista as turmas com produto, início, fim, data de formatura (a última entre as matrículas ativas), situação e alunos ativos. Com formamDe/formamAte, só as que se formam no intervalo. Com turmaId, devolve os alunos da turma (só nome e matrícula).",
  entrada: entradaTurmas,
  permissao: "academico:ver",
  rotulo: "Consultando turmas…",
  tipo: "consulta",
  async executar(ator, { formamDe, formamAte, turmaId }) {
    if (formamDe) validarDia(formamDe);
    if (formamAte) validarDia(formamAte);
    const [turmas, formaturas] = await Promise.all([listarTurmas(ator), formaturasDasTurmas(ator)]);
    const filtrando = Boolean(formamDe || formamAte);
    const lista = turmas
      .map((t) => ({
        id: t.id,
        nome: t.nome,
        produto: t.produto.nome,
        situacao: t.situacao,
        ciclica: t.ciclica,
        dataInicio: t.dataInicio,
        dataFim: t.dataFim,
        dataFormatura: formaturas.get(t.id) ?? null,
        ativos: t.ativos,
      }))
      .filter((t) => {
        if (turmaId && t.id !== turmaId) return false;
        if (!filtrando) return true;
        if (!t.dataFormatura) return false;
        return (!formamDe || t.dataFormatura >= formamDe) && (!formamAte || t.dataFormatura <= formamAte);
      });
    const resultado = limitarLista(lista);
    if (!turmaId) return resultado;
    const detalhe = await obterTurma(ator, turmaId);
    const alunos = limitarLista(
      detalhe.matriculas.map((m) =>
        alunoMinimo({
          id: m.aluno.id,
          nome: m.aluno.nome,
          matriculas: [{ situacao: m.situacao, dataInicio: m.dataInicio, dataFormatura: m.dataFormatura, turma: { nome: detalhe.nome } }],
        }),
      ),
    );
    return { ...resultado, alunos };
  },
};

const entradaAluno = z.object({ nome: z.string().min(2).describe("parte do nome do aluno") });

export const ferramentaBuscarAluno: FerramentaNexu<typeof entradaAluno> = {
  nome: "buscar_aluno",
  descricao:
    "Busca alunos pelo nome (sem diferenciar acento ou maiúsculas). Devolve só nome, turmas, situação da matrícula, início e formatura. Até 20 alunos.",
  entrada: entradaAluno,
  permissao: "academico:ver",
  rotulo: "Consultando alunos…",
  tipo: "consulta",
  async executar(ator, { nome }) {
    return limitarLista((await buscarAlunosParaNexu(ator, nome)).map(alunoMinimo), 20);
  },
};
