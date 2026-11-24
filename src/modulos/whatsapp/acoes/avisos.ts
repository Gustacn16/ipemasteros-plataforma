"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { aprovarAviso, aprovarTodos, cancelarAviso, salvarAviso } from "../servicos/avisos";

const idAviso = z.string().min(1).max(40);
const intervalo = z.object({ de: z.coerce.date(), ate: z.coerce.date() });

function atualizarTelas() {
  revalidatePath("/whatsapp/avisos");
  revalidatePath("/whatsapp/visao-geral");
}

export async function salvarAvisoAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("whatsapp:avisos");
    const salvo = await salvarAviso(ator, dados);
    atualizarTelas();
    return { ok: true, mensagem: "Aviso salvo.", dados: salvo };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function aprovarAvisoAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("whatsapp:avisos");
    await aprovarAviso(ator, idAviso.parse(id));
    atualizarTelas();
    return { ok: true, mensagem: "Aviso aprovado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function aprovarTodosAcao(
  dados: unknown,
): Promise<EstadoAcao<{ aprovados: number; recusados: { id: string; motivo: string }[] }>> {
  try {
    const ator = await exigirPermissao("whatsapp:avisos");
    const { de, ate } = intervalo.parse(dados);
    const resultado = await aprovarTodos(ator, de, ate);
    atualizarTelas();
    return { ok: true, mensagem: `${resultado.aprovados} aviso(s) aprovado(s).`, dados: resultado };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function cancelarAvisoAcao(id: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("whatsapp:avisos");
    await cancelarAviso(ator, idAviso.parse(id));
    atualizarTelas();
    return { ok: true, mensagem: "Aviso cancelado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
