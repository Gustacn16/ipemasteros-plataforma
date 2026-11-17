import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";

const entrada = z.object({ nome: z.string().min(2).describe("parte do nome da pessoa") });

export const ferramentaBuscarPessoas: FerramentaNexu<typeof entrada> = {
  nome: "buscar_pessoas",
  descricao: "Acha usuários ativos do sistema pelo nome (para responsável de tarefa ou vendedor). Devolve só id, nome e papel. Até 10.",
  entrada,
  permissao: "nexu:usar",
  rotulo: "Procurando pessoas…",
  tipo: "consulta",
  async executar(_ator, { nome }) {
    const pessoas = await prisma.usuario.findMany({
      where: { ativo: true, nome: { contains: nome.trim() } },
      orderBy: { nome: "asc" },
      take: 10,
      select: { id: true, nome: true, papel: true },
    });
    return limitarLista(
      pessoas.map((p) => ({ id: p.id, nome: p.nome, papel: p.papel })),
      10,
    );
  },
};
