import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { lerAbas, type ErroLinha } from "../importacao/ler";
import { IGNORAR, planejarImportacao, sugerirProduto, type Mapeamento, type Ref } from "../importacao/planejar";
import { lerArquivoXlsx } from "../importacao/xlsx";
import type { SituacaoMatricula } from "../esquemas/academico";
import { exigirPermissaoAcademico, paraDia } from "./acesso";

// Importação da planilha de alunos (spec Acadêmico 1, §6). Nada de dado
// pessoal sai daqui para a tela além de contagens e números de linha.

async function lerPlanilha(conteudo: ArrayBuffer) {
  const lido = lerAbas(await lerArquivoXlsx(conteudo));
  if (lido.abasLidas.length === 0) throw new ErroNegocio("Nenhuma aba tem as colunas Nome, Curso e Turma.");
  return lido;
}

const produtosEscolhiveis = () =>
  prisma.produto.findMany({
    where: { excluidoEm: null, ativo: true },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, sku: true },
  });

/** Passo 2: prévia sem gravar nada. */
export async function analisarPlanilha(ator: UsuarioAtual, conteudo: ArrayBuffer) {
  exigirPermissaoAcademico(ator, "academico:importar_alunos");
  const [{ linhas, abasLidas, abasIgnoradas }, produtos] = await Promise.all([lerPlanilha(conteudo), produtosEscolhiveis()]);

  const abas = abasLidas.map((nome) => {
    const daAba = linhas.filter((l) => l.aba === nome);
    const situacoes: Partial<Record<SituacaoMatricula, number>> = {};
    for (const l of daAba) if (l.situacao) situacoes[l.situacao.situacao] = (situacoes[l.situacao.situacao] ?? 0) + 1;
    return { nome, linhas: daAba.length, situacoes, turmas: [...new Set(daAba.flatMap((l) => (l.turma ? [l.turma.nome] : [])))] };
  });
  const cursos = [...new Set(linhas.map((l) => l.curso))].map((curso) => {
    const daqui = linhas.filter((l) => l.curso === curso);
    return {
      curso,
      linhas: daqui.length,
      ativos: daqui.filter((l) => l.situacao?.situacao === "ativa").length,
      sugestao: sugerirProduto(curso, produtos),
      erros: daqui.flatMap((l): ErroLinha[] => l.erros.map((mensagem) => ({ aba: l.aba, numero: l.numero, mensagem }))),
    };
  });
  return { abas, abasIgnoradas, cursos, produtos: produtos.map(({ id, nome }) => ({ id, nome })) };
}
export type Previa = Awaited<ReturnType<typeof analisarPlanilha>>;

export type ResultadoImportacao = {
  turmasCriadas: number;
  alunosCriados: number;
  alunosExistentes: number;
  matriculasCriadas: number;
  matriculasAtualizadas: number;
  ignoradas: number;
  avisos: ErroLinha[];
};

/** Passo 3: grava tudo numa transação, ou nada. */
export async function importarPlanilha(ator: UsuarioAtual, conteudo: ArrayBuffer, mapeamento: Mapeamento): Promise<ResultadoImportacao> {
  exigirPermissaoAcademico(ator, "academico:importar_alunos");
  const [{ linhas }, produtos] = await Promise.all([lerPlanilha(conteudo), produtosEscolhiveis()]);
  const validos = new Set(produtos.map((p) => p.id));
  for (const [curso, id] of Object.entries(mapeamento)) {
    if (id !== IGNORAR && !validos.has(id)) throw new ErroNegocio(`Produto inválido para o curso “${curso}”.`);
  }

  return prisma.$transaction(
    async (tx) => {
      const [turmas, alunos, matriculas] = await Promise.all([
        tx.turma.findMany({ where: { excluidoEm: null }, select: { id: true, produtoId: true, nome: true } }),
        tx.aluno.findMany({ select: { id: true, nomeBusca: true, telefone: true, crm: true } }),
        tx.matricula.findMany({ select: { id: true, alunoId: true, turmaId: true } }),
      ]);
      const plano = planejarImportacao(linhas, mapeamento, { turmas, alunos, matriculas });
      if (plano.erros.length > 0) {
        const primeiro = plano.erros[0];
        throw new ErroNegocio(
          `Nada foi importado: ${plano.erros.length} problema(s). Primeiro: aba “${primeiro.aba}”, linha ${primeiro.numero}: ${primeiro.mensagem}`,
        );
      }

      const idTurma = new Map<string, string>();
      for (const t of plano.turmasNovas) {
        const criada = await tx.turma.create({
          data: { produtoId: t.produtoId, nome: t.nome, ciclica: t.ciclica, situacao: t.situacao, dataInicio: paraDia(t.dataInicio) },
          select: { id: true },
        });
        idTurma.set(t.chave, criada.id);
      }
      const idAluno = new Map<string, string>();
      for (const a of plano.alunosNovos) {
        const criado = await tx.aluno.create({
          data: { nome: a.nome, nomeBusca: a.nomeBusca, telefone: a.telefone, crm: a.crm },
          select: { id: true },
        });
        idAluno.set(a.chave, criado.id);
      }
      for (const { id, ...dados } of plano.alunosCompletar) await tx.aluno.update({ where: { id }, data: dados });

      const resolver = (r: Ref, mapa: Map<string, string>) => ("id" in r ? r.id : mapa.get(r.chave)!);
      let criadas = 0;
      for (const m of plano.matriculas) {
        const dados = { ...m.dados, dataInicio: paraDia(m.dados.dataInicio), dataFormatura: paraDia(m.dados.dataFormatura) };
        if (m.id) await tx.matricula.update({ where: { id: m.id }, data: dados });
        else {
          await tx.matricula.create({ data: { ...dados, alunoId: resolver(m.aluno, idAluno), turmaId: resolver(m.turma, idTurma) } });
          criadas++;
        }
      }

      const resultado: ResultadoImportacao = {
        turmasCriadas: plano.turmasNovas.length,
        alunosCriados: plano.alunosNovos.length,
        alunosExistentes: plano.alunosExistentes,
        matriculasCriadas: criadas,
        matriculasAtualizadas: plano.matriculas.length - criadas,
        ignoradas: plano.ignoradas,
        avisos: plano.avisos,
      };
      const { avisos, ...contagens } = resultado;
      await registrarAuditoria(
        { usuarioId: ator.id, acao: "alunos.importados", entidade: "Aluno", diff: { ...contagens, avisos: avisos.length } },
        tx,
      );
      return resultado;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
