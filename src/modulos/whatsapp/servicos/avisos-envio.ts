import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { inicioDoDiaSaoPaulo } from "@/lib/ia/limites";
import { prisma } from "@/lib/prisma";
import { atrasosEnvio, escolherNumero, HORA_FIM_ENVIO, MAX_ENVIOS_NUMERO_DIA } from "../regras/avisos";

export const ALERTA_EVENTO_MUDOU = "O evento mudou depois da aprovação. Confira e aprove de novo.";
export const ALERTA_EVENTO_EXCLUIDO = "O evento foi excluído.";
export const ERRO_CANCELADO_EVENTO = "Cancelado: o evento mudou.";
export const ALERTA_MUDOU_DURANTE_ENVIO = "O evento mudou durante o envio.";
export const ERRO_LIMITE_DIA = "Limite de envios do dia atingido.";
export const ALERTA_ATRASADO = "Não saiu no horário (o sistema ficou parado). Reagende o aviso.";
export const ERRO_PASSOU_HORARIO = "Passou do horário.";
export const ERRO_GRUPO_NAO_ACOMPANHADO = "O grupo não é mais acompanhado.";
export const ERRO_PASSARIA_20H = "Passaria das 20h; reagende.";
/** Aviso que chega à fila mais atrasado que isso não sai (o cron ficou parado). */
export const ATRASO_MAX_MS = 30 * 60_000;

const MS_DIA = 86_400_000;

type Cliente = Prisma.TransactionClient | typeof prisma;

/** Dados que o comando `enviar_grupo` leva ao motor. */
export type DadosEnviarGrupo = { jid: string; texto: string; envioId: string };

export function lerDadosEnviarGrupo(dados: unknown): DadosEnviarGrupo | null {
  if (typeof dados !== "object" || dados === null) return null;
  const { jid, texto, envioId } = dados as Record<string, unknown>;
  if (typeof jid !== "string" || typeof texto !== "string" || typeof envioId !== "string") return null;
  if (!jid || !texto || !envioId) return null;
  return { jid, texto, envioId };
}

/**
 * Fecha o aviso quando nenhum envio dele está mais `aguardando`: `concluido` se ao menos um saiu,
 * senão `falhou`. Também corrige um aviso que ficou `falhou` e recebeu depois a confirmação de um envio.
 */
export async function fecharAvisoSeTerminou(cliente: Cliente, avisoId: string): Promise<void> {
  const aguardando = await cliente.envioAvisoGrupo.count({ where: { avisoId, situacao: "aguardando" } });
  if (aguardando > 0) return;
  const enviados = await cliente.envioAvisoGrupo.count({ where: { avisoId, situacao: "enviado" } });
  await cliente.avisoGrupo.updateMany({
    where: { id: avisoId, situacao: { in: ["enviando", "falhou"] } },
    data: { situacao: enviados > 0 ? "concluido" : "falhou" },
  });
}

/** Grava no envio o resultado do comando `enviar_grupo` dele e fecha o aviso se for o último. */
export async function registrarResultadoEnvio(
  cliente: Cliente,
  comandoId: string,
  resultado: { situacao: "concluido" | "falhou"; erro?: string | null },
  agora: Date,
): Promise<void> {
  const envio = await cliente.envioAvisoGrupo.findUnique({ where: { comandoId }, select: { id: true, avisoId: true } });
  if (!envio) return;
  // Condicional: um envio `enviado` nunca volta a `falhou` (resposta atrasada ou repetida do motor).
  // Vale aguardando → enviado/falhou e falhou → enviado (confirmação que chegou depois do prazo).
  if (resultado.situacao === "concluido") {
    await cliente.envioAvisoGrupo.updateMany({
      where: { id: envio.id, situacao: { in: ["aguardando", "falhou"] } },
      data: { situacao: "enviado", enviadoEm: agora, erro: null },
    });
  } else {
    await cliente.envioAvisoGrupo.updateMany({
      where: { id: envio.id, situacao: "aguardando" },
      data: { situacao: "falhou", erro: (resultado.erro || "O motor não conseguiu enviar.").slice(0, 255) },
    });
  }
  await fecharAvisoSeTerminou(cliente, envio.avisoId);
}

