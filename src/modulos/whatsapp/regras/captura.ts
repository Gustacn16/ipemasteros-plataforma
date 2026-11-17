/** Só os últimos 30 dias de histórico entram. */
export const DIAS_HISTORICO = 30;
/** Mensagens de grupo não monitorado vindas do histórico ficam 48 h. */
export const HORAS_PROVISORIO = 48;
/** Mensagens são apagadas depois de 90 dias. */
export const DIAS_RETENCAO = 90;

/**
 * Chave para casar telefones brasileiros com ou sem 55 e com ou sem o 9: a forma canônica com o 9
 * (celular antigo de 10 dígitos ganha o 9 depois do DDD; fixo fica com 10 dígitos). Fora do Brasil
 * ou fora desses formatos: os dígitos como vieram. null se tiver menos de 10 dígitos.
 * Os dígitos já devem vir sem pontuação.
 */
export function chaveTelefone(digitos: string | null | undefined): string | null {
  if (!digitos || digitos.length < 10) return null;
  const n = digitos.length;
  const local = (n === 12 || n === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  const ddd = local.slice(0, 2);
  const dddValido = /^[1-9][1-9]$/.test(ddd);
  if (dddValido && local.length === 11 && local[2] === "9") return local;
  if (dddValido && local.length === 10) {
    if (/[6-9]/.test(local[2])) return ddd + "9" + local.slice(2);
    if (/[2-5]/.test(local[2])) return local;
  }
  return digitos;
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
