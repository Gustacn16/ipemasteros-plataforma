import "server-only";
import { prisma } from "@/lib/prisma";

export const RETENCAO_MESES = 18;

/** Apaga versões de página, fotos de seguidores e sinais com mais de 18 meses. A última versão de cada página sempre fica. */
export async function limparEspiaoAntigo(agora: Date = new Date()): Promise<{ versoes: number; fotos: number; sinais: number }> {
  const limite = new Date(agora);
  limite.setUTCMonth(limite.getUTCMonth() - RETENCAO_MESES);

  const antigas = await prisma.versaoPagina.findMany({ where: { capturadaEm: { lt: limite } }, select: { id: true, paginaId: true, capturadaEm: true } });
  let versoes = 0;
  if (antigas.length) {
    const paginas = [...new Set(antigas.map((v) => v.paginaId))];
    const todas = await prisma.versaoPagina.findMany({ where: { paginaId: { in: paginas } }, select: { id: true, paginaId: true, capturadaEm: true } });
    const maisRecente = new Map<string, { id: string; capturadaEm: Date }>();
    for (const v of todas) {
      const atual = maisRecente.get(v.paginaId);
      if (!atual || v.capturadaEm > atual.capturadaEm) maisRecente.set(v.paginaId, v);
    }
    const manter = new Set([...maisRecente.values()].map((v) => v.id));
    const apagar = antigas.filter((v) => !manter.has(v.id)).map((v) => v.id);
    if (apagar.length) versoes = (await prisma.versaoPagina.deleteMany({ where: { id: { in: apagar } } })).count;
  }
  const [fotos, sinais] = await Promise.all([
    prisma.fotoInstagram.deleteMany({ where: { capturadaEm: { lt: limite } } }),
    prisma.sinalEspiao.deleteMany({ where: { criadoEm: { lt: limite } } }),
  ]);
  return { versoes, fotos: fotos.count, sinais: sinais.count };
}
