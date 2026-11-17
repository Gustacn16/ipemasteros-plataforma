const ESPERA_INICIAL_MS = 2000;
const ESPERA_MAXIMA_MS = 300_000;

/** Espera antes de reconectar: 2 s, 4 s, 8 s… até 5 min. */
export function esperaReconexao(tentativa: number): number {
  return Math.min(ESPERA_INICIAL_MS * 2 ** tentativa, ESPERA_MAXIMA_MS);
}
