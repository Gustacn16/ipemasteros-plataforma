import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DisconnectReason, proto } from "baileys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoMotor } from "./tipos.ts";

/** Socket falso da Baileys: guarda os ouvintes e deixa o teste disparar eventos. */
type SocketFalso = {
  ouvintes: Record<string, ((dados: unknown) => void)[]>;
  ev: { on: (nome: string, fn: (dados: unknown) => void) => void };
  user?: { id: string };
  logout: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  groupFetchAllParticipating: ReturnType<typeof vi.fn>;
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
        groupFetchAllParticipating: vi.fn(async () => ({})),
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

  it("aceita o histórico recente do pareamento, mas não o histórico completo", async () => {
    await conexoes.conectar("vaga1");
    const config = (baileys.makeWASocket.mock.calls[0] as unknown[])[0] as {
      shouldSyncHistoryMessage?: (msg: { syncType?: number }) => boolean;
    };
    const tipos = proto.Message.HistorySyncNotification.HistorySyncType;
    expect(config.shouldSyncHistoryMessage?.({ syncType: tipos.INITIAL_BOOTSTRAP })).toBe(true);
    expect(config.shouldSyncHistoryMessage?.({ syncType: tipos.RECENT })).toBe(true);
    expect(config.shouldSyncHistoryMessage?.({ syncType: tipos.FULL })).toBe(false);
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

  it("histórico com 150 mensagens gera conversas e 2 eventos de mensagens do histórico", async () => {
    await conexoes.conectar("vaga1");
    const mensagens = Array.from({ length: 150 }, (_, i) => mensagemFalsa(`M${i}`));
    baileys.sockets[0].emitir("messaging-history.set", {
      chats: [{ id: "5562981707432@s.whatsapp.net", name: "Fulano" }, { id: "status@broadcast" }],
      contacts: [],
      messages: [...mensagens, { ...mensagemFalsa("S1"), key: { remoteJid: "status@broadcast", id: "S1" } }],
    });
    expect(eventos).toEqual([
      {
        tipo: "conversas",
        numeroId: "vaga1",
        conversas: [{ jid: "5562981707432@s.whatsapp.net", tipo: "individual", nome: "Fulano" }],
      },
      expect.objectContaining({ tipo: "mensagens", numeroId: "vaga1", origem: "historico" }),
      expect.objectContaining({ tipo: "mensagens", numeroId: "vaga1", origem: "historico" }),
    ]);
    const lotes = eventos.filter((e) => e.tipo === "mensagens");
    expect(lotes.map((e) => e.mensagens.length)).toEqual([100, 50]);
    expect(console.info).toHaveBeenCalledWith("[conexoes] vaga1: 150 mensagens do histórico");
  });

  it("histórico com chats num formato inesperado só registra o nome do erro e ainda envia as mensagens", async () => {
    await conexoes.conectar("vaga1");
    expect(() =>
      baileys.sockets[0].emitir("messaging-history.set", { chats: {}, contacts: [], messages: [mensagemFalsa("H1")] }),
    ).not.toThrow();
    expect(console.error).toHaveBeenCalledWith("[conexoes] vaga1: falha ao converter conversas do histórico (TypeError)");
    expect(eventos).toEqual([
      { tipo: "mensagens", numeroId: "vaga1", origem: "historico", mensagens: [expect.objectContaining({ idExterno: "H1" })] },
    ]);
  });

  it("mensagens ao vivo (notify e append) saem como ao_vivo", async () => {
    await conexoes.conectar("vaga1");
    baileys.sockets[0].emitir("messages.upsert", { type: "notify", messages: [mensagemFalsa("A1")] });
    baileys.sockets[0].emitir("messages.upsert", { type: "append", messages: [mensagemFalsa("A2")] });
    expect(eventos).toEqual([
      { tipo: "mensagens", numeroId: "vaga1", origem: "ao_vivo", mensagens: [expect.objectContaining({ idExterno: "A1" })] },
      { tipo: "mensagens", numeroId: "vaga1", origem: "ao_vivo", mensagens: [expect.objectContaining({ idExterno: "A2" })] },
    ]);
  });

  it("upsert só com mensagens ignoradas não gera evento", async () => {
    await conexoes.conectar("vaga1");
    baileys.sockets[0].emitir("messages.upsert", {
      type: "notify",
      messages: [{ ...mensagemFalsa("R1"), message: { reactionMessage: { text: "👍" } } }],
    });
    expect(eventos).toEqual([]);
  });

  it("socket antigo não envia mensagens depois de desconectado", async () => {
    await conexoes.conectar("vaga1");
    await conexoes.desconectar("vaga1");
    eventos.length = 0;
    baileys.sockets[0].emitir("messages.upsert", { type: "notify", messages: [mensagemFalsa("A1")] });
    expect(eventos).toEqual([]);
  });

  it("ao abrir, busca os grupos e envia como conversas", async () => {
    await conexoes.conectar("vaga1");
    const sock = baileys.sockets[0];
    sock.user = { id: "5511999990000:1@s.whatsapp.net" };
    sock.groupFetchAllParticipating.mockResolvedValueOnce({
      "120363000000000001@g.us": { id: "120363000000000001@g.us", subject: "Turma A" },
    });
    sock.emitir("connection.update", { connection: "open" });
    await vi.waitFor(() => expect(eventos.some((e) => e.tipo === "conversas")).toBe(true));
    expect(eventos).toContainEqual({
      tipo: "conversas",
      numeroId: "vaga1",
      conversas: [{ jid: "120363000000000001@g.us", tipo: "grupo", nome: "Turma A" }],
    });
    expect(console.info).toHaveBeenCalledWith("[conexoes] vaga1: 1 grupos");
  });

  it("falha ao buscar grupos só registra e não derruba nada", async () => {
    await conexoes.conectar("vaga1");
    const sock = baileys.sockets[0];
    sock.user = { id: "5511999990000:1@s.whatsapp.net" };
    sock.groupFetchAllParticipating.mockRejectedValueOnce(new Error("tempo esgotado"));
    sock.emitir("connection.update", { connection: "open" });
    await vi.waitFor(() =>
      expect(console.error).toHaveBeenCalledWith("[conexoes] vaga1: falha ao buscar grupos (Error)"),
    );
    expect(eventos).toEqual([{ tipo: "conectado", numeroId: "vaga1", telefone: "5511999990000" }]);
    expect(conexoes.conectados()).toEqual(["vaga1"]);
  });
});

/** Mensagem de texto simples de um contato individual. */
function mensagemFalsa(id: string) {
  return {
    key: { remoteJid: "5562981707432@s.whatsapp.net", fromMe: false, id },
    message: { conversation: "oi" },
    messageTimestamp: 1_763_380_800,
    pushName: "Fulano",
  };
}
