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
  await semearEspiao();
  console.info(`Seed ok: ${USUARIOS.length} usuários fictícios (@ipemaster.test). Senha: ver SENHA_DEV em prisma/seed.ts.`);
}

/** Espião: 2 concorrentes FICTÍCIOS com uma coleta, fotos, posts, uma página e sinais, para ver as telas. */
async function semearEspiao() {
  if (await prisma.concorrente.findFirst({ where: { nome: "Concorrente Fictício A" } })) return;
  const dia = 86_400_000;
  const agora = Date.now();
  const coleta = await prisma.coletaEspiao.create({
    data: { origem: "manual", status: "concluida", iniciadaEm: new Date(agora - 3600_000), finalizadaEm: new Date(), passos: { concorrentes: {}, analise: true }, erros: [] },
  });
  for (const [i, nome] of ["Concorrente Fictício A", "Concorrente Fictício B"].entries()) {
    const c = await prisma.concorrente.create({ data: { nome, instagram: `ficticio.${i + 1}`, site: `ficticio${i + 1}.test` } });
    await prisma.fotoInstagram.createMany({
      data: [
        { concorrenteId: c.id, seguidores: 10_000 + i * 3000, totalPosts: 400, capturadaEm: new Date(agora - 7 * dia) },
        { concorrenteId: c.id, coletaId: coleta.id, seguidores: 10_400 + i * 3000, totalPosts: 405, capturadaEm: new Date() },
      ],
    });
    for (let n = 0; n < 6; n++) {
      await prisma.midiaConcorrente.create({
        data: {
          concorrenteId: c.id, idExterno: `seed-${i}-${n}`, tipo: "reels", legenda: `Reels fictício ${n} sobre residência médica`,
          permalink: "https://www.instagram.com/", publicadoEm: new Date(agora - (n * 4 + 1) * dia), curtidas: 100 + n * 10, comentarios: 5,
          visualizacoes: n === 0 ? 9000 : 2000, metricasEm: new Date(), situacaoTranscricao: "feita",
          transcricao: "Transcrição fictícia: inscrições abertas para a pós.", resumo: "Promete aprovação e chama para a inscrição.",
        },
      });
    }
    const pagina = await prisma.paginaConcorrente.create({ data: { concorrenteId: c.id, url: `https://ficticio${i + 1}.test/pos`, rotulo: "Pós Fictícia", legivel: true, ultimaCapturaEm: new Date() } });
    await prisma.versaoPagina.create({ data: { paginaId: pagina.id, hash: `seed${i}`, texto: "Texto fictício da página.", precos: ["12x R$ 699,00"] } });
    await prisma.sinalEspiao.createMany({
      data: [
        { concorrenteId: c.id, coletaId: coleta.id, tipo: "conteudo_destaque", titulo: "Reels com 4,5× a média do perfil", detalhe: { resumo: "Promete aprovação e chama para a inscrição." }, origemUrl: "https://www.instagram.com/", chave: `seed-destaque-${i}` },
        { concorrenteId: c.id, coletaId: coleta.id, tipo: "preco_mudou", titulo: "Preço mudou em Pós Fictícia", detalhe: { antes: ["12x R$ 899,00"], depois: ["12x R$ 699,00"] }, origemUrl: pagina.url, chave: `seed-preco-${i}` },
      ],
    });
  }
  await prisma.relatorioEspiao.create({ data: { coletaId: coleta.id, analise: "## O que mudou\n- Dados fictícios de exemplo.\n## O que isso sugere\n- Nada: é seed.\n## Ideias para a IPEMaster\n1. Testar as telas." } });
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
