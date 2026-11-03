import type { SituacaoMatricula } from "../esquemas/academico";
import { nomeBusca, normalizarCrm, normalizarSituacao, normalizarTurma, soDigitos } from "../regras/normalizar";

// Leitura das abas da planilha de controle (spec Acadêmico 1, §6). Funções
// puras: recebem os valores das células e nunca citam o nome do aluno em erros.

export type Aba = { nome: string; linhas: unknown[][] };

export type LinhaImportada = {
  aba: string;
  /** Número da linha no Excel (o cabeçalho é a linha 1). */
  numero: number;
  curso: string;
  nome: string;
  nomeBusca: string;
  turma: { nome: string; ciclica: boolean } | null;
  situacao: { situacao: SituacaoMatricula; nota: string | null } | null;
  crm: string | null;
  telefone: string | null;
  /** "aaaa-mm-dd" */
  dataInicio: string | null;
  dataFormatura: string | null;
  vigencia: string | null;
  plano: string | null;
  observacoes: string | null;
  /** Problemas da linha; só bloqueiam se o curso não for ignorado. */
  erros: string[];
};

export type ErroLinha = { aba: string; numero: number; mensagem: string };

const COLUNAS = {
  nome: ["nome"],
  curso: ["curso"],
  turma: ["turma"],
  situacao: ["formacao", "status", "situacao"],
  crm: ["crm"],
  telefone: ["telefone"],
  dataInicio: ["data de inicio"],
  dataFormatura: ["data de formatura"],
  vigencia: ["vigencia"],
  plano: ["plano da pos-graduacao", "plano da pos graduacao"],
  observacoes: ["obs", "observacoes"],
} as const;
type Coluna = keyof typeof COLUNAS;

function mapearCabecalho(cabecalho: unknown[]): Partial<Record<Coluna, number>> {
  const indice: Partial<Record<Coluna, number>> = {};
  cabecalho.forEach((celula, i) => {
    const chave = nomeBusca(celula === null || celula === undefined ? "" : String(celula));
    for (const [coluna, nomes] of Object.entries(COLUNAS) as [Coluna, readonly string[]][]) {
      if (indice[coluna] === undefined && nomes.includes(chave)) indice[coluna] = i;
    }
  });
  return indice;
}

const texto = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t ? t.slice(0, max) : null;
};

const ISO = (ano: number, mes: number, dia: number) => {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia ? d.toISOString().slice(0, 10) : null;
};

/** Date, número de série do Excel ou "dd/mm/aaaa" → "aaaa-mm-dd". `undefined` = valor inválido. */
export function lerDia(v: unknown): string | null | undefined {
  if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Série do Excel: dias desde 30/12/1899.
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
  if (m) return ISO(Number(m[3]), Number(m[2]), Number(m[1])) ?? undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
  if (iso) return ISO(Number(iso[1]), Number(iso[2]), Number(iso[3])) ?? undefined;
  return undefined;
}

export function lerAbas(abas: readonly Aba[]) {
  const linhas: LinhaImportada[] = [];
  const abasLidas: string[] = [];
  const abasIgnoradas: string[] = [];

  for (const aba of abas) {
    const [cabecalho = [], ...corpo] = aba.linhas;
    const col = mapearCabecalho(cabecalho);
    if (col.nome === undefined || col.curso === undefined || col.turma === undefined) {
      abasIgnoradas.push(aba.nome);
      continue;
    }
    abasLidas.push(aba.nome);
    const celula = (linha: unknown[], c: Coluna) => (col[c] === undefined ? null : linha[col[c]!]);

    corpo.forEach((linha, i) => {
      const nome = texto(celula(linha, "nome"), 150);
      const curso = texto(celula(linha, "curso"), 150);
      // Linhas vazias no fim da aba (ou só com fórmulas) não são alunos.
      if (!nome && !curso) return;

      const erros: string[] = [];
      if (!nome) erros.push("Linha sem nome.");
      if (!curso) erros.push("Linha sem curso.");
      const valorSituacao = celula(linha, "situacao");
      const situacao = normalizarSituacao(valorSituacao);
      if (!situacao) erros.push(valorSituacao ? `Situação desconhecida: “${texto(valorSituacao, 40)}”.` : "Situação vazia.");
      const turma = normalizarTurma(celula(linha, "turma"));
      if (!turma) erros.push("Turma vazia.");
      const dataInicio = lerDia(celula(linha, "dataInicio"));
      if (dataInicio === undefined) erros.push("Data de início inválida.");
      const dataFormatura = lerDia(celula(linha, "dataFormatura"));
      if (dataFormatura === undefined) erros.push("Data de formatura inválida.");

      linhas.push({
        aba: aba.nome,
        numero: i + 2,
        curso: curso ?? "",
        nome: nome ?? "",
        nomeBusca: nomeBusca(nome ?? ""),
        turma,
        situacao,
        crm: normalizarCrm(celula(linha, "crm")),
        telefone: soDigitos(celula(linha, "telefone"))?.slice(0, 20) ?? null,
        dataInicio: dataInicio ?? null,
        dataFormatura: dataFormatura ?? null,
        vigencia: texto(celula(linha, "vigencia"), 40),
        plano: texto(celula(linha, "plano"), 255),
        observacoes: texto(celula(linha, "observacoes"), 5000),
        erros,
      });
    });
  }
  return { linhas, abasLidas, abasIgnoradas };
}
