import "server-only";
import type { TipoComandoWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventoMotor } from "../esquemas/motor";
import { aplicarConversas, aplicarMensagens, type ContextoCaptura } from "./captura";

const REENTREGA_MS = 2 * 60_000;
const MAX_TENTATIVAS = 3;
const MAX_POR_CHAMADA = 20;
/** Vaga conectada há menos que isso não é conferida pelo sinal. */
const CONEXAO_RECENTE_MS = 2 * 60_000;

/** Códigos do Prisma de falha passageira (conexão, tempo esgotado, deadlock): não descartam o lote. */
const ERROS_PASSAGEIROS = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2034"]);

/** Aplica um lote de eventos do motor. Evento de vaga inexistente ou excluída é ignorado. */
export async function aplicarEventos(
  eventos: EventoMotor[],
  agora: Date = new Date(),
): Promise<{ aplicados: number; ignorados: number }> {
  let aplicados = 0;
  let ignorados = 0;
  const contexto: ContextoCaptura = { contatos: new Map() };
  for (const ev of eventos) {
    try {
      if (await aplicarEvento(ev, agora, contexto)) aplicados++;
      else ignorados++;
    } catch (e) {
      // Erro passageiro do banco: o lote falha (500) e o motor reenvia; o que já foi aplicado não duplica.
      if (ERROS_PASSAGEIROS.has(codigoDoErro(e))) throw e;
      // Um evento ruim não derruba o lote (o motor reenviaria para sempre). Só o tipo e o código:
      // a mensagem do erro do MySQL pode trazer telefone ("Duplicate entry '...'").
      console.error(`[whatsapp/motor] falha ao aplicar evento ${ev.tipo} (código ${codigoDoErro(e)})`);
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

/**
 * Comandos para o motor executar: os pendentes e os que ficaram presos há mais de 2 min.
 * `conectar` de vaga excluída falha; `desconectar` segue, para o motor encerrar a sessão dela.
 */
export async function entregarComandos(
  agora: Date = new Date(),
): Promise<{ id: string; numeroId: string; tipo: TipoComandoWhatsapp }[]> {
  const presoAntesDe = new Date(agora.getTime() - REENTREGA_MS);
  const candidatos = await prisma.comandoWhatsapp.findMany({
    where: { OR: [{ situacao: "pendente" }, { situacao: "em_andamento", iniciadoEm: { lt: presoAntesDe } }] },
    include: { numero: { select: { excluidoEm: true } } },
    orderBy: { criadoEm: "asc" },
    take: MAX_POR_CHAMADA,
  });
  const entregues: { id: string; numeroId: string; tipo: TipoComandoWhatsapp }[] = [];
  // Cada comando é reivindicado com um update condicional: se outra consulta do motor
  // chegou primeiro, a condição não bate (count 0) e este comando não é entregue de novo.
  const aindaDisponivel = (id: string) => ({
    id,
    OR: [{ situacao: "pendente" as const }, { situacao: "em_andamento" as const, iniciadoEm: { lt: presoAntesDe } }],
  });
  for (const c of candidatos) {
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
  return entregues;
}

/** Registra o resultado de um comando. Falha ao conectar leva a vaga para o estado de erro. */
export async function concluirComando(
  id: string,
  resultado: { situacao: "concluido" | "falhou"; erro?: string },
): Promise<boolean> {
  const comando = await prisma.comandoWhatsapp.findUnique({ where: { id } });
  if (!comando) return false;
  const erro = resultado.erro?.slice(0, 255) ?? null;
  await prisma.$transaction(async (tx) => {
    await tx.comandoWhatsapp.update({
      where: { id },
      data: { situacao: resultado.situacao, concluidoEm: new Date(), erro },
    });
    if (resultado.situacao === "falhou" && comando.tipo === "conectar") {
      await tx.numeroWhatsapp.update({
        where: { id: comando.numeroId },
        data: { situacao: "erro", qrAtual: null, qrEm: null, erro },
      });
    }
  });
  return true;
}
