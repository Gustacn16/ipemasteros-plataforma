import "server-only";
import type { TipoComandoWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventoMotor } from "../esquemas/motor";
import { descreverErro } from "@/modulos/nexu/servicos/descrever-erro";
import { ATRASO_MAX_MS, lerDadosEnviarGrupo, registrarResultadoEnvio, type DadosEnviarGrupo } from "./avisos-envio";
import { aplicarConversas, aplicarMensagens, type ContextoCaptura } from "./captura";

const REENTREGA_MS = 2 * 60_000;
const MAX_TENTATIVAS = 3;
const MAX_POR_CHAMADA = 20;
const MAX_ENVIOS_CANDIDATOS = 50;
/** Vaga conectada há menos que isso não é conferida pelo sinal. */
const CONEXAO_RECENTE_MS = 2 * 60_000;
const ERRO_ENVIO_SEM_CONFIRMACAO = "O motor não confirmou o envio.";
const ERRO_DADOS_ENVIO = "Dados do envio inválidos.";
const ERRO_ENVIO_ATRASADO = "Passou do horário (o motor ficou parado).";

/** Códigos do Prisma de falha passageira (conexão, tempo esgotado, deadlock): não descartam o lote. */
const ERROS_PASSAGEIROS = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"]);

/** Aplica um lote de eventos do motor. Evento de vaga inexistente ou excluída é ignorado. */
export async function aplicarEventos(
  eventos: EventoMotor[],
  agora: Date = new Date(),
): Promise<{ aplicados: number; ignorados: number }> {
  let aplicados = 0;
  let ignorados = 0;
  const contexto: ContextoCaptura = { contatos: new Map(), juntados: new Map() };
  for (const ev of eventos) {
    try {
      if (await aplicarEvento(ev, agora, contexto)) aplicados++;
      else ignorados++;
    } catch (e) {
      // Erro passageiro do banco: o lote falha (500) e o motor reenvia; o que já foi aplicado não duplica.
      if (ERROS_PASSAGEIROS.has(codigoDoErro(e))) throw e;
      // Um evento ruim não derruba o lote (o motor reenviaria para sempre). Só o tipo e os códigos:
      // a mensagem do erro do MySQL pode trazer telefone ("Duplicate entry '...'").
      // descreverErro traz também o código do banco (ex.: "mysql:1267"), sem a mensagem.
      console.error(`[whatsapp/motor] falha ao aplicar evento ${ev.tipo} (${descreverErro(e)})`);
      ignorados++;
    }
  }
  return { aplicados, ignorados };
}

function codigoDoErro(e: unknown): string {
  const codigo = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof codigo === "string" ? codigo : "desconhecido";
}

/** Aplica um evento; false quando é de vaga inexistente ou excluída (ignorado). */
async function aplicarEvento(ev: EventoMotor, agora: Date, contexto: ContextoCaptura): Promise<boolean> {
  if (ev.tipo === "sinal") {
    await prisma.numeroWhatsapp.updateMany({ where: { excluidoEm: null }, data: { ultimoSinalEm: agora } });
    // O motor está vivo, mas a vaga "conectada" não está na lista dele (ex.: derrubada por outra
    // sessão ou motor reiniciado sem ela): a tela não pode continuar dizendo "Conectado".
    // Vagas conectadas há menos de 2 min ficam de fora, porque o motor pode ainda não tê-las contado.
    await prisma.numeroWhatsapp.updateMany({
      where: {
        excluidoEm: null,
        situacao: "conectado",
        id: { notIn: ev.conectados },
        conectadoEm: { lt: new Date(agora.getTime() - CONEXAO_RECENTE_MS) },
      },
      data: { situacao: "erro", erro: "O motor não está com este número conectado." },
    });
    return true;
  }
  const numero = await prisma.numeroWhatsapp.findUnique({ where: { id: ev.numeroId }, select: { id: true, excluidoEm: true } });
  if (!numero || numero.excluidoEm) return false;
  if (ev.tipo === "conversas") {
    await aplicarConversas(numero.id, ev.conversas, agora);
  } else if (ev.tipo === "mensagens") {
    await aplicarMensagens(numero.id, ev.origem, ev.mensagens, agora, contexto);
  } else if (ev.tipo === "qr") {
    await prisma.numeroWhatsapp.update({
      where: { id: numero.id },
      data: { qrAtual: ev.qr, qrEm: agora, situacao: "aguardando_qr" },
    });
  } else if (ev.tipo === "conectado") {
    await prisma.numeroWhatsapp.update({
      where: { id: numero.id },
      data: { situacao: "conectado", telefone: ev.telefone, conectadoEm: agora, qrAtual: null, qrEm: null, erro: null },
    });
    // Telefone novo da empresa: as próximas mensagens do lote recalculam quem é "deMim".
    contexto.empresa = undefined;
  } else if (ev.motivo === "erro") {
    // Erro do motor (acesso recusado, sessão em outro lugar, conexão que não abriu): a tela mostra o detalhe.
    await prisma.numeroWhatsapp.update({
      where: { id: numero.id },
      data: { situacao: "erro", qrAtual: null, qrEm: null, erro: (ev.detalhe || "Erro informado pelo motor.").slice(0, 255) },
    });
  } else {
    await prisma.numeroWhatsapp.update({
      where: { id: numero.id },
      data: {
        situacao: "desconectado",
        qrAtual: null,
        qrEm: null,
        erro: ev.motivo === "removido_no_celular" ? "removido_no_celular" : null,
      },
    });
  }
  return true;
}

