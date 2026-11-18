import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { type ClienteBusinessDiscovery, type PerfilBD, criarClienteBusinessDiscovery } from "../fontes/instagram";

/** Mídias trazidas no teste e na consulta sob demanda. */
export const MIDIAS_DO_TESTE = 12;

/** `idExterno` da primeira conta do Instagram da IPEMaster ativa: o Business Discovery pergunta "como" ela. */
export async function igUserIdDaIpemaster(): Promise<string> {
  const conta = await prisma.contaInstagram.findFirst({ where: { ativa: true }, orderBy: { usuario: "asc" }, select: { idExterno: true } });
  if (!conta) throw new ErroNegocio("Nenhuma conta do Instagram da IPEMaster ligada. Veja Conteúdo → Integração Instagram.");
  return conta.idExterno;
}

/** Cliente do Business Discovery com a chave da Meta; sem chave, erro legível. */
export function clienteBusinessDiscoveryPadrao(): ClienteBusinessDiscovery {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new ErroNegocio("Falta colocar a chave META_ACCESS_TOKEN na Hostinger.");
  return criarClienteBusinessDiscovery(token);
}

export type CamposDoTeste = { midias: number; visualizacoes: number; curtidas: number; reels: number; mediaUrlReels: number };

type Deps = { cliente?: Pick<ClienteBusinessDiscovery, "perfil">; igUserId?: () => Promise<string> };

/** Tarefa 0 do espião: mostra o que a Meta devolve para um @ (decide se a transcrição dos Reels fica ligada). */
export async function testarPerfil(ator: UsuarioAtual, usuario: string, deps: Deps = {}): Promise<{ perfil: PerfilBD; campos: CamposDoTeste }> {
  if (!temPermissao(ator.papel, "espiao:configurar")) throw new ErroPermissao("espiao:configurar");
  const igUserId = await (deps.igUserId ?? igUserIdDaIpemaster)();
  const perfil = await (deps.cliente ?? clienteBusinessDiscoveryPadrao()).perfil(igUserId, usuario, MIDIAS_DO_TESTE);
  const reels = perfil.midias.filter((m) => m.tipo === "reels");
  return {
    perfil,
    campos: {
      midias: perfil.midias.length,
      visualizacoes: perfil.midias.filter((m) => m.visualizacoes !== null).length,
      curtidas: perfil.midias.filter((m) => m.curtidas !== null).length,
      reels: reels.length,
      mediaUrlReels: reels.filter((m) => m.mediaUrl).length,
    },
  };
}
