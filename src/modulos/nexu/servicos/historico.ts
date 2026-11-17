import type { PropostaVisivel } from "../tipos";
import type { MensagemTela } from "../componentes/estado-conversa";
import { ehPerguntaDoUsuario } from "./prompt";

type MensagemGravada = { id: string; papel: "usuario" | "assistente"; conteudo: unknown };

function textosDosBlocos(conteudo: unknown): string {
  if (typeof conteudo === "string") return conteudo;
  if (!Array.isArray(conteudo)) return "";
  return conteudo
    .filter((b): b is { type: "text"; text: string } => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n\n");
}

/**
 * Converte as mensagens gravadas no que a tela mostra: da pessoa, só o texto da pergunta (nunca o bloco
 * <contexto>); do Nexu, só os blocos `text` e os cartões das propostas criadas pelos `tool_use` da mensagem. `tool_result`, mensagens sem texto/cartão e os avisos internos ("[Confirmei a proposta: …]") ficam ocultos.
 */
export type PropostaGravada = PropostaVisivel & { toolUseId: string };

function idsDeToolUse(conteudo: unknown): string[] {
  if (!Array.isArray(conteudo)) return [];
  return conteudo.filter((b) => b?.type === "tool_use" && typeof b.id === "string").map((b) => b.id as string);
}

export function mensagensParaTela(mensagens: MensagemGravada[], propostas: PropostaGravada[] = []): MensagemTela[] {
  const saida: MensagemTela[] = [];
  for (const m of mensagens) {
    if (m.papel === "usuario") {
      if (!ehPerguntaDoUsuario(m.conteudo)) continue;
      const blocos = m.conteudo as { text?: unknown }[];
      const texto = typeof blocos[1]?.text === "string" ? blocos[1].text : "";
      if (texto) saida.push({ id: m.id, papel: "usuario", texto });
    } else {
      const texto = textosDosBlocos(m.conteudo).trim();
      const ids = idsDeToolUse(m.conteudo);
      const dela = propostas
        .filter((p) => ids.includes(p.toolUseId))
        .map(({ id, tipo, resumo, status, erro, resultadoUrl }) => ({ id, tipo, resumo, status, erro, resultadoUrl }));
      if (texto || dela.length) saida.push({ id: m.id, papel: "assistente", texto, ...(dela.length ? { propostas: dela } : {}) });
    }
  }
  return saida;
}
