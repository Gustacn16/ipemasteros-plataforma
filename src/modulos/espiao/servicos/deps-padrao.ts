import "server-only";
import { baixarVideo, criarClienteGroq } from "../fontes/groq";
import { lerPagina } from "../fontes/pagina";
import type { DepsColeta } from "./coleta";
import { podeGastar, registrarGastoExterno } from "./gastos";
import { escreverAnalise, resumirReels, tituloDaMudanca } from "./ia";
import { clienteBusinessDiscoveryPadrao, igUserIdDaIpemaster } from "./testar-perfil";

/** A transcrição dos Reels fica desligada com ESPIAO_TRANSCRICAO=desligada (resultado do teste da Meta). */
export function transcricaoLigada(): boolean {
  return process.env.ESPIAO_TRANSCRICAO !== "desligada";
}

export function depsPadrao(): DepsColeta {
  return {
    agora: () => new Date(),
    igUserId: igUserIdDaIpemaster,
    businessDiscovery: clienteBusinessDiscoveryPadrao,
    lerPagina: (url) => lerPagina(url),
    groq: () => (process.env.GROQ_API_KEY ? criarClienteGroq(process.env.GROQ_API_KEY) : null),
    baixarVideo: (url) => baixarVideo(url),
    podeGastar: () => podeGastar(),
    resumirReels,
    tituloDaMudanca,
    escreverAnalise,
    registrarGastoExterno,
    transcricaoLigada: transcricaoLigada(),
  };
}
