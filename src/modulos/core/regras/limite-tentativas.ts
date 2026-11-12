import { createHash } from "node:crypto";

/**
 * Limite de tentativas (contra força bruta) em janela fixa: cada chave tem um
 * contador que começa em `inicio` e vale por `janelaSeg`. A gravação fica no
 * banco (ver servicos/limite-tentativas.ts), para valer entre reinícios e entre
 * instâncias do servidor.
 */

export type RegraLimite = { janelaSeg: number; max: number };
export type RegistroLimite = { contagem: number; inicio: Date };
export type ResultadoLimite = { permitido: boolean; esperarSeg: number };

/** Operações que o banco precisa fazer de forma atômica, cada uma num único comando. */
export interface RepositorioLimite {
  /** Soma 1 se a janela ainda vale (inicio > desde) e devolve o registro; senão null. */
  incrementarSeAtivo(chave: string, desde: Date): Promise<RegistroLimite | null>;
  /** Recomeça em 1 se a janela venceu (inicio <= desde). Devolve se mudou alguma linha. */
  reiniciarSeVencido(chave: string, desde: Date, agora: Date): Promise<boolean>;
  /** Cria a linha com contagem 1. Devolve false se ela já existir. */
  criar(chave: string, agora: Date): Promise<boolean>;
  /** Apaga linhas cuja janela começou antes de `antesDe`. */
  limparVencidos(antesDe: Date): Promise<void>;
  /** Apaga a linha da chave (ex.: depois de um login certo). */
  apagar(chave: string): Promise<void>;
}

const MINUTO = 60;

/** Limites do sistema. Por IP valem para todos os endereços de /api/auth. */
export const LIMITES = {
  /** Login: mesmo IP e mesmo e-mail. */
  loginIpEmail: { janelaSeg: 15 * MINUTO, max: 5 },
  /**
   * Login: mesmo e-mail vindo de qualquer IP (freia ataque espalhado em vários
   * IPs). Janela curta para que, se alguém tentar trancar a conta, ela volte logo.
   */
  loginEmail: { janelaSeg: 15 * MINUTO, max: 30 },
  /** Login: teto por IP, qualquer e-mail (alto para escritório com um IP só). */
  loginIp: { janelaSeg: 15 * MINUTO, max: 50 },
  /** "Esqueci a senha": e-mails de redefinição por IP. */
  pedidoSenha: { janelaSeg: 15 * MINUTO, max: 3 },
  /** "Esqueci a senha": e-mails de redefinição para o mesmo endereço. */
  pedidoSenhaEmail: { janelaSeg: 60 * MINUTO, max: 5 },
  /** Gravar a nova senha com o token do e-mail. */
  redefinirSenha: { janelaSeg: 15 * MINUTO, max: 10 },
  /** Aceitar convite e primeiro acesso (Server Actions), por IP. */
  convite: { janelaSeg: 15 * MINUTO, max: 20 },
  /** Demais endereços do Better Auth, por IP. */
  geral: { janelaSeg: MINUTO, max: 100 },
} satisfies Record<string, RegraLimite>;

/** Maior janela usada no sistema; linhas mais velhas que isso podem ser apagadas. */
export const MAIOR_JANELA_SEG = Math.max(...Object.values(LIMITES).map((r) => r.janelaSeg));

const TENTATIVAS_GRAVACAO = 4;

export function criarLimitador(repo: RepositorioLimite, relogio: () => Date = () => new Date()) {
  return {
    async consumir(chave: string, regra: RegraLimite): Promise<ResultadoLimite> {
      const janelaMs = regra.janelaSeg * 1000;
      for (let i = 0; i < TENTATIVAS_GRAVACAO; i++) {
        const agora = relogio();
        const desde = new Date(agora.getTime() - janelaMs);

        const ativo = await repo.incrementarSeAtivo(chave, desde);
        if (ativo) {
          if (ativo.contagem <= regra.max) return { permitido: true, esperarSeg: 0 };
          const fim = ativo.inicio.getTime() + janelaMs;
          return { permitido: false, esperarSeg: Math.max(1, Math.ceil((fim - agora.getTime()) / 1000)) };
        }

        if (await repo.reiniciarSeVencido(chave, desde, agora)) {
          const limite = new Date(agora.getTime() - Math.max(MAIOR_JANELA_SEG, regra.janelaSeg) * 1000);
          await repo.limparVencidos(limite).catch(() => undefined);
          return { permitido: true, esperarSeg: 0 };
        }

        if (await repo.criar(chave, agora)) return { permitido: true, esperarSeg: 0 };
        // Outra requisição mexeu na linha ao mesmo tempo: tenta de novo.
      }
      // Não deu para gravar: na dúvida, bloqueia.
      return { permitido: false, esperarSeg: regra.janelaSeg };
    },
    async zerar(chave: string): Promise<void> {
      await repo.apagar(chave);
    },
  };
}

/** Endereços do Better Auth que ganham contador próprio; o resto divide um balde. */
const CAMINHOS_CONHECIDOS = new Set([
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
  "/update-user",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
]);

/**
 * A chave do Better Auth é "ip|caminho". Normaliza o caminho para que endereços
 * inventados (ou um token diferente em cada /reset-password/<token>) não criem
 * uma linha nova no banco a cada pedido.
 */
export function chaveBetterAuthNormalizada(chave: string): string {
  // O IP nunca tem "|"; o caminho poderia ter, então corta no primeiro.
  const separador = chave.indexOf("|");
  const ip = chave.slice(0, separador);
  const caminho = chave.slice(separador + 1);
  if (CAMINHOS_CONHECIDOS.has(caminho)) return `${ip}|${caminho}`;
  if (caminho.startsWith("/reset-password/")) return `${ip}|/reset-password/*`;
  return `${ip}|outros`;
}

/**
 * Chave guardada no banco: hash das partes (escopo, IP, e-mail...). Assim a
 * tabela não guarda IP nem e-mail. O e-mail é normalizado (minúsculas, sem espaços).
 */
export function chaveLimite(escopo: string, ...partes: string[]): string {
  const texto = JSON.stringify([escopo, ...partes.map((p) => p.trim().toLowerCase())]);
  return createHash("sha256").update(texto).digest("hex");
}
