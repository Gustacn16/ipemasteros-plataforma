"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventoNexu } from "../tipos";
import { aplicarEvento, estadoInicial, iniciarPergunta, lerEventosSse, type EstadoConversa, type MensagemTela } from "./estado-conversa";

const MSG_INDISPONIVEL = "O Nexu está indisponível agora, tente de novo em instantes.";

export function useConversaNexu(conversaIdInicial: string | null, mensagensIniciais: MensagemTela[] = []) {
  const [estado, setEstado] = useState<EstadoConversa>(() => estadoInicial(conversaIdInicial, mensagensIniciais));
  const conversaIdRef = useRef<string | null>(conversaIdInicial);
  const abortRef = useRef<AbortController | null>(null);
  const contador = useRef(0);

  useEffect(() => () => abortRef.current?.abort(), []);

  const aplicar = useCallback((evento: EventoNexu) => {
    if (evento.tipo === "conversa") conversaIdRef.current = evento.conversaId;
    setEstado((e) => aplicarEvento(e, evento));
  }, []);

  const enviar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || abortRef.current) return;
      const controle = new AbortController();
      abortRef.current = controle;
      contador.current += 1;
      setEstado((e) => iniciarPergunta(e, pergunta, `u-${contador.current}`, `a-${contador.current}`));
      try {
        const resposta = await fetch("/api/nexu/mensagens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversaId: conversaIdRef.current, pergunta, tela: window.location.pathname }),
          signal: controle.signal,
        });
        if (!resposta.ok || !resposta.body) {
          const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string; erro?: string } | null;
          aplicar({ tipo: "erro", mensagem: corpo?.mensagem ?? corpo?.erro ?? MSG_INDISPONIVEL });
          return;
        }
        const leitor = resposta.body.getReader();
        const decodificador = new TextDecoder();
        let buffer = "";
        let terminou = false;
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          buffer += decodificador.decode(value, { stream: true });
          const { eventos, resto } = lerEventosSse(buffer);
          buffer = resto;
          for (const evento of eventos) {
            if (evento.tipo === "fim" || evento.tipo === "erro") terminou = true;
            aplicar(evento);
          }
        }
        if (!terminou) aplicar({ tipo: "erro", mensagem: MSG_INDISPONIVEL });
      } catch (erro) {
        if (!(erro instanceof DOMException && erro.name === "AbortError")) aplicar({ tipo: "erro", mensagem: MSG_INDISPONIVEL });
      } finally {
        if (abortRef.current === controle) abortRef.current = null;
      }
    },
    [aplicar],
  );

  const nova = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversaIdRef.current = null;
    setEstado((e) => ({ ...estadoInicial(), restantesHoje: e.restantesHoje }));
  }, []);

  return {
    mensagens: estado.mensagens,
    enviando: estado.enviando,
    consultando: estado.consultando,
    propostas: estado.propostas,
    restantesHoje: estado.restantesHoje,
    conversaId: estado.conversaId,
    erro: estado.erro,
    enviar,
    nova,
  };
}

export type ConversaNexu = ReturnType<typeof useConversaNexu>;
