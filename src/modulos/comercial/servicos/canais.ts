import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosCanal } from "../esquemas/produto";
import { MENSAGEM_NAO_ENCONTRADO, exigirPermissaoComercial } from "./acesso";

export async function listarCanais(opcoes: { soAtivos?: boolean } = {}) {
  return prisma.canalVenda.findMany({
    where: opcoes.soAtivos ? { ativo: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, ativo: true },
  });
}

export async function salvarCanal(ator: UsuarioAtual, dados: DadosCanal & { id?: string }) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  await prisma.$transaction(async (tx) => {
    const repetido = await tx.canalVenda.findFirst({
      where: { nome: dados.nome, ...(dados.id ? { id: { not: dados.id } } : {}) },
      select: { id: true },
    });
    if (repetido) throw new ErroNegocio("Já existe um canal com este nome.");
    if (dados.id) {
      const existe = await tx.canalVenda.findUnique({ where: { id: dados.id }, select: { id: true } });
      if (!existe) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
      await tx.canalVenda.update({ where: { id: dados.id }, data: { nome: dados.nome } });
      return;
    }
    const maior = await tx.canalVenda.aggregate({ _max: { ordem: true } });
    await tx.canalVenda.create({ data: { nome: dados.nome, ordem: (maior._max.ordem ?? 0) + 1 } });
  });
}

export async function definirAtivoCanal(ator: UsuarioAtual, id: string, ativo: boolean) {
  exigirPermissaoComercial(ator, "comercial:gerenciar_produtos");
  const existe = await prisma.canalVenda.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await prisma.canalVenda.update({ where: { id }, data: { ativo } });
}
