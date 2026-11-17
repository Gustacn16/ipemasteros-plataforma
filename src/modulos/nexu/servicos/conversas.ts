import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { PapelMensagemNexu, Prisma } from "@/generated/prisma/client";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { ehPerguntaDoUsuario } from "./prompt";

// Conversas do Nexu. Só o dono lê, escreve ou apaga (vale também para o admin). Exclusão física (LGPD).

const TAMANHO_TITULO = 120;

/** Título da conversa: a pergunta sem quebras de linha, cortada em 120 caracteres (sem chamada à IA). */
export function tituloDaPergunta(pergunta: string): string {
  const limpo = pergunta.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return (limpo || "Nova conversa").slice(0, TAMANHO_TITULO);
}

export type MensagemParaGravar = { papel: PapelMensagemNexu; conteudo: Anthropic.MessageParam["content"] | Anthropic.ContentBlock[] };

export async function listarConversas(ator: UsuarioAtual) {
  return prisma.conversaNexu.findMany({
    where: { usuarioId: ator.id },
    orderBy: { atualizadoEm: "desc" },
    select: { id: true, titulo: true, atualizadoEm: true },
  });
}

export async function obterConversa(ator: UsuarioAtual, id: string) {
  const conversa = await prisma.conversaNexu.findFirst({
    where: { id, usuarioId: ator.id },
    include: { mensagens: { orderBy: { ordem: "asc" } } },
  });
  if (!conversa) throw new ErroNegocio("Não encontrado.");
  return conversa;
}

export async function criarConversa(ator: UsuarioAtual, titulo: string) {
  return prisma.conversaNexu.create({ data: { usuarioId: ator.id, titulo: tituloDaPergunta(titulo) } });
}

/** Grava as mensagens no fim da conversa, com `ordem` crescente, e marca a conversa como atualizada. */
export async function anexarMensagens(conversaId: string, msgs: MensagemParaGravar[]): Promise<void> {
  if (msgs.length === 0) return;
  await prisma.$transaction(async (tx) => {
    const { _max } = await tx.mensagemNexu.aggregate({ where: { conversaId }, _max: { ordem: true } });
    const base = _max.ordem ?? 0;
    await tx.mensagemNexu.createMany({
      data: msgs.map((m, i) => ({
        conversaId,
        papel: m.papel,
        conteudo: m.conteudo as unknown as Prisma.InputJsonValue,
        ordem: base + i + 1,
      })),
    });
    await tx.conversaNexu.update({ where: { id: conversaId }, data: { atualizadoEm: new Date() } });
  });
}

export async function apagarConversa(ator: UsuarioAtual, id: string): Promise<void> {
  const { count } = await prisma.conversaNexu.deleteMany({ where: { id, usuarioId: ator.id } });
  if (count === 0) throw new ErroNegocio("Não encontrado.");
}

/** Quantas perguntas a conversa já tem (mensagens da pessoa com o bloco de contexto; tool_result não conta). */
export function contarPerguntasNasMensagens(mensagens: { papel: PapelMensagemNexu; conteudo: unknown }[]): number {
  return mensagens.filter((m) => m.papel === "usuario" && ehPerguntaDoUsuario(m.conteudo)).length;
}

export async function contarPerguntas(conversaId: string): Promise<number> {
  const mensagens = await prisma.mensagemNexu.findMany({
    where: { conversaId, papel: "usuario" },
    select: { papel: true, conteudo: true },
  });
  return contarPerguntasNasMensagens(mensagens);
}
