import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DisconnectReason } from "baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoMotor } from "./tipos.ts";

/** Socket falso da Baileys: guarda os ouvintes e deixa o teste disparar eventos. */
type SocketFalso = {
  ouvintes: Record<string, ((dados: unknown) => void)[]>;
  ev: { on: (nome: string, fn: (dados: unknown) => void) => void };
  user?: { id: string };
  logout: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  emitir: (nome: string, dados: unknown) => void;
};

const baileys = vi.hoisted(() => {
  const sockets: SocketFalso[] = [];
  return {
    sockets,
    creds: { me: undefined as undefined | { id: string } },
    useMultiFileAuthState: vi.fn(),
    makeWASocket: vi.fn(() => {
      const ouvintes: SocketFalso["ouvintes"] = {};
      const sock: SocketFalso = {
        ouvintes,
        ev: { on: (nome, fn) => (ouvintes[nome] ??= []).push(fn) },
        logout: vi.fn(async () => {}),
        end: vi.fn(),
        emitir: (nome, dados) => ouvintes[nome]?.forEach((fn) => fn(dados)),
      };
      sockets.push(sock);
      return sock;
    }),
  };
});

vi.mock("baileys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("baileys")>()),
  default: baileys.makeWASocket,
  useMultiFileAuthState: baileys.useMultiFileAuthState,
}));

const { Conexoes, motivoDoFechamento } = await import("./conexoes.ts");

function estadoSalvo() {
  return { state: { creds: baileys.creds, keys: {} }, saveCreds: vi.fn(async () => {}) };
}

/** Promessa que o teste resolve na hora que quiser (simula o disco lento). */
function adiada<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

function fechar(sock: SocketFalso, statusCode: number) {
  sock.emitir("connection.update", {
    connection: "close",
    lastDisconnect: { error: { output: { statusCode } }, date: new Date() },
  });
}

describe("motivoDoFechamento", () => {
  it("aparelho removido no celular apaga a sessão", () => {
    expect(motivoDoFechamento(DisconnectReason.loggedOut)).toBe("removido_no_celular");
  });

  it("queda comum reconecta", () => {
    expect(motivoDoFechamento(DisconnectReason.connectionClosed)).toBe("reconectar");
  });

  it("sem código também reconecta", () => {
    expect(motivoDoFechamento(undefined)).toBe("reconectar");
  });

  it("sessão aberta em outro lugar ou acesso recusado: para de reconectar", () => {
    expect(motivoDoFechamento(DisconnectReason.connectionReplaced)).toBe("parar");
    expect(motivoDoFechamento(DisconnectReason.forbidden)).toBe("parar");
  });
});

