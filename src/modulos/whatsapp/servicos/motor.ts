import "server-only";
import type { TipoComandoWhatsapp } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { EventoMotor } from "../esquemas/motor";

const REENTREGA_MS = 2 * 60_000;
const MAX_TENTATIVAS = 3;
const MAX_POR_CHAMADA = 20;
/** Vaga conectada há menos que isso não é conferida pelo sinal. */
const CONEXAO_RECENTE_MS = 2 * 60_000;

/** Aplica um lote de eventos do motor. Evento de vaga inexistente ou excluída é ignorado. */
export async function aplicarEventos(
  eventos: EventoMotor[],
  agora: Date = new Date(),
): Promise<{ aplicados: number; ignorados: number }> {
  let aplicados = 0;
  let ignorados = 0;
  for (const ev of eventos) {
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
      aplicados++;
      continue;
    }
    const numero = await prisma.numeroWhatsapp.findUnique({ where: { id: ev.numeroId }, select: { id: true, excluidoEm: true } });
    if (!numero || numero.excluidoEm) {
      ignorados++;
      continue;
    }
    if (ev.tipo === "qr") {
      await prisma.numeroWhatsapp.update({
        where: { id: numero.id },
        data: { qrAtual: ev.qr, qrEm: agora, situacao: "aguardando_qr" },
      });
    } else if (ev.tipo === "conectado") {
      await prisma.numeroWhatsapp.update({
        where: { id: numero.id },
        data: { situacao: "conectado", telefone: ev.telefone, conectadoEm: agora, qrAtual: null, qrEm: null, erro: null },
      });
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
    aplicados++;
  }
  return { aplicados, ignorados };
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
