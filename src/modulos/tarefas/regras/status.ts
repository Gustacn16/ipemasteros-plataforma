// Regras dos status de uma lista (docs/modulos/tarefas.md, regras 1, 2 e 4).

export const TIPOS_STATUS = ["aberto", "em_andamento", "concluido"] as const;
export type TipoStatus = (typeof TIPOS_STATUS)[number];

export const ROTULO_TIPO_STATUS: Record<TipoStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

/** Status que toda lista nova recebe. */
export const STATUS_PADRAO: readonly { nome: string; cor: string; tipo: TipoStatus }[] = [
  { nome: "A fazer", cor: "#a3a3a3", tipo: "aberto" },
  { nome: "Em andamento", cor: "#3b82f6", tipo: "em_andamento" },
  { nome: "Concluído", cor: "#22c55e", tipo: "concluido" },
];

/** Toda lista precisa de ao menos um status aberto e um concluído. Retorna a mensagem de erro ou null. */
export function validarConjuntoStatus(tipos: readonly TipoStatus[]): string | null {
  if (!tipos.includes("aberto")) return "A lista precisa ter pelo menos um status do tipo aberto.";
  if (!tipos.includes("concluido")) return "A lista precisa ter pelo menos um status do tipo concluído.";
  return null;
}

/** Entrar em concluído registra a data (mantendo a original); sair limpa. */
export function concluidaEmAoMudarStatus(
  tipoNovo: TipoStatus,
  concluidaEmAtual: Date | null,
  agora: Date,
): Date | null {
  if (tipoNovo !== "concluido") return null;
  return concluidaEmAtual ?? agora;
}

/** Mensagem do servidor que a tela usa para pedir confirmação (regra 6). */
export const ERRO_SUBTAREFAS_ABERTAS = "Esta tarefa tem subtarefas abertas. Concluir mesmo assim?";
