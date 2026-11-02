"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import {
  esquemaAtualizarConteudo,
  esquemaCanal,
  esquemaEditarCanal,
  esquemaEditarMarca,
  esquemaMarca,
  esquemaMetricas,
  esquemaMudarEtapa,
  esquemaNovoConteudo,
  esquemaRegistrarPublicacao,
} from "../esquemas/conteudo";
import { criarCanal, criarMarca, editarCanal, editarMarca, excluirMarca } from "../servicos/contas";
import {
  atualizarConteudo,
  criarConteudo,
  excluirConteudo,
  mudarEtapa,
  registrarPublicacao,
  salvarMetricas,
} from "../servicos/conteudos";

// Todas as visões do módulo (e o menu de contas) leem os mesmos dados.
const revalidar = () => revalidatePath("/conteudo", "layout");

async function executar<T>(permissao: Parameters<typeof exigirPermissao>[0], fn: (ator: Awaited<ReturnType<typeof exigirPermissao>>) => Promise<EstadoAcao<T>>) {
  try {
    const ator = await exigirPermissao(permissao);
    const r = await fn(ator);
    revalidar();
    return r;
  } catch (erro) {
    return tratarErroAcao<T>(erro);
  }
}

export async function criarMarcaAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  return executar("conteudo:gerenciar_canais", async (ator) => {
    await criarMarca(ator, esquemaMarca.parse(dadosDoFormulario(formData)));
    return { ok: true, mensagem: "Conta criada." };
  });
}

export async function editarMarcaAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:gerenciar_canais", async (ator) => {
    const { marcaId, ...resto } = esquemaEditarMarca.parse(dados);
    await editarMarca(ator, marcaId, resto);
    return { ok: true, mensagem: "Conta atualizada." };
  });
}

export async function excluirMarcaAcao(marcaId: string): Promise<EstadoAcao> {
  return executar("conteudo:gerenciar_canais", async (ator) => {
    await excluirMarca(ator, marcaId);
    return { ok: true, mensagem: "Conta excluída." };
  });
}

export async function criarCanalAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:gerenciar_canais", async (ator) => {
    await criarCanal(ator, esquemaCanal.parse(dados));
    return { ok: true, mensagem: "Canal adicionado." };
  });
}

export async function editarCanalAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:gerenciar_canais", async (ator) => {
    const { canalId, ...resto } = esquemaEditarCanal.parse(dados);
    await editarCanal(ator, canalId, resto);
    return { ok: true, mensagem: "Canal atualizado." };
  });
}

export async function criarConteudoAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  return executar("conteudo:usar", async (ator) => {
    const conteudo = await criarConteudo(ator, esquemaNovoConteudo.parse(dados));
    return { ok: true, mensagem: "Conteúdo criado.", dados: { id: conteudo.id } };
  });
}

export async function atualizarConteudoAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:usar", async (ator) => {
    const { conteudoId, ...campos } = esquemaAtualizarConteudo.parse(dados);
    const { voltouParaRevisao } = await atualizarConteudo(ator, conteudoId, campos);
    return {
      ok: true,
      mensagem: voltouParaRevisao ? "Salvo. O texto mudou, então o conteúdo voltou para revisão." : "Conteúdo salvo.",
    };
  });
}

export async function mudarEtapaAcao(conteudoId: string, etapa: string): Promise<EstadoAcao> {
  return executar("conteudo:usar", async (ator) => {
    const d = esquemaMudarEtapa.parse({ conteudoId, etapa });
    await mudarEtapa(ator, d.conteudoId, d.etapa);
    return { ok: true };
  });
}

export async function registrarPublicacaoAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:usar", async (ator) => {
    const { publicacaoId, ...resto } = esquemaRegistrarPublicacao.parse(dados);
    await registrarPublicacao(ator, publicacaoId, resto);
    return { ok: true, mensagem: resto.publicado ? "Publicação registrada." : "Publicação desmarcada." };
  });
}

export async function salvarMetricasAcao(dados: unknown): Promise<EstadoAcao> {
  return executar("conteudo:usar", async (ator) => {
    const { publicacaoId, ...metricas } = esquemaMetricas.parse(dados);
    await salvarMetricas(ator, publicacaoId, metricas);
    return { ok: true, mensagem: "Métricas salvas." };
  });
}

export async function excluirConteudoAcao(conteudoId: string): Promise<EstadoAcao> {
  return executar("conteudo:usar", async (ator) => {
    await excluirConteudo(ator, conteudoId);
    return { ok: true, mensagem: "Conteúdo excluído." };
  });
}
