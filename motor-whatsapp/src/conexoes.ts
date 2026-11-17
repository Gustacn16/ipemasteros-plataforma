import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WASocket } from "baileys";
import pino from "pino";
import { esperaReconexao } from "./espera.ts";
import { telefoneDoJid, type EventoMotor } from "./tipos.ts";

/** O que fazer quando a conexão fecha. `loggedOut` = o aparelho foi removido no celular. */
export function motivoDoFechamento(
  statusCode: number | undefined,
): "removido_no_celular" | "reconectar" {
  return statusCode === DisconnectReason.loggedOut ? "removido_no_celular" : "reconectar";
}

/** Status do erro da Baileys (Boom: `output.statusCode`), sem depender do pacote @hapi/boom. */
function statusDoErro(erro: unknown): number | undefined {
  const status = (erro as { output?: { statusCode?: unknown } } | undefined)?.output?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/** O id da vaga vira nome de pasta: só letras, números, _ e -. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

type Vaga = {
  sock: WASocket | null;
  tentativa: number;
  aberta: boolean;
  religar: ReturnType<typeof setTimeout> | null;
};

type Opcoes = { pastaSessoes: string; aoEvento: (e: EventoMotor) => void };

/**
 * Uma conexão da Baileys por vaga, com a sessão salva em `pastaSessoes/<numeroId>`.
 * Logs só citam numeroId e estados; nunca QR, telefone ou segredo.
 */
export class Conexoes {
  private readonly vagas = new Map<string, Vaga>();
  private readonly logger = pino({ level: "warn" });

  constructor(private readonly opcoes: Opcoes) {}

  async conectar(numeroId: string): Promise<void> {
    this.validar(numeroId);
    const vaga = this.vagas.get(numeroId);
    if (vaga?.sock) {
      // Já existe conexão para essa vaga: não abre outra. Se está aberta, reafirma ao sistema.
      if (vaga.aberta) this.avisarConectado(numeroId, vaga.sock);
      return;
    }
    if (vaga?.religar) clearTimeout(vaga.religar);
    await this.abrir(numeroId, vaga?.tentativa ?? 0);
  }

  async desconectar(numeroId: string): Promise<void> {
    this.validar(numeroId);
    const vaga = this.vagas.get(numeroId);
    // Sai do mapa antes do logout: o fechamento que vem depois não é tratado como queda.
    this.vagas.delete(numeroId);
    if (vaga?.religar) clearTimeout(vaga.religar);
    if (vaga?.sock) {
      try {
        await vaga.sock.logout();
      } catch {
        // Conexão não estava aberta: só encerra.
        vaga.sock.end(undefined);
      }
    }
    await this.apagarSessao(numeroId);
    this.opcoes.aoEvento({ tipo: "desconectado", numeroId, motivo: "pedido" });
    console.info(`[conexoes] ${numeroId}: desconectado a pedido`);
  }

  conectados(): string[] {
    return [...this.vagas].filter(([, v]) => v.aberta).map(([id]) => id);
  }

  /** Ao iniciar, reconecta toda sessão salva no disco. */
  async retomarSalvas(): Promise<void> {
    await mkdir(this.opcoes.pastaSessoes, { recursive: true });
    const itens = await readdir(this.opcoes.pastaSessoes, { withFileTypes: true });
    for (const item of itens) {
      if (!item.isDirectory() || !ID_VALIDO.test(item.name)) continue;
      try {
        await this.conectar(item.name);
      } catch (erro) {
        console.error(`[conexoes] ${item.name}: falha ao retomar (${nomeDoErro(erro)})`);
      }
    }
  }

  private validar(numeroId: string): void {
    if (!ID_VALIDO.test(numeroId)) throw new Error("numeroId inválido");
  }

  private pasta(numeroId: string): string {
    return path.join(this.opcoes.pastaSessoes, numeroId);
  }

  private async apagarSessao(numeroId: string): Promise<void> {
    await rm(this.pasta(numeroId), { recursive: true, force: true });
  }

  private async abrir(numeroId: string, tentativa: number): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.pasta(numeroId));
    const sock = makeWASocket({
      auth: state,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger: this.logger,
    });
    const vaga: Vaga = { sock, tentativa, aberta: false, religar: null };
    this.vagas.set(numeroId, vaga);
    console.info(`[conexoes] ${numeroId}: conectando`);

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (u) => {
      // Eventos de uma conexão que já foi substituída ou encerrada não contam.
      if (this.vagas.get(numeroId)?.sock !== sock) return;

      if (u.qr) {
        this.opcoes.aoEvento({ tipo: "qr", numeroId, qr: u.qr });
        console.info(`[conexoes] ${numeroId}: QR novo`);
      }
      if (u.connection === "open") {
        vaga.aberta = true;
        vaga.tentativa = 0;
        this.avisarConectado(numeroId, sock);
      }
      if (u.connection === "close") {
        void this.aoFechar(numeroId, vaga, statusDoErro(u.lastDisconnect?.error), Boolean(state.creds.me));
      }
    });
  }

  private async aoFechar(
    numeroId: string,
    vaga: Vaga,
    status: number | undefined,
    pareada: boolean,
  ): Promise<void> {
    vaga.sock = null;
    vaga.aberta = false;

    if (motivoDoFechamento(status) === "removido_no_celular") {
      this.vagas.delete(numeroId);
      await this.apagarSessao(numeroId);
      this.opcoes.aoEvento({ tipo: "desconectado", numeroId, motivo: "removido_no_celular" });
      console.warn(`[conexoes] ${numeroId}: aparelho removido no celular; sessão apagada`);
      return;
    }

    // Logo depois de ler o QR, a Baileys pede para reiniciar (515): reconecta na hora.
    if (status === DisconnectReason.restartRequired) {
      await this.abrirSemFalhar(numeroId, 0);
      return;
    }

    // QR nunca lido e as tentativas de QR acabaram: não fica gerando QR sem fim.
    // A tela mostra "O QR expirou" e o usuário clica em Conectar de novo.
    if (!pareada) {
      this.vagas.delete(numeroId);
      await this.apagarSessao(numeroId);
      console.info(`[conexoes] ${numeroId}: QR não lido; aguardando novo pedido de conexão`);
      return;
    }

    const espera = esperaReconexao(vaga.tentativa);
    console.warn(
      `[conexoes] ${numeroId}: conexão caiu (status ${status ?? "?"}); nova tentativa em ${espera / 1000} s`,
    );
    vaga.religar = setTimeout(() => {
      vaga.religar = null;
      if (this.vagas.get(numeroId) !== vaga) return;
      void this.abrirSemFalhar(numeroId, vaga.tentativa + 1);
    }, espera);
  }

  private async abrirSemFalhar(numeroId: string, tentativa: number): Promise<void> {
    try {
      await this.abrir(numeroId, tentativa);
    } catch (erro) {
      console.error(`[conexoes] ${numeroId}: falha ao reabrir (${nomeDoErro(erro)})`);
    }
  }

  private avisarConectado(numeroId: string, sock: WASocket): void {
    const telefone = sock.user?.id ? telefoneDoJid(sock.user.id) : null;
    if (telefone) {
      this.opcoes.aoEvento({ tipo: "conectado", numeroId, telefone });
      console.info(`[conexoes] ${numeroId}: conectado`);
    } else {
      this.opcoes.aoEvento({
        tipo: "desconectado",
        numeroId,
        motivo: "erro",
        detalhe: "Conectou, mas o telefone não foi reconhecido.",
      });
      console.error(`[conexoes] ${numeroId}: conectado sem telefone reconhecível`);
    }
  }
}

function nomeDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.name : "erro desconhecido";
}
