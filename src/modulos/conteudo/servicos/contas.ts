import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import type { Plataforma } from "../esquemas/conteudo";
import { FORMATOS_INICIAIS } from "../regras/formatos";

// Marcas (contas) e canais (plataformas de cada marca).

export const MENSAGEM_NAO_ENCONTRADO = "Não encontrado.";

function exigirGerenciarCanais(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:gerenciar_canais")) throw new ErroPermissao("conteudo:gerenciar_canais");
}

/** Marcas com canais, para o menu e os formulários. `todos` inclui canais inativos. */
export async function listarContas(opcoes: { todos?: boolean } = {}) {
  return prisma.marca.findMany({
    where: { excluidoEm: null },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      cor: true,
      canais: {
        where: { excluidoEm: null, ...(opcoes.todos ? {} : { ativo: true }) },
        orderBy: [{ ordem: "asc" }],
        select: {
          id: true,
          plataforma: true,
          identificador: true,
          ativo: true,
          formatos: {
            where: opcoes.todos ? {} : { ativo: true },
            orderBy: [{ ordem: "asc" }, { nome: "asc" }],
            select: { id: true, nome: true, ativo: true },
          },
        },
      },
    },
  });
}
export type Conta = Awaited<ReturnType<typeof listarContas>>[number];

export async function criarMarca(ator: UsuarioAtual, dados: { nome: string; cor: string }) {
  exigirGerenciarCanais(ator);
  const existente = await prisma.marca.findFirst({ where: { nome: dados.nome, excluidoEm: null } });
  if (existente) throw new ErroNegocio("Já existe uma conta com este nome.");
  const maior = await prisma.marca.aggregate({ _max: { ordem: true } });
  return prisma.marca.create({ data: { ...dados, ordem: (maior._max.ordem ?? 0) + 1 } });
}

export async function editarMarca(ator: UsuarioAtual, marcaId: string, dados: { nome: string; cor: string }) {
  exigirGerenciarCanais(ator);
  await exigirMarca(marcaId);
  const repetida = await prisma.marca.findFirst({ where: { nome: dados.nome, excluidoEm: null, id: { not: marcaId } } });
  if (repetida) throw new ErroNegocio("Já existe uma conta com este nome.");
  await prisma.marca.update({ where: { id: marcaId }, data: dados });
}

export async function excluirMarca(ator: UsuarioAtual, marcaId: string) {
  exigirGerenciarCanais(ator);
  await exigirMarca(marcaId);
  await prisma.marca.update({ where: { id: marcaId }, data: { excluidoEm: new Date() } });
}

async function exigirMarca(marcaId: string) {
  const marca = await prisma.marca.findFirst({ where: { id: marcaId, excluidoEm: null } });
  if (!marca) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  return marca;
}

export async function criarCanal(
  ator: UsuarioAtual,
  dados: { marcaId: string; plataforma: Plataforma; identificador: string | null },
) {
  exigirGerenciarCanais(ator);
  await exigirMarca(dados.marcaId);
  const maior = await prisma.canal.aggregate({ _max: { ordem: true }, where: { marcaId: dados.marcaId } });
  return prisma.canal.create({
    data: {
      ...dados,
      ordem: (maior._max.ordem ?? 0) + 1,
      formatos: { create: FORMATOS_INICIAIS[dados.plataforma].map((nome, i) => ({ nome, ordem: i + 1 })) },
    },
  });
}

export async function editarCanal(ator: UsuarioAtual, canalId: string, dados: { identificador: string | null; ativo: boolean }) {
  exigirGerenciarCanais(ator);
  const canal = await prisma.canal.findFirst({ where: { id: canalId, excluidoEm: null } });
  if (!canal) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  await prisma.canal.update({ where: { id: canalId }, data: dados });
}

/**
 * Formato novo no canal (quem usa o Conteúdo cria direto no formulário).
 * Se o canal já teve um formato com esse nome e ele foi desativado, ele volta.
 */
export async function criarFormato(ator: UsuarioAtual, dados: { canalId: string; nome: string }) {
  if (!temPermissao(ator.papel, "conteudo:usar")) throw new ErroPermissao("conteudo:usar");
  const canal = await prisma.canal.findFirst({ where: { id: dados.canalId, excluidoEm: null, marca: { excluidoEm: null } } });
  if (!canal) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  // O banco compara nomes sem diferenciar maiúsculas nem acentos (collation utf8mb4_unicode_ci).
  const existente = await prisma.formatoCanal.findFirst({ where: { canalId: dados.canalId, nome: dados.nome } });
  if (existente?.ativo) throw new ErroNegocio("Este canal já tem esse formato.");
  if (existente) return prisma.formatoCanal.update({ where: { id: existente.id }, data: { ativo: true } });
  const maior = await prisma.formatoCanal.aggregate({ _max: { ordem: true }, where: { canalId: dados.canalId } });
  return prisma.formatoCanal.create({ data: { ...dados, ordem: (maior._max.ordem ?? 0) + 1 } });
}

/** Renomear ou desativar um formato. Formato não é apagado: os conteúdos dele continuam com o nome. */
export async function editarFormato(ator: UsuarioAtual, formatoId: string, dados: { nome: string; ativo: boolean }) {
  exigirGerenciarCanais(ator);
  const formato = await prisma.formatoCanal.findFirst({ where: { id: formatoId } });
  if (!formato) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  const repetido = await prisma.formatoCanal.findFirst({ where: { canalId: formato.canalId, nome: dados.nome, id: { not: formatoId } } });
  if (repetido) throw new ErroNegocio("Este canal já tem um formato com esse nome.");
  await prisma.formatoCanal.update({ where: { id: formatoId }, data: dados });
}
