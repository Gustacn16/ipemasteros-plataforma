"use server";

import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { confirmarProposta, recusarProposta } from "../servicos/propostas";
import type { PropostaVisivel } from "../tipos";

/** Confirma uma proposta do Nexu. A ação roda como a pessoa logada; o serviço do módulo refaz a checagem de permissão. */
export async function confirmarPropostaAcao(id: string): Promise<EstadoAcao<PropostaVisivel>> {
  try {
    const ator = await exigirPermissao("nexu:usar");
    return { ok: true, dados: await confirmarProposta(ator, String(id)) };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** Recusa uma proposta do Nexu (só o dono, só se ainda estiver pendente). */
export async function recusarPropostaAcao(id: string): Promise<EstadoAcao<PropostaVisivel>> {
  try {
    const ator = await exigirPermissao("nexu:usar");
    return { ok: true, dados: await recusarProposta(ator, String(id)) };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