describe("Conexoes", () => {
  let pasta: string;
  let eventos: EventoMotor[];
  let conexoes: InstanceType<typeof Conexoes>;

  beforeEach(async () => {
    pasta = await mkdtemp(path.join(tmpdir(), "motor-teste-"));
    eventos = [];
    baileys.sockets.length = 0;
    baileys.creds.me = { id: "5511999990000:1@s.whatsapp.net" };
    baileys.makeWASocket.mockClear();
    baileys.useMultiFileAuthState.mockReset();
    baileys.useMultiFileAuthState.mockImplementation(async () => estadoSalvo());
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    conexoes = new Conexoes({ pastaSessoes: pasta, aoEvento: (e) => eventos.push(e) });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(pasta, { recursive: true, force: true });
  });

  it("dois pedidos de conectar ao mesmo tempo abrem um socket só", async () => {
    const disco = adiada<ReturnType<typeof estadoSalvo>>();
    baileys.useMultiFileAuthState.mockReturnValueOnce(disco.promessa);
    const primeiro = conexoes.conectar("vaga1");
    await conexoes.conectar("vaga1");
    disco.resolver(estadoSalvo());
    await primeiro;
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
  });

  it("conectar durante uma reconexão em andamento não abre outro socket", async () => {
    vi.useFakeTimers();
    await conexoes.conectar("vaga1");
    fechar(baileys.sockets[0], DisconnectReason.connectionClosed);
    const disco = adiada<ReturnType<typeof estadoSalvo>>();
    baileys.useMultiFileAuthState.mockReturnValueOnce(disco.promessa);
    await vi.advanceTimersByTimeAsync(2000); // começa a reabrir e fica esperando o disco
    await conexoes.conectar("vaga1");
    disco.resolver(estadoSalvo());
    await vi.advanceTimersByTimeAsync(0);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(2);
  });

  it("desconectar enquanto abre não deixa socket aberto", async () => {
    const disco = adiada<ReturnType<typeof estadoSalvo>>();
    baileys.useMultiFileAuthState.mockReturnValueOnce(disco.promessa);
    const abrindo = conexoes.conectar("vaga1");
    await conexoes.desconectar("vaga1");
    disco.resolver(estadoSalvo());
    await abrindo;
    expect(baileys.makeWASocket).not.toHaveBeenCalled();
    expect(conexoes.conectados()).toEqual([]);
    expect(eventos).toEqual([{ tipo: "desconectado", numeroId: "vaga1", motivo: "pedido" }]);
  });

  it("socket antigo não salva credenciais depois de desconectado", async () => {
    const salvo = estadoSalvo();
    baileys.useMultiFileAuthState.mockResolvedValueOnce(salvo);
    await conexoes.conectar("vaga1");
    await conexoes.desconectar("vaga1");
    baileys.sockets[0].emitir("creds.update", {});
    expect(salvo.saveCreds).not.toHaveBeenCalled();
  });

  it("sessão aberta em outro lugar: avisa erro, guarda a sessão e não reconecta", async () => {
    vi.useFakeTimers();
    await mkdir(path.join(pasta, "vaga1"));
    await conexoes.conectar("vaga1");
    fechar(baileys.sockets[0], DisconnectReason.connectionReplaced);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    expect(eventos).toEqual([
      { tipo: "desconectado", numeroId: "vaga1", motivo: "erro", detalhe: "Sessão aberta em outro lugar." },
    ]);
    expect(existsSync(path.join(pasta, "vaga1"))).toBe(true);
  });

  it("acesso recusado pelo WhatsApp: avisa erro e não reconecta", async () => {
    vi.useFakeTimers();
    await conexoes.conectar("vaga1");
    fechar(baileys.sockets[0], DisconnectReason.forbidden);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    expect(eventos).toEqual([
      { tipo: "desconectado", numeroId: "vaga1", motivo: "erro", detalhe: "Acesso recusado pelo WhatsApp." },
    ]);
  });

  it("vaga sem pareamento que fecha antes de qualquer QR avisa erro com o status", async () => {
    vi.useFakeTimers();
    baileys.creds.me = undefined;
    await conexoes.conectar("vaga1");
    fechar(baileys.sockets[0], 405);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    expect(eventos).toEqual([
      { tipo: "desconectado", numeroId: "vaga1", motivo: "erro", detalhe: "Não foi possível abrir a conexão (status 405)." },
    ]);
    expect(conexoes.conectados()).toEqual([]);
  });

  it("vaga sem pareamento que fecha depois do QR não lido só para, sem evento de erro", async () => {
    vi.useFakeTimers();
    baileys.creds.me = undefined;
    await conexoes.conectar("vaga1");
    baileys.sockets[0].emitir("connection.update", { qr: "QR1" });
    fechar(baileys.sockets[0], DisconnectReason.timedOut);
    // O aviso sai depois de apagar a pasta (disco de verdade), então espera por ele.
    await vi.waitFor(() =>
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining(`status ${DisconnectReason.timedOut}`)),
    );
    await vi.advanceTimersByTimeAsync(300_000);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    expect(eventos).toEqual([{ tipo: "qr", numeroId: "vaga1", qr: "QR1" }]);
  });

  it("se reabrir falha, agenda nova tentativa com espera maior", async () => {
    vi.useFakeTimers();
    await conexoes.conectar("vaga1");
    fechar(baileys.sockets[0], DisconnectReason.connectionClosed);
    baileys.useMultiFileAuthState.mockRejectedValueOnce(new Error("disco"));
    await vi.advanceTimersByTimeAsync(2000); // 1ª tentativa falha
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3999);
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // 2ª tentativa, 4 s depois
    expect(baileys.makeWASocket).toHaveBeenCalledTimes(2);
  });
});
