// Gera a migration de dados do catálogo: npx tsx scripts/gerar-sql-catalogo.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { gerarSqlCatalogo } from "../src/modulos/comercial/dados/sql-catalogo";

const pasta = "prisma/migrations/20261103030000_comercial_catalogo";
mkdirSync(pasta, { recursive: true });
writeFileSync(`${pasta}/migration.sql`, gerarSqlCatalogo());
console.log(`Gerado ${pasta}/migration.sql`);
