import type { StatusPropostaNexu, TipoPropostaNexu } from "@/generated/prisma/client";

/** O que a tela mostra de uma proposta (cartão com Confirmar/Recusar). */
export type PropostaVisivel = {
  id: string;
  tipo: TipoPropostaNexu;
  resumo: string;
  status: StatusPropostaNexu;
  erro: string | null;
  resultadoUrl: string | null;
};

/** Eventos que o loop da pergunta emite para a tela (via SSE). */
export type EventoNexu =
  | { tipo: "conversa"; conversaId: string }
  | { tipo: "texto"; texto: string }
  | { tipo: "consultando"; rotulo: string }
  | { tipo: "proposta"; proposta: PropostaVisivel }
  | { tipo: "fim"; restantesHoje: number }
  | { tipo: "erro"; mensagem: string };
