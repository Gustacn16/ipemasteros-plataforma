import type { SituacaoMatricula, SituacaoTurma } from "../esquemas/academico";
import { nomeBusca } from "../regras/normalizar";
import type { ErroLinha, LinhaImportada } from "./ler";

// Decide o que a importação cria ou atualiza (spec Acadêmico 1, §6, passo 3).
// Puro: o serviço só grava o plano devolvido aqui.

export const IGNORAR = "ignorar";
/** Valor do curso na planilha → id do produto, ou "ignorar". */
export type Mapeamento = Record<string, string>;

export type Existentes = {
  turmas: { id: string; produtoId: string; nome: string }[];
  alunos: { id: string; nomeBusca: string; telefone: string | null; crm: string | null }[];
  matriculas: { id: string; alunoId: string; turmaId: string }[];
};

/** Registro que já existe (`id`) ou que será criado nesta importação (`chave`). */
export type Ref = { id: string } | { chave: string };

export type DadosMatriculaImportada = {
  situacao: SituacaoMatricula;
  dataInicio: string | null;
  dataFormatura: string | null;
  vigencia: string | null;
  plano: string | null;
  observacoes: string | null;
};

export type Plano = {
  erros: ErroLinha[];
  avisos: ErroLinha[];
  turmasNovas: { chave: string; produtoId: string; nome: string; ciclica: boolean; situacao: SituacaoTurma; dataInicio: string | null }[];
  alunosNovos: { chave: string; nome: string; nomeBusca: string; telefone: string | null; crm: string | null }[];
  /** Alunos existentes que ganham telefone ou CRM que estavam vazios. */
  alunosCompletar: { id: string; telefone?: string; crm?: string }[];
  alunosExistentes: number;
  matriculas: { id?: string; aluno: Ref; turma: Ref; dados: DadosMatriculaImportada }[];
  ignoradas: number;
};

type AlunoConhecido = { ref: Ref; nomeBusca: string; telefone: string | null; crm: string | null };

const chaveRef = (r: Ref) => ("id" in r ? `id:${r.id}` : `nova:${r.chave}`);