type Retrato = { titulo: unknown; dataInicio: unknown; horaInicio: unknown; local: unknown };

function lerRetrato(valor: Prisma.JsonValue | null): Retrato | null {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;
  return { titulo: v.titulo, dataInicio: v.dataInicio, horaInicio: v.horaInicio ?? null, local: v.local ?? null };
}

function eventoMudou(
  retrato: Retrato,
  evento: { titulo: string; dataInicio: Date; horaInicio: string | null; local: string | null },
): boolean {
  return (
    retrato.titulo !== evento.titulo ||
    retrato.dataInicio !== evento.dataInicio.toISOString() ||
    retrato.horaInicio !== evento.horaInicio ||
    retrato.local !== evento.local
  );
}

/**
 * Confere os avisos da agenda já aprovados contra o evento (retrato guardado na aprovação).
 * - `aprovado` com evento mudado ou excluído volta a `rascunho` com alerta.
 * - `enviando` com evento mudado ou excluído: os comandos ainda `pendente` falham e os envios deles também.
 */
export async function conferirEventosMudados(agora: Date): Promise<{ voltaram: number; interrompidos: number }> {
  const avisos = await prisma.avisoGrupo.findMany({
    where: { situacao: { in: ["aprovado", "enviando"] }, origem: "agenda" },
    select: {
      id: true,
      situacao: true,
      retratoEvento: true,
      evento: { select: { titulo: true, dataInicio: true, horaInicio: true, local: true, excluidoEm: true } },
    },
  });
  let voltaram = 0;
  let interrompidos = 0;
  for (const aviso of avisos) {
    const retrato = lerRetrato(aviso.retratoEvento);
    if (!retrato) continue; // sem retrato não há com o que comparar
    const excluido = !aviso.evento || aviso.evento.excluidoEm !== null;
    if (!excluido && !eventoMudou(retrato, aviso.evento!)) continue;

    if (aviso.situacao === "aprovado") {
      // Claim: se o cron de envio pegou o aviso antes, a condição não bate e ele é tratado como `enviando` na próxima rodada.
      const { count } = await prisma.avisoGrupo.updateMany({
        where: { id: aviso.id, situacao: "aprovado" },
        data: {
          situacao: "rascunho",
          alerta: excluido ? ALERTA_EVENTO_EXCLUIDO : ALERTA_EVENTO_MUDOU,
          aprovadoPorId: null,
          aprovadoEm: null,
          retratoEvento: Prisma.DbNull,
        },
      });
      if (count === 1) voltaram++;
      continue;
    }

    // `enviando`: avisa na tela e cancela só o que o motor ainda não pegou. Cada comando é
    // reivindicado sozinho, junto com o envio dele numa transação, para marcar o envio apenas
    // quando o cancelamento venceu a busca do motor.
    await prisma.avisoGrupo.updateMany({
      where: { id: aviso.id, situacao: "enviando" },
      data: { alerta: ALERTA_MUDOU_DURANTE_ENVIO },
    });
    const envios = await prisma.envioAvisoGrupo.findMany({
      where: { avisoId: aviso.id, situacao: "aguardando", comandoId: { not: null } },
      select: { id: true, comandoId: true },
    });
    let cancelados = 0;
    for (const envio of envios) {
      const cancelou = await prisma.$transaction(async (tx) => {
        const { count } = await tx.comandoWhatsapp.updateMany({
          where: { id: envio.comandoId!, situacao: "pendente" },
          data: { situacao: "falhou", concluidoEm: agora, erro: ERRO_CANCELADO_EVENTO },
        });
        if (count === 0) return false;
        await tx.envioAvisoGrupo.updateMany({
          where: { id: envio.id, situacao: "aguardando" },
          data: { situacao: "falhou", erro: ERRO_CANCELADO_EVENTO },
        });
        return true;
      });
      if (cancelou) cancelados++;
    }
    if (cancelados > 0) {
      interrompidos++;
      await fecharAvisoSeTerminou(prisma, aviso.id);
    }
  }
  return { voltaram, interrompidos };
}

