// Dados FICTÍCIOS para desenvolvimento. Nunca rodar em produção nem usar dados reais.
// Uso: npm run db:seed
import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Papel } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (process.env.NODE_ENV === "production" || /prod/i.test(url)) {
  console.error("Seed bloqueado: parece um banco de produção.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url.replace(/^mysql:\/\//, "mariadb://")) });

// Senha comum a todos os usuários de desenvolvimento (só existe no banco de dev).
const SENHA_DEV = process.env.SEED_SENHA ?? "ipemaster-dev-2026";

const USUARIOS: { nome: string; email: string; papel: Papel }[] = [
  { nome: "Admin Desenvolvimento", email: "admin@ipemaster.test", papel: "admin" },
  { nome: "Gestora Exemplo", email: "gestor@ipemaster.test", papel: "gestor" },
  { nome: "Colaborador Exemplo", email: "colaborador@ipemaster.test", papel: "colaborador" },
  { nome: "Professora Exemplo", email: "professor@ipemaster.test", papel: "professor" },
];

async function main() {
  const senhaHash = await hashPassword(SENHA_DEV);
  for (const u of USUARIOS) {
    const usuario = await prisma.usuario.upsert({
      where: { email: u.email },
      update: { nome: u.nome, papel: u.papel, ativo: true },
      create: { ...u, emailVerificado: true },
    });
    const conta = await prisma.conta.findFirst({ where: { usuarioId: usuario.id, providerId: "credential" } });
    if (!conta) {
      await prisma.conta.create({
        data: { usuarioId: usuario.id, accountId: usuario.id, providerId: "credential", password: senhaHash },
      });
    }
  }
  console.info(`Seed ok: ${USUARIOS.length} usuários fictícios (@ipemaster.test). Senha: ver SENHA_DEV em prisma/seed.ts.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
