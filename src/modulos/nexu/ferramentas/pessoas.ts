import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nomeBusca } from "@/modulos/academico/regras/normalizar";
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
    // Filtra no código, não com LIKE: no MySQL da Hostinger o LIKE com parâmetro dá
    // "Illegal mix of collations" (1267). A equipe é pequena e assim a busca ignora acentos.
    const chave = nomeBusca(nome);
    const ativos = await prisma.usuario.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, papel: true },
    });
    const achados = chave ? ativos.filter((p) => nomeBusca(p.nome).includes(chave)) : [];
    return limitarLista(
      achados.map((p) => ({ id: p.id, nome: p.nome, papel: p.papel })),
      10,
    );
  },
};
