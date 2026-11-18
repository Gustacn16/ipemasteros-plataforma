import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Pasta das sessões: vazio vira `<motor>/sessoes`; caminho relativo é resolvido a partir da pasta do motor. */
export function resolverPastaSessoes(valor: string | undefined, baseMotor: string): string {
  const texto = valor?.trim();
  return path.resolve(baseMotor, texto || "sessoes");
}

function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    // EPERM: o processo existe, só não temos permissão para sinalizá-lo.
    return (erro as NodeJS.ErrnoException).code === "EPERM";
  }
}

function lerPid(arquivo: string): number | null {
  try {
    const pid = Number.parseInt(readFileSync(arquivo, "utf8").trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Garante que só um motor use a pasta de sessões: grava `.motor.pid` com o pid atual.
 * Se o arquivo já existe e o processo dono está vivo, lança erro; se está morto, assume a trava.
 * Devolve a função que libera a trava (só apaga o arquivo se ele ainda for deste processo).
 */
export function adquirirTrava(pasta: string, pid: number = process.pid): () => void {
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, ".motor.pid");
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      writeFileSync(arquivo, String(pid), { flag: "wx" });
      return () => {
        if (lerPid(arquivo) === pid) {
          try {
            unlinkSync(arquivo);
          } catch {
            // Já foi apagado.
          }
        }
      };
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== "EEXIST") throw erro;
    }
    const dono = lerPid(arquivo);
    if (dono !== null && dono !== pid && processoVivo(dono)) {
      throw new Error(`Outro motor já está rodando (pid ${dono}).`);
    }
    // Trava velha (dono morto ou arquivo ilegível): apaga e tenta de novo.
    try {
      unlinkSync(arquivo);
    } catch {
      // Outro processo pode ter apagado antes.
    }
  }
  throw new Error("Não consegui adquirir a trava do motor.");
}
