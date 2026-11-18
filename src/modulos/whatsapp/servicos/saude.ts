import "server-only";
import { iaConfigurada } from "@/lib/ia/cliente";
import { gastoMesMicroUsd } from "@/lib/ia/uso";
import { prisma } from "@/lib/prisma";
import { obterConfiguracaoWhatsapp } from "./configuracao";
import { MOTOR_SEM_SINAL_MS, ROTULO_ESTADO, estadoNaTela } from "../regras/conexao";

const DIA_MS = 24 * 60 * 60_000;

export type SaudeWhatsapp = {
  ia: { configurada: boolean; gastoMesMicroUsd: number; limiteMensalMicroUsd: number };
  motorVivo: boolean;
  ultimoSinalEm: Date | null;
  numeros: {
    id: string;
    nome: string;
    estado: string;
    ultimoSinalEm: Date | null;
    mensagens24h: number;
    ultimaMensagemEm: Date | null;
  }[];
};

/** Saúde do motor e de cada número: sinal, situação e mensagens capturadas nas últimas 24 h. */
export async function saudeWhatsapp(agora: Date = new Date()): Promise<SaudeWhatsapp> {
  const numeros = await prisma.numeroWhatsapp.findMany({
    where: { excluidoEm: null },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, situacao: true, qrEm: true, ultimoSinalEm: true, erro: true },
  });
  const grupos = await prisma.mensagemWhatsapp.groupBy({
    by: ["numeroId"],
    where: { enviadaEm: { gte: new Date(agora.getTime() - DIA_MS) } },
    _count: { _all: true },
    _max: { enviadaEm: true },
  });
  const porNumero = new Map(grupos.map((g) => [g.numeroId, g]));

  const sinais = numeros.map((n) => n.ultimoSinalEm).filter((d): d is Date => d !== null);
  const ultimoSinalEm = sinais.length ? new Date(Math.max(...sinais.map((d) => d.getTime()))) : null;

  const [gasto, config] = await Promise.all([gastoMesMicroUsd("whatsapp", agora), obterConfiguracaoWhatsapp()]);

  return {
    ia: { configurada: iaConfigurada(), gastoMesMicroUsd: gasto, limiteMensalMicroUsd: config.limiteMensalMicroUsd },
    motorVivo: ultimoSinalEm !== null && agora.getTime() - ultimoSinalEm.getTime() <= MOTOR_SEM_SINAL_MS,
    ultimoSinalEm,
    numeros: numeros.map((n) => {
      const g = porNumero.get(n.id);
      return {
        id: n.id,
        nome: n.nome,
        estado: ROTULO_ESTADO[estadoNaTela(n, agora)],
        ultimoSinalEm: n.ultimoSinalEm,
        mensagens24h: g?._count._all ?? 0,
        ultimaMensagemEm: g?._max.enviadaEm ?? null,
      };
    }),
  };
}
