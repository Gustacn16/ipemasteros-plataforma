import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

// O Prisma 7 usa driver adapter (sem engine nativa), compatível com o servidor
// da Hostinger. Ver docs/decisoes/0002-build-na-hostinger.md
function criarCliente() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  // O driver mariadb espera o esquema mariadb://; o Prisma CLI usa mysql://.
  const adapter = new PrismaMariaDb(url.replace(/^mysql:\/\//, "mariadb://"));
  return new PrismaClient({ adapter });
}

// Reaproveita a instância entre recarregamentos do `next dev`.
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
