import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WASocket } from "baileys";
import pino from "pino";
import { esperaReconexao } from "./espera.ts";
import { telefoneDoJid, type EventoMotor } from "./tipos.ts";

/**
 * O que fazer quando a conexão fecha.
 * - `loggedOut` (401): o aparelho foi removido no celular.
 * - `connectionReplaced` (440) e `forbidden` (403): sessão aberta em outro lugar ou acesso
 *   recusado; insistir arrisca bloqueio, então o motor para.
 * - O resto: reconecta com espera crescente.
 */
export function motivoDoFechamento(
  statusCode: number | undefined,
): "removido_no_celular" | "parar" | "reconectar" {
  if (statusCode === DisconnectReason.loggedOut) return "removido_no_celular";
  if (statusCode === DisconnectReason.connectionReplaced) return "parar";
  if (statusCode === DisconnectReason.forbidden) return "parar";
  return "reconectar";
}

/** Texto curto para a tela quando o motor para de reconectar. */
function detalheDaParada(statusCode: number | undefined): string {
  return statusCode === DisconnectReason.connectionReplaced
    ? "Sessão aberta em outro lugar."
    : "Acesso recusado pelo WhatsApp.";
}

/** Status do erro da Baileys (Boom: `output.statusCode`), sem depender do pacote @hapi/boom. */
function statusDoErro(erro: unknown): number | undefined {
  const status = (erro as { output?: { statusCode?: unknown } } | undefined)?.output?.statusCode;
  return typeof status === "number" ? status : undefined;
}

/** O id da vaga vira nome de pasta: só letras, números, _ e -. */
const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Estado de uma vaga. O mesmo objeto vale da primeira conexão até a vaga sair do mapa
 * (desconectar, removido no celular, parada); reconexões reaproveitam o objeto.
 */
