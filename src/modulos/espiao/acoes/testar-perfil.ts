"use server";

import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { ErroMeta } from "@/lib/meta-graph";
import { exigirPermissao } from "@/lib/sessao";
import { type CamposDoTeste, testarPerfil } from "../servicos/testar-perfil";

export type ResultadoTeste = {
  usuario: string;
  seguidores: number;
  totalPosts: number;
  campos: CamposDoTeste;
  midias: { idExterno: string; tipo: string; publicadoEm: string; curtidas: number | null; visualizacoes: number | null; temVideo: boolean; permalink: string }[];
};

export async function testarPerfilAcao(_: EstadoAcao<ResultadoTeste>, formData: FormData): Promise<EstadoAcao<ResultadoTeste>> {
  try {
    const ator = await exigirPermissao("espiao:configurar");
    const { perfil, campos } = await testarPerfil(ator, String(formData.get("usuario") ?? ""));
    return {
      ok: true,
      dados: {
        usuario: perfil.usuario,
        seguidores: perfil.seguidores,
        totalPosts: perfil.totalPosts,
        campos,
        midias: perfil.midias.map((m) => ({
          idExterno: m.idExterno,
          tipo: m.tipo,
          publicadoEm: m.publicadoEm.toISOString(),
          curtidas: m.curtidas,
          visualizacoes: m.visualizacoes,
          temVideo: Boolean(m.mediaUrl) && (m.tipo === "reels" || m.tipo === "video"),
          permalink: m.permalink,
        })),
      },
    };
  } catch (erro) {
    // A mensagem do ErroMeta já é traduzida para português (sem o texto original da Meta).
    if (erro instanceof ErroMeta) return { ok: false, mensagem: erro.message };
    return tratarErroAcao(erro);
  }
}
