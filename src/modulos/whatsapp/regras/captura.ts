/** Só os últimos 30 dias de histórico entram. */
export const DIAS_HISTORICO = 30;
/** Mensagens de grupo não monitorado vindas do histórico ficam 48 h. */
export const HORAS_PROVISORIO = 48;
/** Mensagens são apagadas depois de 90 dias. */
export const DIAS_RETENCAO = 90;

/**
 * Chave para casar telefones brasileiros com ou sem 55 e com ou sem o 9: DDD + últimos 8 dígitos.
 * Fora do Brasil: os dígitos como vieram. null se tiver menos de 10 dígitos.
 */
export function chaveTelefone(digitos: string | null | undefined): string | null {
  if (!digitos || digitos.length < 10) return null;
  const n = digitos.length;
  const brasil = (digitos.startsWith("55") && (n === 12 || n === 13)) || n === 10 || n === 11;
  if (!brasil) return digitos;
  const local = n === 12 || n === 13 ? digitos.slice(2) : digitos;
  return local.slice(0, 2) + local.slice(-8);
}

export function categoriaInicial(c: { alunoId: string | null; usuarioId: string | null }): "aluno" | "equipe" | "lead" {
  if (c.alunoId) return "aluno";
  if (c.usuarioId) return "equipe";
  return "lead";
}

export type DecisaoGuardar = "guardar" | "provisoria" | "descartar";

/** Grupo monitorado → guardar; grupo não monitorado: histórico → provisória, ao vivo → descartar; individual pessoal → descartar; individual → guardar. */
export function decidirGuardar(
  c: { tipo: "grupo" | "individual"; monitorada: boolean; categoria: string },
  origem: "historico" | "ao_vivo",
): DecisaoGuardar {
  if (c.tipo === "grupo") {
    if (c.monitorada) return "guardar";
    return origem === "historico" ? "provisoria" : "descartar";
  }
  return c.categoria === "pessoal" ? "descartar" : "guardar";
}

/** Dentro da janela de histórico (até 30 dias). */
export function dentroDoHistorico(enviadaEm: Date, agora: Date): boolean {
  return agora.getTime() - enviadaEm.getTime() <= DIAS_HISTORICO * 86_400_000;
}
