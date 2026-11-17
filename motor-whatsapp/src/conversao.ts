import {
  getContentType,
  jidNormalizedUser,
  normalizeMessageContent,
  type Chat,
  type GroupMetadata,
  type WAMessage,
  type WAMessageContent,
} from "baileys";
import { telefoneDoJid, type ConversaMotor, type MensagemMotor, type TipoMensagem } from "./tipos.ts";

/**
 * Conversão do que a Baileys entrega para o contrato com o IPEMaster OS. Puro, sem socket.
 * Só sai daqui o que passa no esquema do sistema (src/modulos/whatsapp/esquemas/motor.ts):
 * um valor inválido faria o lote inteiro voltar com 400 e ser reenviado para sempre.
 */

/** Limites do esquema do sistema. */
const MAX_TEXTO = 4000;
const MAX_NOME_CONVERSA = 120;
const MAX_NOME_AUTOR = 100;
const MAX_ID = 100;
const MAX_JID = 60;

/** Mesmo formato aceito pelo sistema: grupo, individual ou LID (status e canais ficam de fora). */
const JID_VALIDO = /^[^@\s]+@(g\.us|s\.whatsapp\.net|lid)$/;
const TELEFONE_VALIDO = /^\d{10,15}$/;

/** Conteúdos que nunca viram mensagem: protocolo (apagada, edição), reação, voto de enquete e controle. */
const IGNORADOS = new Set<keyof WAMessageContent>([
  "protocolMessage",
  "reactionMessage",
  "encReactionMessage",
  "pollUpdateMessage",
  "senderKeyDistributionMessage",
  "keepInChatMessage",
  "pinInChatMessage",
]);

const TIPOS: Partial<Record<keyof WAMessageContent, TipoMensagem>> = {
  conversation: "texto",
  extendedTextMessage: "texto",
  imageMessage: "imagem",
  videoMessage: "video",
  ptvMessage: "video",
  audioMessage: "audio",
  documentMessage: "documento",
  stickerMessage: "figurinha",
};

/** JID normalizado (sem aparelho) se estiver no formato aceito; senão null. */
function jidAceito(jid: string | null | undefined): string | null {
  if (!jid) return null;
  const normalizado = jidNormalizedUser(jid) || jid;
  return normalizado.length <= MAX_JID && JID_VALIDO.test(normalizado) ? normalizado : null;
}

function telefoneAceito(jid: string | null | undefined): string | null {
  const telefone = jid ? telefoneDoJid(jidNormalizedUser(jid) || jid) : null;
  return telefone && TELEFONE_VALIDO.test(telefone) ? telefone : null;
}

/** Segundos (número ou Long do protobuf) → ISO 8601; null se ausente ou inválido. */
function dataIso(segundos: WAMessage["messageTimestamp"]): string | null {
  if (segundos === null || segundos === undefined) return null;
  const valor = typeof segundos === "number" ? segundos : Number(segundos.toString());
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const data = new Date(valor * 1000);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

/** Corta e descarta texto vazio. */
function cortado(texto: string | null | undefined, max: number): string | undefined {
  if (!texto) return undefined;
  return texto.slice(0, max);
}

/** Texto e id da mensagem respondida, a partir do conteúdo já normalizado. */
function textoEResposta(
  conteudo: WAMessageContent,
  chave: keyof WAMessageContent,
): { texto?: string | null; respondeA?: string | null } {
  if (chave === "conversation") return { texto: conteudo.conversation };
  const interno = conteudo[chave] as { text?: string | null; caption?: string | null; contextInfo?: { stanzaId?: string | null } | null } | null | undefined;
  if (!interno || typeof interno !== "object") return {};
  const texto = chave === "extendedTextMessage" ? interno.text : TIPOS[chave] ? interno.caption : undefined;
  return { texto, respondeA: interno.contextInfo?.stanzaId };
}

/** Converte uma mensagem da Baileys; null para o que é ignorado ou não passaria no esquema. */
export function converterMensagem(m: WAMessage): MensagemMotor | null {
  const jid = jidAceito(m.key?.remoteJid);
  const idExterno = m.key?.id;
  const enviadaEm = dataIso(m.messageTimestamp);
  if (!jid || !idExterno || idExterno.length > MAX_ID || !enviadaEm) return null;

  const conteudo = normalizeMessageContent(m.message);
  const chave = getContentType(conteudo);
  if (!conteudo || !chave || IGNORADOS.has(chave)) return null;

  const deMim = Boolean(m.key.fromMe);
  const { texto, respondeA } = textoEResposta(conteudo, chave);
  const saida: MensagemMotor = { idExterno, jid, deMim, tipo: TIPOS[chave] ?? "outro", enviadaEm };

  // Mensagem minha não leva autor: o sistema já sabe que é da empresa.
  if (!deMim) {
    const grupo = jid.endsWith("@g.us");
    const autorJid = grupo ? jidAceito(m.key.participant) : jid;
    const alternativo = grupo ? m.key.participantPn : m.key.senderPn;
    const autorTelefone = telefoneAceito(autorJid) ?? telefoneAceito(alternativo);
    const autorNome = cortado(m.pushName, MAX_NOME_AUTOR);
    if (autorJid) saida.autorJid = autorJid;
    if (autorTelefone) saida.autorTelefone = autorTelefone;
    if (autorNome) saida.autorNome = autorNome;
  }

  const textoFinal = cortado(texto, MAX_TEXTO);
  if (textoFinal) saida.texto = textoFinal;
  if (respondeA && respondeA.length <= MAX_ID) saida.respondeA = respondeA;
  return saida;
}

/** Conversas a partir dos grupos (nome = assunto) e dos chats do histórico; um item por jid. */
export function converterConversas(grupos: GroupMetadata[], chats: Chat[]): ConversaMotor[] {
  const porJid = new Map<string, ConversaMotor>();
  const incluir = (id: string | null | undefined, nome: string | null | undefined) => {
    const jid = jidAceito(id);
    if (!jid || porJid.has(jid)) return;
    const conversa: ConversaMotor = { jid, tipo: jid.endsWith("@g.us") ? "grupo" : "individual" };
    const nomeFinal = cortado(nome?.trim(), MAX_NOME_CONVERSA);
    if (nomeFinal) conversa.nome = nomeFinal;
    porJid.set(jid, conversa);
  };
  for (const g of grupos) incluir(g.id, g.subject);
  for (const c of chats) incluir(c.id, c.name);
  return [...porJid.values()];
}

/** Divide a lista em lotes de até `tamanho` itens. */
export function emLotes<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}
