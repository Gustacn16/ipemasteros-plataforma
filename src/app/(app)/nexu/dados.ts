import "server-only";
import { iaConfigurada } from "@/lib/ia/cliente";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { situacaoLimites } from "@/lib/ia/uso";
import { temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { listarConversas } from "@/modulos/nexu/servicos/conversas";

/** Dados comuns às duas páginas: lista de conversas, configuração e contador do dia. */
export async function dadosDaTelaNexu(ator: UsuarioAtual) {
  const [conversas, config, limites] = await Promise.all([listarConversas(ator), obterConfiguracaoIa(), situacaoLimites(ator.id)]);
  const perguntasPorDia = config.perguntasPorDia;
  return {
    conversas: conversas.map((c) => ({ id: c.id, titulo: c.titulo, atualizadoEm: c.atualizadoEm.toISOString() })),
    configurado: iaConfigurada(),
    motivo: temPermissao(ator.papel, "nexu:configurar") ? "Falta a chave ANTHROPIC_API_KEY no hPanel." : undefined,
    perguntasPorDia,
    usadasHoje: limites.ok ? perguntasPorDia - limites.restantesHoje : limites.motivo === "dia" ? perguntasPorDia : null,
  };
}
