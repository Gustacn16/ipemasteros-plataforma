// Decide como oferecer "instalar como aplicativo" (tela de início do celular).
// Sem dependências de servidor: roda no navegador.

export type ComoInstalar = "instalado" | "iphone" | "nativo" | "manual";

type Ambiente = {
  userAgent: string;
  /** Já aberto pelo ícone da tela de início (display-mode: standalone). */
  modoApp: boolean;
  /** navigator.maxTouchPoints: o iPad novo se apresenta como Mac, mas tem toque. */
  toquesMaximos: number;
  /** O navegador disparou `beforeinstallprompt` (Android, Chrome/Edge no computador). */
  temPromptNativo: boolean;
};

export function comoInstalar({ userAgent, modoApp, toquesMaximos, temPromptNativo }: Ambiente): ComoInstalar {
  if (modoApp) return "instalado";
  const ehIos = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && toquesMaximos > 1);
  if (ehIos) return "iphone";
  if (temPromptNativo) return "nativo";
  return "manual";
}
