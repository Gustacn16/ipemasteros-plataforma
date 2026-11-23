"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dadosDoFormulario, idDaAcao, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao, exigirUsuario } from "@/lib/sessao";
import {
  esquemaAno,
  esquemaIndicador,
  esquemaLancamento,
  esquemaMetaAvulsa,
  esquemaMetasIndicador,
  esquemaPremissaProduto,
  esquemaPremissasFunil,
  esquemaTurma,
} from "../esquemas/planejamento";
import { criarIndicador, editarIndicador, excluirIndicador, moverIndicador, salvarMetasIndicador } from "../servicos/indicadores";
import { lancarResultado } from "../servicos/lancamento";
import {
  criarPlano,
  excluirTurma,
  removerPremissaProduto,
  salvarMetaAvulsa,
  salvarPremissaProduto,
  salvarPremissasFunil,
  salvarTurma,
} from "../servicos/planos";

export type Estado = EstadoAcao;

const campo = (formData: FormData, nome: string) => {
  const v = formData.get(nome);
  return typeof v === "string" ? v : "";
};

async function executar(fn: () => Promise<string>): Promise<Estado> {
  try {
    const mensagem = await fn();
    revalidatePath("/planejamento", "layout");
    revalidatePath("/comercial/metas/cadastro");
    return { ok: true, mensagem };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

// ─── Plano ──────────────────────────────────────────────────────────────────

export async function criarPlanoAcao(ano: number): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await criarPlano(ator, esquemaAno.parse(ano));
    return `Plano de ${ano} criado.`;
  });
}

export async function salvarPremissasFunilAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await salvarPremissasFunil(ator, idDaAcao(campo(formData, "planoId")), esquemaPremissasFunil.parse(dadosDoFormulario(formData)));
    return "Premissas do funil salvas.";
  });
}

export async function salvarPremissaProdutoAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await salvarPremissaProduto(ator, idDaAcao(campo(formData, "planoId")), esquemaPremissaProduto.parse(dadosDoFormulario(formData)));
    return "Premissas do produto salvas.";
  });
}

export async function removerPremissaProdutoAcao(planoId: string, produtoId: string): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await removerPremissaProduto(ator, idDaAcao(planoId), idDaAcao(produtoId));
    return "Produto tirado das premissas.";
  });
}

export async function salvarTurmaAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    const id = campo(formData, "id") || null;
    await salvarTurma(ator, idDaAcao(campo(formData, "planoId")), id, esquemaTurma.parse(dadosDoFormulario(formData)));
    return id ? "Turma atualizada." : "Turma adicionada.";
  });
}

export async function excluirTurmaAcao(planoId: string, id: string): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await excluirTurma(ator, idDaAcao(planoId), idDaAcao(id));
    return "Turma excluída.";
  });
}

export async function salvarMetaAvulsaAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await salvarMetaAvulsa(ator, idDaAcao(campo(formData, "planoId")), esquemaMetaAvulsa.parse(dadosDoFormulario(formData)));
    return "Meta avulsa salva.";
  });
}

// ─── Indicadores ────────────────────────────────────────────────────────────

function lerIndicador(formData: FormData) {
  const d = dadosDoFormulario(formData);
  let parametros: unknown = {};
  try {
    parametros = JSON.parse(d.fonteParametros || "{}");
  } catch {
    parametros = {};
  }
  return esquemaIndicador.parse({ ...d, fonteParametros: parametros, noPainel: formData.get("noPainel") === "on" });
}

export async function salvarIndicadorAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    const id = campo(formData, "id");
    const dados = lerIndicador(formData);
    if (id) {
      await editarIndicador(ator, id, dados);
      return "Indicador atualizado.";
    }
    await criarIndicador(ator, idDaAcao(campo(formData, "planoId")), dados);
    return "Indicador criado.";
  });
}

export async function moverIndicadorAcao(id: string, direcao: unknown): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await moverIndicador(ator, idDaAcao(id), z.enum(["subir", "descer"]).parse(direcao));
    return "";
  });
}

export async function excluirIndicadorAcao(id: string): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    await excluirIndicador(ator, idDaAcao(id));
    return "Indicador excluído.";
  });
}

export async function salvarMetasIndicadorAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirPermissao("planejamento:editar");
    const valores = Object.fromEntries(
      [...formData.entries()].filter(([k, v]) => k.startsWith("mes:") && typeof v === "string").map(([k, v]) => [k.slice(4), v as string]),
    );
    await salvarMetasIndicador(ator, esquemaMetasIndicador.parse({ indicadorId: campo(formData, "indicadorId"), valores }));
    return "Metas salvas.";
  });
}

// ─── Lançamento ─────────────────────────────────────────────────────────────

export async function lancarResultadoAcao(_: Estado, formData: FormData): Promise<Estado> {
  return executar(async () => {
    const ator = await exigirUsuario();
    const dados = esquemaLancamento.parse(dadosDoFormulario(formData));
    await lancarResultado(ator, dados);
    return dados.valor === null ? "Resultado apagado." : "Resultado lançado.";
  });
}
