import type { EventoNexu, PropostaVisivel } from "../tipos";

export type MensagemTela = { id: string; papel: "usuario" | "assistente"; texto: string };

export type EstadoConversa = {
  conversaId: string | null;
  mensagens: MensagemTela[];
  enviando: boolean;
  /** Rótulo da consulta em andamento ("Consultando turmas…"); null quando não há. */
  consultando: string | null;
  propostas: PropostaVisivel[];
  restantesHoje: number | null;
  /** Mensagem de erro da última pergunta. */
  erro: string | null;
};

export function estadoInicial(conversaId: string | null = null, mensagens: MensagemTela[] = []): EstadoConversa {
  return { conversaId, mensagens, enviando: false, consultando: null, propostas: [], restantesHoje: null, erro: null };
}

/** Começa uma pergunta: acrescenta a mensagem da pessoa e uma resposta vazia, que os eventos vão preenchendo. */
export function iniciarPergunta(estado: EstadoConversa, pergunta: string, idUsuario: string, idResposta: string): EstadoConversa {
  return {
    ...estado,
    enviando: true,
    consultando: null,
    erro: null,
    mensagens: [
      ...estado.mensagens,
      { id: idUsuario, papel: "usuario", texto: pergunta },
      { id: idResposta, papel: "assistente", texto: "" },
    ],
  };
}

/** Aplica um evento do SSE ao estado (função pura, usada pelo hook). */
export function aplicarEvento(estado: EstadoConversa, evento: EventoNexu): EstadoConversa {
  switch (evento.tipo) {
    case "conversa":
      return { ...estado, conversaId: evento.conversaId };
    case "texto": {
      const mensagens = [...estado.mensagens];
      const ultima = mensagens[mensagens.length - 1];
      if (ultima?.papel === "assistente") mensagens[mensagens.length - 1] = { ...ultima, texto: ultima.texto + evento.texto };
      else mensagens.push({ id: `a-${mensagens.length}`, papel: "assistente", texto: evento.texto });
      return { ...estado, mensagens, consultando: null };
    }
    case "consultando":
      return { ...estado, consultando: evento.rotulo };
    case "proposta": {
      const existe = estado.propostas.some((p) => p.id === evento.proposta.id);
      return {
        ...estado,
        propostas: existe
          ? estado.propostas.map((p) => (p.id === evento.proposta.id ? evento.proposta : p))
          : [...estado.propostas, evento.proposta],
      };
    }
    case "fim":
      return { ...estado, enviando: false, consultando: null, restantesHoje: evento.restantesHoje };
    case "erro":
      return { ...estado, enviando: false, consultando: null, erro: evento.mensagem };
  }
}

/** Interpreta o texto cru do SSE: devolve os eventos completos e o resto ainda incompleto. */
export function lerEventosSse(buffer: string): { eventos: EventoNexu[]; resto: string } {
  const partes = buffer.split("\n\n");
  const resto = partes.pop() ?? "";
  const eventos: EventoNexu[] = [];
  for (const parte of partes) {
    const linha = parte.split("\n").find((l) => l.startsWith("data:"));
    if (!linha) continue;
    try {
      eventos.push(JSON.parse(linha.slice(5).trim()) as EventoNexu);
    } catch {
      // linha malformada: ignora
    }
  }
  return { eventos, resto };
}
