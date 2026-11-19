import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { MODELOS_IA, type ModeloIa } from "@/lib/ia/precos";
import { prisma } from "@/lib/prisma";
import { REGRAS_PADRAO, esquemaRegrasAtendimento, type RegrasAtendimento } from "../esquemas/regras-atendimento";

export type ConfiguracaoWhatsapp = { modelo: ModeloIa; limiteMensalMicroUsd: number };

const MODELO_PADRAO: ModeloIa = "claude-opus-5-5";
const LIMITE_PADRAO_MICRO_USD = 80_000_000;
const LIMITE_MAXIMO_MICRO_USD = 500_000_000;

/** Configuração da IA do WhatsApp (linha "unica"); sem linha ou com modelo desconhecido, cai nos padrões. */
export async function obterConfiguracaoWhatsapp(): Promise<ConfiguracaoWhatsapp> {
  const linha = await prisma.configuracaoWhatsapp.findUnique({ where: { id: "unica" } });
  if (!linha) return { modelo: MODELO_PADRAO, limiteMensalMicroUsd: LIMITE_PADRAO_MICRO_USD };
  const modelo = (MODELOS_IA as readonly string[]).includes(linha.modelo) ? (linha.modelo as ModeloIa) : MODELO_PADRAO;
  return { modelo, limiteMensalMicroUsd: linha.limiteMensalMicroUsd };
}

/** Grava o limite mensal (o modelo fica no padrão ao criar a linha). A auditoria leva só o valor. */
export async function salvarConfiguracaoWhatsapp(dados: { limiteMensalMicroUsd: number }, atorId: string): Promise<void> {
  const limite = dados.limiteMensalMicroUsd;
  if (!Number.isInteger(limite) || limite < 0 || limite > LIMITE_MAXIMO_MICRO_USD) {
    throw new ErroNegocio("O limite mensal deve ficar entre US$ 0 e US$ 500.");
  }
  await prisma.configuracaoWhatsapp.upsert({
    where: { id: "unica" },
    create: { id: "unica", modelo: MODELO_PADRAO, limiteMensalMicroUsd: limite, atualizadoPorId: atorId },
    update: { limiteMensalMicroUsd: limite, atualizadoPorId: atorId },
  });
  await registrarAuditoria({
    usuarioId: atorId,
    acao: "whatsapp.configuracao_alterada",
    entidade: "ConfiguracaoWhatsapp",
    entidadeId: "unica",
    diff: { limiteMensalMicroUsd: limite },
  });
}

/** Regras do atendimento (horário, SLA, follow-up). Sem linha ou com Json inválido, valem as padrões. */
export async function obterRegrasAtendimento(): Promise<RegrasAtendimento> {
  const linha = await prisma.configuracaoWhatsapp.findUnique({ where: { id: "unica" } });
  const lidas = esquemaRegrasAtendimento.safeParse(linha?.regrasAtendimento);
  return lidas.success ? lidas.data : REGRAS_PADRAO;
}

/** Valida e grava as regras na linha "unica" (criando-a com modelo e limite padrão); audita com as regras no diff. */
export async function salvarRegrasAtendimento(dados: unknown, atorId: string): Promise<void> {
  const lidas = esquemaRegrasAtendimento.safeParse(dados);
  if (!lidas.success) throw new ErroNegocio(lidas.error.issues[0]?.message ?? "Regras do atendimento inválidas.");
  const regras = lidas.data;
  await prisma.configuracaoWhatsapp.upsert({
    where: { id: "unica" },
    create: { id: "unica", modelo: MODELO_PADRAO, limiteMensalMicroUsd: LIMITE_PADRAO_MICRO_USD, regrasAtendimento: regras, atualizadoPorId: atorId },
    update: { regrasAtendimento: regras, atualizadoPorId: atorId },
  });
  await registrarAuditoria({
    usuarioId: atorId,
    acao: "whatsapp.regras_atendimento_alteradas",
    entidade: "ConfiguracaoWhatsapp",
    entidadeId: "unica",
    diff: regras,
  });
}