export type ComandoEntregue =
  | { id: string; numeroId: string; tipo: "conectar" | "desconectar" }
  | { id: string; numeroId: string; tipo: "enviar_grupo"; dados: DadosEnviarGrupo };

/**
 * Comandos para o motor executar: os pendentes (com `executarApos` vencido) e os que ficaram presos há mais de 2 min.
 * `conectar` de vaga excluída falha; `desconectar` segue, para o motor encerrar a sessão dela.
 * `enviar_grupo`:
 * - só sai para o motor que declarou `recursos` com "enviar_grupo" (o motor antigo trataria o tipo como desconectar);
 * - o pendente vencido há mais de 30 min falha para qualquer motor, antes dessa checagem;
 * - no máximo 1 por número em cada chamada;
 * - nunca é reentregue: preso em andamento há mais de 2 min vira `falhou` (repetir arriscaria mandar duas vezes).
 */
export async function entregarComandos(
  agora: Date = new Date(),
  opcoes: { recursos?: string[] } = {},
): Promise<ComandoEntregue[]> {
  const enviaGrupo = opcoes.recursos?.includes("enviar_grupo") ?? false;
  // Atrasados falham sempre, mesmo para o motor antigo: não ficam pendentes para sempre.
  await falharEnviosAtrasados(agora);
  const presoAntesDe = new Date(agora.getTime() - REENTREGA_MS);
  const vencido = { OR: [{ executarApos: null }, { executarApos: { lte: agora } }] };
  const pendente = { situacao: "pendente" as const, tipo: { in: ["conectar", "desconectar"] as TipoComandoWhatsapp[] }, ...vencido };
  // Presos de qualquer tipo: conectar/desconectar são reentregues; enviar_grupo falha.
  const preso = { situacao: "em_andamento" as const, iniciadoEm: { lt: presoAntesDe } };
  const candidatos = await prisma.comandoWhatsapp.findMany({
    where: { OR: [pendente, preso] },
    include: { numero: { select: { excluidoEm: true } } },
    orderBy: { criadoEm: "asc" },
    take: MAX_POR_CHAMADA,
  });
  const entregues: ComandoEntregue[] = [];
  // Cada comando é reivindicado com um update condicional: se outra consulta do motor
  // chegou primeiro, a condição não bate (count 0) e este comando não é entregue de novo.
  const aindaDisponivel = (id: string) => ({ id, OR: [pendente, preso] });
  for (const c of candidatos) {
    if (c.tipo === "enviar_grupo") {
      await falharEnvioPreso(c.id, presoAntesDe, agora);
      continue;
    }
    const conectarExcluido = c.tipo === "conectar" && c.numero.excluidoEm !== null;
    if (conectarExcluido || c.tentativas >= MAX_TENTATIVAS) {
      await prisma.comandoWhatsapp.updateMany({
        where: aindaDisponivel(c.id),
        data: {
          situacao: "falhou",
          concluidoEm: agora,
          erro: conectarExcluido ? "Número excluído." : "O motor não concluiu o comando.",
        },
      });
    } else {
      const { count } = await prisma.comandoWhatsapp.updateMany({
        where: aindaDisponivel(c.id),
        data: { situacao: "em_andamento", iniciadoEm: agora, tentativas: { increment: 1 } },
      });
      if (count === 1) entregues.push({ id: c.id, numeroId: c.numeroId, tipo: c.tipo });
    }
  }
  if (enviaGrupo) entregues.push(...(await entregarEnvios(agora)));
  return entregues;
}

