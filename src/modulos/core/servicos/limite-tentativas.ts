import "server-only";
import { getIP } from "better-auth/api";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroNegocio } from "@/lib/erros";
import {
  chaveBetterAuthNormalizada,
  chaveLimite,
  criarLimitador,
  type RegraLimite,
  type RepositorioLimite,
} from "../regras/limite-tentativas";
import { mensagemMuitasTentativas } from "../regras/mensagem-limite";

/**
 * Cabeçalhos de onde sai o IP do visitante. Na Hostinger o proxy (hcdn) define
 * esses cabeçalhos: em 2026-11-12, inventar X-Forwarded-For ou X-Real-IP numa
 * requisição para teste.plataformaipemaster.com.br não escapou do limite. Com
 * mais de um IP no X-Forwarded-For o Better Auth não confia nele e passa ao próximo.
 */
export const CABECALHOS_IP = ["x-forwarded-for", "x-real-ip"];

const repositorioPrisma: RepositorioLimite = {
  async incrementarSeAtivo(chave, desde) {
    const { count } = await prisma.limiteTentativa.updateMany({
      where: { chave, inicio: { gt: desde } },
      data: { contagem: { increment: 1 } },
    });
    if (count === 0) return null;
    return prisma.limiteTentativa.findUnique({ where: { chave }, select: { contagem: true, inicio: true } });
  },
  async reiniciarSeVencido(chave, desde, agora) {
    try {
      const { count } = await prisma.limiteTentativa.updateMany({
        where: { chave, inicio: { lte: desde } },
        data: { contagem: 1, inicio: agora },
      });
      return count > 0;
    } catch (erro) {
      // Deadlock raro com a limpeza (que apaga a mesma faixa): o limitador tenta de novo.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2034") return false;
      throw erro;
    }
  },
  async criar(chave, agora) {
    try {
      await prisma.limiteTentativa.create({ data: { chave, contagem: 1, inicio: agora } });
      return true;
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") return false;
      throw erro;
    }
  },
  async limparVencidos(antesDe) {
    await prisma.limiteTentativa.deleteMany({ where: { inicio: { lt: antesDe } } });
  },
  async apagar(chave) {
    await prisma.limiteTentativa.deleteMany({ where: { chave } });
  },
};

export const limitador = criarLimitador(repositorioPrisma);

/** Formato que o Better Auth espera em `rateLimit.customStorage` (janela em segundos). */
export const armazenamentoBetterAuth = {
  async consume(key: string, rule: { window: number; max: number }) {
    const chave = chaveLimite("better-auth", chaveBetterAuthNormalizada(key));
    const r = await limitador.consumir(chave, { janelaSeg: rule.window, max: rule.max });
    return { allowed: r.permitido, retryAfter: r.permitido ? null : r.esperarSeg };
  },
};

/** IP do visitante com as mesmas regras do Better Auth; "sem-ip" se não der para saber. */
export function ipDaRequisicao(cabecalhos: Headers): string {
  return getIP(cabecalhos, { advanced: { ipAddress: { ipAddressHeaders: CABECALHOS_IP } } }) ?? "sem-ip";
}

/** Para Server Actions: lança ErroNegocio com a mensagem de espera quando passa do limite. */
export async function exigirDentroDoLimite(escopo: string, cabecalhos: Headers, regra: RegraLimite) {
  const r = await limitador.consumir(chaveLimite(escopo, ipDaRequisicao(cabecalhos)), regra);
  if (!r.permitido) throw new ErroNegocio(mensagemMuitasTentativas(r.esperarSeg));
}
