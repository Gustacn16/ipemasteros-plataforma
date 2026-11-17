import type { Chat, GroupMetadata, WAMessage } from "baileys";
import { describe, expect, it } from "vitest";
import { converterConversas, converterMensagem, emLotes } from "./conversao.ts";

const GRUPO = "120363000000000001@g.us";
const CONTATO = "5562981707432@s.whatsapp.net";
const SEGUNDOS = 1_763_380_800; // 2025-11-17T12:00:00.000Z

/** Mensagem montada à mão, no formato que a Baileys entrega. */
function mensagem(parcial: Partial<WAMessage> & { key?: Partial<WAMessage["key"]> }): WAMessage {
  return {
    messageTimestamp: SEGUNDOS,
    pushName: "Fulano",
    ...parcial,
    key: { remoteJid: CONTATO, fromMe: false, id: "ABC123", ...parcial.key },
  } as WAMessage;
}

describe("converterMensagem", () => {
  it("texto simples de conversa individual", () => {
    expect(converterMensagem(mensagem({ message: { conversation: "Oi, tudo bem?" } }))).toEqual({
      idExterno: "ABC123",
      jid: CONTATO,
      autorJid: CONTATO,
      autorTelefone: "5562981707432",
      autorNome: "Fulano",
      deMim: false,
      tipo: "texto",
      texto: "Oi, tudo bem?",
      enviadaEm: "2025-11-17T12:00:00.000Z",
    });
  });

  it("texto estendido também é texto", () => {
    const m = converterMensagem(mensagem({ message: { extendedTextMessage: { text: "com link" } } }));
    expect(m).toMatchObject({ tipo: "texto", texto: "com link" });
  });

  it("legenda de imagem vira tipo imagem com texto", () => {
    const m = converterMensagem(mensagem({ message: { imageMessage: { caption: "foto da aula" } } }));
    expect(m).toMatchObject({ tipo: "imagem", texto: "foto da aula" });
  });

  it("documento com legenda (embrulhado) vira documento com texto", () => {
    const m = converterMensagem(
      mensagem({ message: { documentWithCaptionMessage: { message: { documentMessage: { caption: "contrato" } } } } }),
    );
    expect(m).toMatchObject({ tipo: "documento", texto: "contrato" });
  });

  it("áudio vira tipo audio sem texto", () => {
    const m = converterMensagem(mensagem({ message: { audioMessage: { seconds: 5 } } }));
    expect(m?.tipo).toBe("audio");
    expect(m).not.toHaveProperty("texto");
  });

  it("figurinha e vídeo", () => {
    expect(converterMensagem(mensagem({ message: { stickerMessage: {} } }))?.tipo).toBe("figurinha");
    expect(converterMensagem(mensagem({ message: { videoMessage: {} } }))?.tipo).toBe("video");
  });

  it("status@broadcast é ignorado", () => {
    expect(
      converterMensagem(mensagem({ key: { remoteJid: "status@broadcast" }, message: { conversation: "status" } })),
    ).toBeNull();
  });

  it("canal (@newsletter) é ignorado", () => {
    expect(
      converterMensagem(mensagem({ key: { remoteJid: "123@newsletter" }, message: { conversation: "canal" } })),
    ).toBeNull();
  });

  it("reação é ignorada", () => {
    expect(
      converterMensagem(mensagem({ message: { reactionMessage: { text: "👍", key: { id: "X" } } } })),
    ).toBeNull();
  });

  it("mensagem apagada (protocolo) é ignorada", () => {
    expect(converterMensagem(mensagem({ message: { protocolMessage: { type: 0, key: { id: "X" } } } }))).toBeNull();
  });

  it("voto de enquete é ignorado", () => {
    expect(converterMensagem(mensagem({ message: { pollUpdateMessage: {} } }))).toBeNull();
  });

  it("mensagem sem conteúdo (aviso do sistema) é ignorada", () => {
    expect(converterMensagem(mensagem({ messageStubType: 20 }))).toBeNull();
  });

  it("grupo com participante @lid: autorJid lid, sem telefone", () => {
    const m = converterMensagem(
      mensagem({ key: { remoteJid: GRUPO, participant: "123456789012345@lid" }, message: { conversation: "oi" } }),
    );
    expect(m).toMatchObject({ jid: GRUPO, autorJid: "123456789012345@lid", autorNome: "Fulano" });
    expect(m).not.toHaveProperty("autorTelefone");
  });

  it("grupo com participante @lid e telefone alternativo: usa o telefone alternativo", () => {
    const m = converterMensagem(
      mensagem({
        key: { remoteJid: GRUPO, participant: "123456789012345@lid", participantPn: CONTATO },
        message: { conversation: "oi" },
      }),
    );
    expect(m).toMatchObject({ autorJid: "123456789012345@lid", autorTelefone: "5562981707432" });
  });

  it("mensagem minha não leva autor", () => {
    const m = converterMensagem(mensagem({ key: { fromMe: true }, message: { conversation: "oi" } }));
    expect(m).toMatchObject({ deMim: true, jid: CONTATO });
    expect(m).not.toHaveProperty("autorJid");
    expect(m).not.toHaveProperty("autorTelefone");
    expect(m).not.toHaveProperty("autorNome");
  });

  it("resposta leva respondeA", () => {
    const m = converterMensagem(
      mensagem({ message: { extendedTextMessage: { text: "sim", contextInfo: { stanzaId: "ORIG1" } } } }),
    );
    expect(m?.respondeA).toBe("ORIG1");
  });

  it("texto de 5000 caracteres é cortado em 4000", () => {
    const m = converterMensagem(mensagem({ message: { conversation: "a".repeat(5000) } }));
    expect(m?.texto).toHaveLength(4000);
  });

  it("nome de perfil longo é cortado em 100", () => {
    const m = converterMensagem(mensagem({ pushName: "n".repeat(150), message: { conversation: "oi" } }));
    expect(m?.autorNome).toHaveLength(100);
  });

  it("sem id ou sem data é ignorada", () => {
    expect(converterMensagem(mensagem({ key: { id: "" }, message: { conversation: "oi" } }))).toBeNull();
    expect(converterMensagem(mensagem({ messageTimestamp: null, message: { conversation: "oi" } }))).toBeNull();
  });

  it("data absurda é ignorada: antes de 2009 ou mais de 1 dia no futuro", () => {
    const agora = Math.floor(Date.now() / 1000);
    const com = (segundos: number) => converterMensagem(mensagem({ messageTimestamp: segundos, message: { conversation: "oi" } }));
    expect(com(1_230_767_999)).toBeNull(); // 2008-12-31T23:59:59Z
    expect(com(1_230_768_000)).not.toBeNull(); // 2009-01-01
    expect(com(agora + 2 * 86_400)).toBeNull();
    expect(com(agora + 3600)).not.toBeNull();
    expect(com(300_000_000_000)).toBeNull(); // ano > 9999
  });

  it("conversa individual @lid com telefone do remetente vira a conversa do telefone", () => {
    const m = converterMensagem(
      mensagem({ key: { remoteJid: "123456789012345@lid", senderPn: CONTATO }, message: { conversation: "oi" } }),
    );
    expect(m).toMatchObject({ jid: CONTATO, autorJid: CONTATO, autorTelefone: "5562981707432" });
  });

  it("conversa @lid sem telefone válido continua @lid; mensagem minha não usa senderPn (é o meu número)", () => {
    const semTelefone = converterMensagem(
      mensagem({ key: { remoteJid: "123456789012345@lid", senderPn: "abc@s.whatsapp.net" }, message: { conversation: "oi" } }),
    );
    expect(semTelefone?.jid).toBe("123456789012345@lid");
    const minha = converterMensagem(
      mensagem({
        key: { remoteJid: "123456789012345@lid", fromMe: true, senderPn: "5511999999999@s.whatsapp.net" },
        message: { conversation: "oi" },
      }),
    );
    expect(minha?.jid).toBe("123456789012345@lid");
  });
});