type Vaga = {
  sock: WASocket | null;
  /** Abrindo a conexão (lendo a sessão do disco): ninguém abre outra enquanto isso. */
  abrindo: boolean;
  aberta: boolean;
  tentativa: number;
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
    const atual = this.vagas.get(numeroId);
    if (atual && (atual.sock || atual.abrindo)) {
      // Já existe conexão (ou uma abrindo) para essa vaga: não abre outra.
      if (atual.aberta && atual.sock) this.avisarConectado(numeroId, atual.sock);
      return;
    }
    const vaga = atual ?? { sock: null, abrindo: false, aberta: false, tentativa: 0, religar: null };
    if (vaga.religar) {
      clearTimeout(vaga.religar);
      vaga.religar = null;
    }
    this.vagas.set(numeroId, vaga);
    await this.abrir(numeroId, vaga);
  }

  async desconectar(numeroId: string): Promise<void> {
    this.validar(numeroId);
    const vaga = this.vagas.get(numeroId);
    // Sai do mapa antes do logout: o fechamento que vem depois não é tratado como queda,
    // e uma abertura em andamento desiste ao ver que a vaga não é mais a atual.
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

  /** A vaga ainda é a atual do mapa (não foi desconectada nem substituída). */
  private vigente(numeroId: string, vaga: Vaga): boolean {
    return this.vagas.get(numeroId) === vaga;
  }

  private async abrir(numeroId: string, vaga: Vaga): Promise<void> {
    vaga.abrindo = true;
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.pasta(numeroId));
      if (!this.vigente(numeroId, vaga)) {
        // Desconectada enquanto lia o disco: não abre nada e não deixa pasta para trás.
        if (!this.vagas.has(numeroId)) await this.apagarSessao(numeroId);
        return;
      }
      vaga.sock?.end(undefined);
      const sock = makeWASocket({
        auth: state,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        logger: this.logger,
      });
      vaga.sock = sock;
      vaga.aberta = false;
      console.info(`[conexoes] ${numeroId}: conectando`);

      // Eventos de um socket que já foi substituído ou encerrado não contam.
      const atual = () => this.vigente(numeroId, vaga) && vaga.sock === sock;
      // Se esta tentativa chegou a mostrar QR: sem QR, a queda é falha ao abrir, não QR não lido.
      let qrEmitido = false;

      sock.ev.on("creds.update", () => {
        if (!atual()) return;
        saveCreds().catch((erro: unknown) =>
          console.error(`[conexoes] ${numeroId}: falha ao salvar sessão (${nomeDoErro(erro)})`),
        );
      });
      sock.ev.on("connection.update", (u) => {
        if (!atual()) return;
        if (u.qr) {
          qrEmitido = true;
          this.opcoes.aoEvento({ tipo: "qr", numeroId, qr: u.qr });
          console.info(`[conexoes] ${numeroId}: QR novo`);
        }
        if (u.connection === "open") {
          vaga.aberta = true;
          vaga.tentativa = 0;
          this.avisarConectado(numeroId, sock);
        }
        if (u.connection === "close") {
          const status = statusDoErro(u.lastDisconnect?.error);
          this.aoFechar(numeroId, vaga, status, Boolean(state.creds.me), qrEmitido).catch((erro: unknown) =>
            console.error(`[conexoes] ${numeroId}: falha ao tratar queda (${nomeDoErro(erro)})`),
          );
        }
      });
    } finally {
      vaga.abrindo = false;
    }
  }

  private async aoFechar(
    numeroId: string,
    vaga: Vaga,
    status: number | undefined,
    pareada: boolean,
    qrEmitido: boolean,
  ): Promise<void> {
    vaga.sock = null;
    vaga.aberta = false;
    const motivo = motivoDoFechamento(status);

    if (motivo === "removido_no_celular") {
      this.vagas.delete(numeroId);
      await this.apagarSessao(numeroId);
      this.opcoes.aoEvento({ tipo: "desconectado", numeroId, motivo: "removido_no_celular" });
      console.warn(`[conexoes] ${numeroId}: aparelho removido no celular; sessão apagada`);
      return;
    }

    if (motivo === "parar") {
      // Guarda a sessão: o usuário decide na tela se conecta de novo.
      this.vagas.delete(numeroId);
      this.opcoes.aoEvento({
        tipo: "desconectado",
        numeroId,
        motivo: "erro",
        detalhe: detalheDaParada(status),
      });
      console.warn(`[conexoes] ${numeroId}: conexão encerrada (status ${status}); sem reconexão`);
      return;
    }

    // Logo depois de ler o QR, a Baileys pede para reiniciar (515): reconecta na hora.
    if (status === DisconnectReason.restartRequired) {
      await this.reabrir(numeroId, vaga);
      return;
    }

    // Vaga sem pareamento não reconecta sozinha: não fica gerando QR sem fim.
    if (!pareada) {
      this.vagas.delete(numeroId);
      if (!qrEmitido) {
        // Caiu antes de qualquer QR (405, rede, tempo esgotado): sem aviso a tela ficaria
        // esperando um QR que não vem.
        this.opcoes.aoEvento({
          tipo: "desconectado",
          numeroId,
          motivo: "erro",
          detalhe: `Não foi possível abrir a conexão (status ${status ?? "?"}).`,
        });
      }
      await this.apagarSessao(numeroId);
      // QR mostrado e não lido: a tela mostra "O QR expirou" e o usuário clica em Conectar de novo.
      console.info(
        qrEmitido
          ? `[conexoes] ${numeroId}: QR não lido (status ${status ?? "?"}); aguardando novo pedido de conexão`
          : `[conexoes] ${numeroId}: conexão não abriu (status ${status ?? "?"}); aguardando novo pedido de conexão`,
      );
      return;
    }

    console.warn(`[conexoes] ${numeroId}: conexão caiu (status ${status ?? "?"})`);
    this.agendarReconexao(numeroId, vaga);
  }

  /** Nova tentativa depois da espera crescente (2 s, 4 s, 8 s… até 5 min). */
  private agendarReconexao(numeroId: string, vaga: Vaga): void {
    const espera = esperaReconexao(vaga.tentativa);
    vaga.tentativa += 1;
    console.info(`[conexoes] ${numeroId}: nova tentativa em ${espera / 1000} s`);
    vaga.religar = setTimeout(() => {
      vaga.religar = null;
      if (!this.vigente(numeroId, vaga) || vaga.sock || vaga.abrindo) return;
      void this.reabrir(numeroId, vaga);
    }, espera);
  }

  /** Reabre a conexão; se falhar, agenda outra tentativa em vez de deixar a vaga parada. */
  private async reabrir(numeroId: string, vaga: Vaga): Promise<void> {
    try {
      await this.abrir(numeroId, vaga);
    } catch (erro) {
      console.error(`[conexoes] ${numeroId}: falha ao reabrir (${nomeDoErro(erro)})`);
      if (this.vigente(numeroId, vaga) && !vaga.sock) this.agendarReconexao(numeroId, vaga);
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
