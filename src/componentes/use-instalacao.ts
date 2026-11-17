"use client";

import { useCallback, useSyncExternalStore } from "react";
import { comoInstalar, type ComoInstalar } from "@/modulos/core/regras/instalacao";

/** Evento do Chrome/Edge/Android que permite abrir a janela de instalação própria do navegador. */
type EventoInstalacao = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let promptGuardado: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

// Escuta desde o carregamento do módulo: o evento pode chegar antes de o menu montar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptGuardado = e as EventoInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    promptGuardado = null;
    avisar();
  });
}

const CONSULTA_MODO_APP = "(display-mode: standalone)";

function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  const consulta = window.matchMedia(CONSULTA_MODO_APP);
  consulta.addEventListener("change", aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
    consulta.removeEventListener("change", aoMudar);
  };
}

/** Aberto pelo ícone da tela de início (sem a barra do navegador). */
function estaEmModoApp() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia(CONSULTA_MODO_APP).matches;
}

function lerSituacao(): ComoInstalar {
  return comoInstalar({
    userAgent: navigator.userAgent,
    modoApp: estaEmModoApp(),
    toquesMaximos: navigator.maxTouchPoints ?? 0,
    temPromptNativo: promptGuardado !== null,
  });
}

/**
 * Como oferecer a instalação neste aparelho. No servidor (e até montar) devolve
 * "instalado", para não mostrar o atalho por um instante a quem já usa o app.
 */
export function useInstalacao() {
  const situacao = useSyncExternalStore(assinar, lerSituacao, () => "instalado" as const);

  const instalarNativo = useCallback(async () => {
    const evento = promptGuardado;
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice.catch(() => undefined);
    promptGuardado = null;
    avisar();
  }, []);

  return { situacao, instalarNativo };
}

/** Só o "está em modo app", para ajustes de tela (ex.: botão Voltar). */
export function useModoApp() {
  return useSyncExternalStore(assinar, estaEmModoApp, () => false);
}