export function planejarImportacao(linhas: readonly LinhaImportada[], mapeamento: Mapeamento, existentes: Existentes): Plano {
  const plano: Plano = {
    erros: [],
    avisos: [],
    turmasNovas: [],
    alunosNovos: [],
    alunosCompletar: [],
    alunosExistentes: 0,
    matriculas: [],
    ignoradas: 0,
  };

  const cursosSemProduto = new Set<string>();
  const validas: (LinhaImportada & { produtoId: string })[] = [];
  for (const l of linhas) {
    const produtoId = mapeamento[l.curso];
    if (produtoId === IGNORAR) {
      plano.ignoradas++;
      continue;
    }
    if (!produtoId) {
      if (!cursosSemProduto.has(l.curso)) {
        cursosSemProduto.add(l.curso);
        plano.erros.push({ aba: l.aba, numero: l.numero, mensagem: `Escolha o produto para o curso “${l.curso || "(vazio)"}”.` });
      }
      continue;
    }
    for (const mensagem of l.erros) plano.erros.push({ aba: l.aba, numero: l.numero, mensagem });
    if (l.erros.length === 0) validas.push({ ...l, produtoId });
  }
  if (plano.erros.length > 0) return plano;

  // Turmas: as que existem são reaproveitadas; as novas acumulam situação e data.
  const turmas = new Map<string, Ref>();
  for (const t of existentes.turmas) turmas.set(`${t.produtoId}|${nomeBusca(t.nome)}`, { id: t.id });
  const novas = new Map<string, Plano["turmasNovas"][number]>();

  // Alunos: o mesmo nome com telefones diferentes é outra pessoa.
  const alunos: AlunoConhecido[] = existentes.alunos.map((a) => ({ ref: { id: a.id }, nomeBusca: a.nomeBusca, telefone: a.telefone, crm: a.crm }));
  const completar = new Map<string, { id: string; telefone?: string; crm?: string }>();
  const existentesUsados = new Set<string>();

  const matriculasExistentes = new Map(existentes.matriculas.map((m) => [`id:${m.alunoId}|id:${m.turmaId}`, m.id]));
  const matriculas = new Map<string, { linha: LinhaImportada; item: Plano["matriculas"][number] }>();

  for (const l of validas) {
    const turma = l.turma!;
    const chaveTurma = `${l.produtoId}|${nomeBusca(turma.nome)}`;
    let refTurma = turmas.get(chaveTurma);
    if (!refTurma) {
      refTurma = { chave: chaveTurma };
      turmas.set(chaveTurma, refTurma);
      novas.set(chaveTurma, {
        chave: chaveTurma,
        produtoId: l.produtoId,
        nome: turma.nome,
        ciclica: turma.ciclica,
        situacao: "concluida",
        dataInicio: null,
      });
    }
    const nova = novas.get(chaveTurma);
    if (nova) {
      if (l.situacao!.situacao === "ativa" || l.situacao!.situacao === "trancada") nova.situacao = "em_andamento";
      if (!nova.ciclica && l.dataInicio && (!nova.dataInicio || l.dataInicio < nova.dataInicio)) nova.dataInicio = l.dataInicio;
    }

    let aluno = alunos.find((a) => a.nomeBusca === l.nomeBusca && !(a.telefone && l.telefone && a.telefone !== l.telefone));
    if (!aluno) {
      const chave = `aluno${plano.alunosNovos.length + 1}`;
      plano.alunosNovos.push({ chave, nome: l.nome, nomeBusca: l.nomeBusca, telefone: l.telefone, crm: l.crm });
      aluno = { ref: { chave }, nomeBusca: l.nomeBusca, telefone: l.telefone, crm: l.crm };
      alunos.push(aluno);
    } else {
      const novo = "chave" in aluno.ref ? plano.alunosNovos.find((a) => a.chave === (aluno!.ref as { chave: string }).chave)! : null;
      if ("id" in aluno.ref) existentesUsados.add(aluno.ref.id);
      // Só preenche o que estava vazio; nunca sobrescreve.
      for (const campo of ["telefone", "crm"] as const) {
        const valor = l[campo];
        if (!valor || aluno[campo]) continue;
        aluno[campo] = valor;
        if (novo) novo[campo] = valor;
        else {
          const id = (aluno.ref as { id: string }).id;
          completar.set(id, { ...(completar.get(id) ?? { id }), [campo]: valor });
        }
      }
    }

    const chave = `${chaveRef(aluno.ref)}|${chaveRef(refTurma)}`;
    const dados: DadosMatriculaImportada = {
      situacao: l.situacao!.situacao,
      dataInicio: l.dataInicio,
      dataFormatura: l.dataFormatura,
      vigencia: l.vigencia,
      plano: l.plano,
      observacoes: [l.situacao!.nota, l.observacoes].filter(Boolean).join("\n") || null,
    };
    const anterior = matriculas.get(chave);
    if (anterior) {
      plano.avisos.push({
        aba: l.aba,
        numero: l.numero,
        mensagem: `Repete a pessoa e a turma da linha ${anterior.linha.numero} (${anterior.linha.aba}); vale esta linha.`,
      });
      anterior.item.dados = dados;
      anterior.linha = l;
      continue;
    }
    matriculas.set(chave, { linha: l, item: { id: matriculasExistentes.get(chave), aluno: aluno.ref, turma: refTurma, dados } });
  }

  plano.turmasNovas = [...novas.values()];
  plano.alunosCompletar = [...completar.values()];
  plano.alunosExistentes = existentesUsados.size;
  plano.matriculas = [...matriculas.values()].map((m) => m.item);
  return plano;
}

const PALAVRAS_VAZIAS = new Set(["pos", "curso", "livre", "graduacao", "lato", "sensu", "em", "de", "e", "do", "da"]);
const SIGLAS: Record<string, string> = {
  tct: "transplante capilar tricologia",
  "tc&t": "transplante capilar tricologia",
  psq: "psiquiatria",
};

/** Sugere o produto de um valor da coluna "Curso" ("PÓS - PSQ EAD" → Psiquiatria EAD). */
export function sugerirProduto(curso: string, produtos: readonly { id: string; nome: string; sku: string | null }[]): string | null {
  const chave = nomeBusca(curso);
  const porSku = produtos.find((p) => p.sku && nomeBusca(p.sku) === chave);
  if (porSku) return porSku.id;
  const palavras = chave
    .split(/[^a-z&]+/)
    .flatMap((p) => (SIGLAS[p] ?? p).split(" "))
    .filter((p) => p.length >= 2 && !PALAVRAS_VAZIAS.has(p));
  if (palavras.length === 0) return null;
  const candidatos = produtos.filter((p) => {
    const nome = nomeBusca(p.nome).split(/[^a-z]+/);
    return palavras.every((w) => nome.includes(w));
  });
  return candidatos.length === 1 ? candidatos[0].id : null;
}