describe("converterConversas", () => {
  it("grupos pelo assunto e chats pelo nome, sem repetir jid e sem status/canal", () => {
    const grupos = [{ id: GRUPO, subject: "Turma A" }] as GroupMetadata[];
    const chats = [
      { id: GRUPO, name: "Outro nome" },
      { id: CONTATO, name: "Fulano" },
      { id: "999@lid" },
      { id: "status@broadcast" },
      { id: "123@newsletter", name: "Canal" },
    ] as Chat[];
    expect(converterConversas(grupos, chats)).toEqual([
      { jid: GRUPO, tipo: "grupo", nome: "Turma A" },
      { jid: CONTATO, tipo: "individual", nome: "Fulano" },
      { jid: "999@lid", tipo: "individual" },
    ]);
  });

  it("chat @lid com pnJid válido usa o jid do telefone", () => {
    const chats = [
      { id: "123456789012345@lid", pnJid: CONTATO, name: "Fulano" },
      { id: "999999999999999@lid", pnJid: "x@s.whatsapp.net" },
    ] as Chat[];
    expect(converterConversas([], chats)).toEqual([
      { jid: CONTATO, tipo: "individual", nome: "Fulano" },
      { jid: "999999999999999@lid", tipo: "individual" },
    ]);
  });

  it("nome longo é cortado em 120", () => {
    const [c] = converterConversas([{ id: GRUPO, subject: "x".repeat(200) } as GroupMetadata], []);
    expect(c.nome).toHaveLength(120);
  });
});

describe("emLotes", () => {
  it("250 itens em lotes de 100 → 100/100/50", () => {
    const itens = Array.from({ length: 250 }, (_, i) => i);
    expect(emLotes(itens, 100).map((l) => l.length)).toEqual([100, 100, 50]);
  });

  it("lista vazia não gera lote", () => {
    expect(emLotes([], 100)).toEqual([]);
  });
});
