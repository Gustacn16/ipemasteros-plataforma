import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // O usuário MySQL da Hostinger não pode criar bancos, então o Prisma
    // usa um banco "shadow" fixo para gerar migrations (só em dev).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
