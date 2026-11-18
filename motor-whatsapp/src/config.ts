/**
 * Configuração do motor, lida do ambiente (e do arquivo .env, se existir).
 * Falta de SISTEMA_URL ou MOTOR_WHATSAPP_SEGREDO encerra o motor com mensagem clara.
 * O segredo nunca é impresso.
 */
import path from "node:path";
import { resolverPastaSessoes } from "./trava.ts";

try {
  process.loadEnvFile();
} catch {
  // Sem .env: segue só com as variáveis do ambiente.
}

function encerrar(mensagem: string): never {
  console.error(`[config] ${mensagem}`);
  process.exit(1);
}

function lerSistemaUrl(): string {
  const bruta = process.env.SISTEMA_URL?.trim();
  if (!bruta) encerrar("Falta SISTEMA_URL no .env (ex.: https://teste.plataformaipemaster.com.br).");
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    encerrar("SISTEMA_URL não é um endereço válido.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    encerrar("SISTEMA_URL precisa começar com https:// (http:// só para localhost).");
  }
  return url.origin;
}

function lerSegredo(): string {
  const segredo = process.env.MOTOR_WHATSAPP_SEGREDO?.trim();
  if (!segredo) encerrar("Falta MOTOR_WHATSAPP_SEGREDO no .env (o mesmo configurado no sistema).");
  return segredo;
}

export const config: { sistemaUrl: string; segredo: string; pastaSessoes: string; nivelLogBaileys: string } = {
  sistemaUrl: lerSistemaUrl(),
  segredo: lerSegredo(),
  // Absoluta: não muda se o motor for iniciado de outra pasta.
  pastaSessoes: resolverPastaSessoes(process.env.PASTA_SESSOES, path.resolve(import.meta.dirname, "..")),
  // "silent" por padrão: a Baileys pode imprimir JIDs (telefones) nos logs.
  nivelLogBaileys: process.env.NIVEL_LOG_BAILEYS?.trim() || "silent",
};
