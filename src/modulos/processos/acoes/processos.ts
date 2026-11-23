"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dadosDoFormulario, idDaAcao, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaArea, esquemaCategoria, esquemaDocumento, esquemaNovoDocumento, esquemaPublicacao } from "../esquemas/processos";
import { validarFluxo } from "../regras/fluxo";
import { criarDocumento, excluirDocumento, publicarDocumento, restaurarVersao, salvarDocumento } from "../servicos/documentos";
import {
  criarArea,
  criarCategoria,
  criarEstruturaInicial,
  editarArea,
  editarCategoria,
  excluirArea,
  excluirCategoria,
  moverArea,
  moverCategoria,
} from "../servicos/estrutura";

const revalidar = () => revalidatePath("/processos", "layout");

const campo = (formData: FormData, nome: string) => {
  const v = formData.get(nome);
  return typeof v === "string" ? v : "";
};
const direcao = (v: unknown) => z.enum(["subir", "descer"]).parse(v);
const numeroVersao = (v: unknown) => z.number().int().positive().parse(v);

type Estado = EstadoAcao<{ id: string }>;

async function executar(fn: () => Promise<string | { mensagem: string; id?: string }>): Promise<Estado> {
  try {
    const r = await fn();
    revalidar();
    return typeof r === "string" ? { ok: true, mensagem: r } : { ok: true, mensagem: r.mensagem, dados: r.id ? { id: r.id } : undefined };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

// ─── Estrutura ──────────────────────────────────────────────────────────────

export async function criarCategoriaAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await criarCategoria(ator, esquemaCategoria.parse(dadosDoFormulario(formData)));
    return "Categoria criada.";
  });
}

export async function editarCategoriaAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await editarCategoria(ator, idDaAcao(campo(formData, "id")), esquemaCategoria.parse(dadosDoFormulario(formData)));
    return "Categoria atualizada.";
  });
}

export async function excluirCategoriaAcao(id: string) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await excluirCategoria(ator, idDaAcao(id));
    return "Categoria excluída.";
  });
}

export async function moverCategoriaAcao(id: string, para: string) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await moverCategoria(ator, idDaAcao(id), direcao(para));
    return "";
  });
}

export async function criarAreaAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await criarArea(ator, esquemaArea.parse(dadosDoFormulario(formData)));
    return "Área criada.";
  });
}

export async function editarAreaAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await editarArea(ator, idDaAcao(campo(formData, "id")), esquemaArea.parse(dadosDoFormulario(formData)));
    return "Área atualizada.";
  });
}

export async function excluirAreaAcao(id: string) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await excluirArea(ator, idDaAcao(id));
    return "Área excluída.";
  });
}

export async function moverAreaAcao(id: string, para: string) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await moverArea(ator, idDaAcao(id), direcao(para));
    return "";
  });
}

export async function criarEstruturaInicialAcao() {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await criarEstruturaInicial(ator);
    return "Estrutura criada. Os documentos estão em rascunho: revise e publique.";
  });
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export async function criarDocumentoAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    const doc = await criarDocumento(ator, esquemaNovoDocumento.parse(dadosDoFormulario(formData)));
    return { mensagem: "Documento criado.", id: doc.id };
  });
}

/** O editor manda o fluxo como JSON no campo `fluxo`. */
export async function salvarDocumentoAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    let fluxoBruto: unknown = [];
    try {
      fluxoBruto = JSON.parse(campo(formData, "fluxo") || "[]");
    } catch {
      fluxoBruto = null;
    }
    const fluxo = validarFluxo(fluxoBruto);
    await salvarDocumento(ator, idDaAcao(campo(formData, "id")), esquemaDocumento.parse(dadosDoFormulario(formData)), fluxo);
    return "Rascunho salvo.";
  });
}

export async function publicarDocumentoAcao(_: Estado, formData: FormData) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    const { nota } = esquemaPublicacao.parse(dadosDoFormulario(formData));
    const { numero } = await publicarDocumento(ator, idDaAcao(campo(formData, "id")), nota);
    return `Versão ${numero} publicada. O time já vê.`;
  });
}

export async function restaurarVersaoAcao(id: string, numero: number) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await restaurarVersao(ator, idDaAcao(id), numeroVersao(numero));
    return `Versão ${numero} copiada para o rascunho. Revise e publique.`;
  });
}

export async function excluirDocumentoAcao(id: string) {
  return executar(async () => {
    const ator = await exigirPermissao("processos:editar");
    await excluirDocumento(ator, idDaAcao(id));
    return "Documento excluído.";
  });
}