/**
 * Transforma os avisos `aprovado` que chegaram na hora em comandos `enviar_grupo` espaçados.
 * Cada aviso é tratado numa transação: o claim `aprovado` → `enviando` garante que dois crons
 * simultâneos não criam comandos para o mesmo aviso, e uma falha no meio desfaz tudo (o aviso
 * continua `aprovado` e é tentado de novo).
 */
export async function dispararAvisosDaHora(
  agora: Date,
  aleatorio: () => number = Math.random,
): Promise<{ avisos: number; comandos: number; semNumero: number; acimaDoLimite: number; atrasados: number }> {
  const prontos = await prisma.avisoGrupo.findMany({
    where: { situacao: "aprovado", agendadoPara: { lte: agora } },
    select: { id: true },
    orderBy: { agendadoPara: "asc" },
  });
  const total = { avisos: 0, comandos: 0, semNumero: 0, acimaDoLimite: 0, atrasados: 0 };
  const atrasadoAntesDe = new Date(agora.getTime() - ATRASO_MAX_MS);

  // Muito atrasados: não saem fora de hora. Claim `aprovado` → `falhou`, e os envios aguardando falham.
  for (const { id } of prontos) {
    const atrasou = await prisma.$transaction(async (tx) => {
      const { count } = await tx.avisoGrupo.updateMany({
        where: { id, situacao: "aprovado", agendadoPara: { lt: atrasadoAntesDe } },
        data: { situacao: "falhou", alerta: ALERTA_ATRASADO },
      });
      if (count === 0) return false;
      await tx.envioAvisoGrupo.updateMany({
        where: { avisoId: id, situacao: "aguardando" },
        data: { situacao: "falhou", erro: ERRO_PASSOU_HORARIO },
      });
      return true;
    });
    if (atrasou) total.atrasados++;
  }
  // Último atraso (s) já marcado por número nesta rodada: o aviso seguinte no mesmo número
  // começa depois dele, com uma nova espera de 8 a 20 s.
  const ultimoAtraso = new Map<string, number>();
  const inicioDia = inicioDoDiaSaoPaulo(agora);
  const fimDia = new Date(inicioDia.getTime() + MS_DIA);
  const limite20h = new Date(inicioDia.getTime() + HORA_FIM_ENVIO * 3_600_000);

  for (const { id } of prontos) {
    const r = await prisma.$transaction(
      async (tx) => {
        const { count } = await tx.avisoGrupo.updateMany({
          where: { id, situacao: "aprovado", agendadoPara: { gte: atrasadoAntesDe, lte: agora } },
          data: { situacao: "enviando" },
        });
        if (count === 0) return null; // outro cron já pegou, ou o aviso mudou
        const aviso = await tx.avisoGrupo.findUnique({ where: { id }, select: { texto: true } });
        const todosEnvios = await tx.envioAvisoGrupo.findMany({
          where: { avisoId: id, situacao: "aguardando", comandoId: null },
          select: { id: true, conversaId: true, conversa: { select: { jid: true, tipo: true, monitorada: true } } },
          orderBy: { id: "asc" },
        });

        // Só grupos ainda acompanhados: o resto falha aqui, sem comando.
        const envios = [];
        for (const e of todosEnvios) {
          if (e.conversa.tipo === "grupo" && e.conversa.monitorada) {
            envios.push(e);
            continue;
          }
          await tx.envioAvisoGrupo.updateMany({
            where: { id: e.id, situacao: "aguardando", comandoId: null },
            data: { situacao: "falhou", erro: ERRO_GRUPO_NAO_ACOMPANHADO },
          });
        }

        // Números aptos por grupo: conectados, da escola, não excluídos e que estão no grupo.
        const vinculos = await tx.numeroNoGrupo.findMany({
          where: {
            conversaId: { in: envios.map((e) => e.conversaId) },
            numero: { situacao: "conectado", finalidade: "escola", excluidoEm: null },
          },
          select: { conversaId: true, numero: { select: { id: true, nome: true, time: true } } },
        });
        const porGrupo = new Map<string, { id: string; nome: string; time: (typeof vinculos)[number]["numero"]["time"] }[]>();
        for (const v of vinculos) porGrupo.set(v.conversaId, [...(porGrupo.get(v.conversaId) ?? []), v.numero]);

        // Envios do dia por número (dia de São Paulo, somando todos os avisos).
        const usados = new Map<string, number>();
        const usadosHoje = async (numeroId: string) => {
          if (!usados.has(numeroId)) {
            usados.set(
              numeroId,
              await tx.comandoWhatsapp.count({
                where: { numeroId, tipo: "enviar_grupo", criadoEm: { gte: inicioDia, lt: fimDia } },
              }),
            );
          }
          return usados.get(numeroId)!;
        };

        const res = { comandos: 0, semNumero: 0, acimaDoLimite: 0 };
        const aEnviar: { envio: (typeof envios)[number]; numeroId: string }[] = [];
        for (const envio of envios) {
          const numeroId = escolherNumero(porGrupo.get(envio.conversaId) ?? []);
          if (!numeroId) {
            await tx.envioAvisoGrupo.updateMany({
              where: { id: envio.id, situacao: "aguardando", comandoId: null },
              data: { situacao: "sem_numero" },
            });
            res.semNumero++;
            continue;
          }
          const usadosDoNumero = await usadosHoje(numeroId);
          if (usadosDoNumero >= MAX_ENVIOS_NUMERO_DIA) {
            await tx.envioAvisoGrupo.updateMany({
              where: { id: envio.id, situacao: "aguardando", comandoId: null },
              data: { situacao: "falhou", numeroId, erro: ERRO_LIMITE_DIA },
            });
            res.acimaDoLimite++;
            continue;
          }
          usados.set(numeroId, usadosDoNumero + 1);
          aEnviar.push({ envio, numeroId });
        }

        const anteriores = aEnviar.map((a) => ultimoAtraso.get(a.numeroId)).filter((v) => v !== undefined);
        const atrasos =
          anteriores.length === 0
            ? atrasosEnvio(aEnviar.length, aleatorio)
            : atrasosEnvio(aEnviar.length + 1, aleatorio)
                .slice(1)
                .map((a) => Math.max(...anteriores) + a);
        for (const [i, { envio, numeroId }] of aEnviar.entries()) {
          const executarApos = new Date(agora.getTime() + atrasos[i]! * 1000);
          // O deslocamento acumulado por número pode passar das 20h: não cria o comando.
          if (executarApos.getTime() > limite20h.getTime()) {
            await tx.envioAvisoGrupo.updateMany({
              where: { id: envio.id, situacao: "aguardando", comandoId: null },
              data: { situacao: "falhou", numeroId, erro: ERRO_PASSARIA_20H },
            });
            continue;
          }
          const dados: DadosEnviarGrupo = { jid: envio.conversa.jid, texto: aviso!.texto, envioId: envio.id };
          const comando = await tx.comandoWhatsapp.create({
            data: {
              numeroId,
              tipo: "enviar_grupo",
              dados,
              executarApos,
            },
            select: { id: true },
          });
          // Claim do envio: só um comando por envio.
          const { count: pegou } = await tx.envioAvisoGrupo.updateMany({
            where: { id: envio.id, situacao: "aguardando", comandoId: null },
            data: { comandoId: comando.id, numeroId },
          });
          if (pegou === 0) {
            await tx.comandoWhatsapp.delete({ where: { id: comando.id } });
            continue;
          }
          res.comandos++;
          ultimoAtraso.set(numeroId, Math.max(ultimoAtraso.get(numeroId) ?? 0, atrasos[i]!));
        }

        if (res.comandos === 0) {
          // Nenhum comando: o aviso não tem o que esperar.
          await tx.avisoGrupo.updateMany({ where: { id, situacao: "enviando" }, data: { situacao: "falhou" } });
        }
        return res;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
    if (!r) continue;
    total.avisos++;
    total.comandos += r.comandos;
    total.semNumero += r.semNumero;
    total.acimaDoLimite += r.acimaDoLimite;
  }
  return total;
}
