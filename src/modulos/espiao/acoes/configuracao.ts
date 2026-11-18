"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, idDaAcao, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaConcorrente, esquemaPagina, esquemaTeto } from "../esquemas/configuracao";
import { coletarAgora, criarConcorrente, editarConcorrente, excluirConcorrente, excluirPagina, salvarPagina, salvarTetoEspiao } from "../servicos/concorrentes";

const CAMINHO = "/espiao/configurar";

async function executar(fn: () => Promise<string>): Promise<EstadoAcao> {
  try {
    const mensagem = await fn();
    revalidatePath(CAMINHO);
    revalidatePath("/espiao");
    return { ok: true, mensagem };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function salvarConcorrenteAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    const campos = dadosDoFormulario(formData);
    const dados = esquemaConcorrente.parse({ ...campos, ativo: formData.get("ativo") ?? "false" });
    if (campos.id) await editarConcorrente(ator, idDaAcao(campos.id), dados);
    else await criarConcorrente(ator, dados);
    return "Concorrente salvo.";
  });
}

export async function excluirConcorrenteAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    await excluirConcorrente(ator, idDaAcao(formData.get("id")));
    return "Concorrente excluído.";
  });
}

export async function salvarPaginaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    const campos = dadosDoFormulario(formData);
    const dados = esquemaPagina.parse({ ...campos, ativa: formData.get("ativa") ?? "false" });
    await salvarPagina(ator, idDaAcao(campos.concorrenteId), { ...dados, id: campos.id || undefined });
    return "Página salva.";
  });
}

export async function excluirPaginaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    await excluirPagina(ator, idDaAcao(formData.get("id")));
    return "Página excluída.";
  });
}

export async function salvarTetoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    const { tetoUsd } = esquemaTeto.parse(dadosDoFormulario(formData));
    await salvarTetoEspiao(ator, tetoUsd);
    return "Teto salvo.";
  });
}

export async function coletarAgoraAcao(): Promise<EstadoAcao> {
  return executar(async () => {
    const ator = await exigirPermissao("espiao:configurar");
    await coletarAgora(ator);
    return "Coleta iniciada. Ela roda em segundo plano; atualize a página em alguns minutos.";
  });
}
