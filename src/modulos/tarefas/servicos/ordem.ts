import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Próxima posição no fim de uma coleção ordenada (bloco 2 traz a ordem fracionária do arrastar). */
export function proximaOrdem(maior: Prisma.Decimal | null | undefined): number {
  return maior ? Math.floor(Number(maior)) + 1 : 1;
}
