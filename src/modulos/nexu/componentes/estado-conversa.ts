import type { EventoNexu, PropostaVisivel } from "../tipos";

export type MensagemTela = { id: string; papel: "usuario" | "assistente"; texto: string; propostas?: PropostaVisivel[] };

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
      const nova = evento.proposta;
      const existe = estado.propostas.some((p) => p.id === nova.id);
      const jaNaTela = estado.mensagens.some((m) => m.propostas?.some((p) => p.id === nova.id));
      let mensagens = estado.mensagens;
      if (jaNaTela) {
        mensagens = mensagens.map((m) =>
          m.propostas?.some((p) => p.id === nova.id) ? { ...m, propostas: m.propostas.map((p) => (p.id === nova.id ? nova : p)) } : m,
        );
      } else {
        // Cartão novo: fica na resposta do Nexu que está sendo escrita, depois do texto.
        const i = mensagens.map((m) => m.papel).lastIndexOf("assistente");
        if (i >= 0) mensagens = mensagens.map((m, j) => (j === i ? { ...m, propostas: [...(m.propostas ?? []), nova] } : m));
      }
      return {
        ...estado,
        mensagens,
        propostas: existe ? estado.propostas.map((p) => (p.id === nova.id ? nova : p)) : [...estado.propostas, nova],
      };
    }
    case "fim":
      return { ...estado, enviando: false, consultando: null, restantesHoje: evento.restantesHoje };
    case "erro":
      return { ...estado, enviando: false, consultando: null, erro: evento.mensagem };
  }
}

/** Atualização local de um cartão (depois de Confirmar/Recusar): mesma regra de upsert por id. */
export function atualizarProposta(estado: EstadoConversa, proposta: PropostaVisivel): EstadoConversa {
  return aplicarEvento(estado, { tipo: "proposta", proposta });
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
