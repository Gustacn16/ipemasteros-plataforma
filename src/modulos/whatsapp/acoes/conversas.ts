"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirUsuario } from "@/lib/sessao";
import { definirCategoria, definirMonitoramento, ligarTurma } from "../servicos/conversas";

const id = z.string().min(1).max(40);
const categoria = z.enum(["aluno", "lead", "equipe", "pessoal", "outro"]);

export async function definirMonitoramentoAcao(conversaId: string, monitorada: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await definirMonitoramento(ator, id.parse(conversaId), z.boolean().parse(monitorada));
    revalidatePath("/whatsapp/grupos");
    return { ok: true, mensagem: monitorada ? "Grupo em acompanhamento." : "Grupo sem acompanhamento; mensagens apagadas." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function ligarTurmaAcao(conversaId: string, turmaId: string | null): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await ligarTurma(ator, id.parse(conversaId), turmaId === null ? null : id.parse(turmaId));
    revalidatePath("/whatsapp/grupos");
    return { ok: true, mensagem: "Turma atualizada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirCategoriaAcao(conversaId: string, nova: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await definirCategoria(ator, id.parse(conversaId), categoria.parse(nova));
    revalidatePath("/whatsapp/conversas");
    return { ok: true, mensagem: nova === "pessoal" ? "Conversa pessoal; mensagens apagadas." : "Categoria atualizada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