/** enviar_grupo pendente há mais de 30 min do horário (motor parado): falha o comando e o envio, sem entregar. */
async function falharEnviosAtrasados(agora: Date): Promise<void> {
  const velhoAntesDe = new Date(agora.getTime() - ATRASO_MAX_MS);
  const velhos = await prisma.comandoWhatsapp.findMany({
    where: { situacao: "pendente", tipo: "enviar_grupo", executarApos: { lt: velhoAntesDe } },
    select: { id: true },
    orderBy: [{ executarApos: "asc" }, { id: "asc" }],
    take: MAX_ENVIOS_CANDIDATOS,
  });
  for (const { id } of velhos) await falharEnvioPendente(id, ERRO_ENVIO_ATRASADO, agora);
}

/** Os enviar_grupo pendentes que já venceram: no máximo 1 por número, só pendente → em andamento. */
async function entregarEnvios(agora: Date): Promise<ComandoEntregue[]> {
  const candidatos = await prisma.comandoWhatsapp.findMany({
    where: { situacao: "pendente", tipo: "enviar_grupo", OR: [{ executarApos: null }, { executarApos: { lte: agora } }] },
    select: { id: true, numeroId: true, dados: true, executarApos: true },
    orderBy: [{ executarApos: "asc" }, { criadoEm: "asc" }, { id: "asc" }],
    take: MAX_ENVIOS_CANDIDATOS,
  });
  const entregues: ComandoEntregue[] = [];
  const numerosComEnvio = new Set<string>();
  const velhoAntesDe = new Date(agora.getTime() - ATRASO_MAX_MS);
  for (const c of candidatos) {
    // Venceu há mais de 30 min (motor parado): não sai fora de hora.
    if (c.executarApos && c.executarApos < velhoAntesDe) {
      await falharEnvioPendente(c.id, ERRO_ENVIO_ATRASADO, agora);
      continue;
    }
    if (numerosComEnvio.has(c.numeroId)) continue;
    const dados = lerDadosEnviarGrupo(c.dados);
    if (!dados) {
      await falharEnvioPendente(c.id, ERRO_DADOS_ENVIO, agora);
      continue;
    }
    // Claim só do pendente: um enviar_grupo nunca volta de em andamento.
    const { count } = await prisma.comandoWhatsapp.updateMany({
      where: { id: c.id, situacao: "pendente" },
      data: { situacao: "em_andamento", iniciadoEm: agora, tentativas: { increment: 1 } },
    });
    if (count === 1) {
      numerosComEnvio.add(c.numeroId);
      entregues.push({ id: c.id, numeroId: c.numeroId, tipo: "enviar_grupo", dados });
    }
  }
  return entregues;
}

/** enviar_grupo pendente que não pode sair: claim pendente → falhou, o envio falha e o aviso fecha se for o último. */
async function falharEnvioPendente(id: string, erro: string, agora: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.comandoWhatsapp.updateMany({
      where: { id, situacao: "pendente" },
      data: { situacao: "falhou", concluidoEm: agora, erro },
    });
    if (count === 1) await registrarResultadoEnvio(tx, id, { situacao: "falhou", erro }, agora);
  });
}

/** enviar_grupo preso: falha o comando e o envio (nunca reentrega). */
async function falharEnvioPreso(id: string, presoAntesDe: Date, agora: Date): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.comandoWhatsapp.updateMany({
      where: { id, situacao: "em_andamento", iniciadoEm: { lt: presoAntesDe } },
      data: { situacao: "falhou", concluidoEm: agora, erro: ERRO_ENVIO_SEM_CONFIRMACAO },
    });
    if (count === 1) await registrarResultadoEnvio(tx, id, { situacao: "falhou", erro: ERRO_ENVIO_SEM_CONFIRMACAO }, agora);
  });
}

/**
 * Registra o resultado de um comando. Falha ao conectar leva a vaga para o estado de erro.
 * `enviar_grupo` atualiza o envio e fecha o aviso quando não sobra envio aguardando.
 */
export async function concluirComando(
  id: string,
  resultado: { situacao: "concluido" | "falhou"; erro?: string },
): Promise<boolean> {
  const comando = await prisma.comandoWhatsapp.findUnique({ where: { id } });
  if (!comando) return false;
  const erro = resultado.erro?.slice(0, 255) ?? null;
  const agora = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.comandoWhatsapp.update({
      where: { id },
      data: { situacao: resultado.situacao, concluidoEm: agora, erro },
    });
    if (resultado.situacao === "falhou" && comando.tipo === "conectar") {
      await tx.numeroWhatsapp.update({
        where: { id: comando.numeroId },
        data: { situacao: "erro", qrAtual: null, qrEm: null, erro },
      });
    }
    if (comando.tipo === "enviar_grupo") {
      await registrarResultadoEnvio(tx, id, { situacao: resultado.situacao, erro }, agora);
    }
  });
  return true;
}
