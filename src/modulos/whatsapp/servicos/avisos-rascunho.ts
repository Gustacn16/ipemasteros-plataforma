import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { obterClienteAnthropic } from "@/lib/ia/cliente";
import { prisma } from "@/lib/prisma";
import { escreverAviso } from "../ia/texto-aviso";
import { horarioSugerido, normalizarNome, semanaSeguinte } from "../regras/avisos";

const OFFSET_MS = 3 * 60 * 60 * 1000;

/** Segunda-feira, 7h ou mais, em São Paulo (UTC-3 fixo). */
function ehSegundaDepoisDas7(agora: Date): boolean {
  const s = new Date(agora.getTime() - OFFSET_MS);
  return s.getUTCDay() === 1 && s.getUTCHours() >= 7;
}

/** Grupos monitorados da turma do evento; sem turma ou sem grupo para ela, os grupos padrão do tipo. */
export async function gruposSugeridos(evento: { tipoId: string; turma: string | null }): Promise<string[]> {
  if (evento.turma) {
    const alvo = normalizarNome(evento.turma);
    const conversas = await prisma.conversaWhatsapp.findMany({
      where: { tipo: "grupo", monitorada: true, turmaId: { not: null } },
      select: { id: true, turma: { select: { nome: true } } },
      orderBy: { id: "asc" },
    });
    const daTurma = conversas.filter((c) => c.turma && normalizarNome(c.turma.nome) === alvo).map((c) => c.id);
    if (daTurma.length > 0) return daTurma;
  }
  const padrao = await prisma.grupoPadraoTipoEvento.findMany({
    where: { tipoId: evento.tipoId, conversa: { tipo: "grupo", monitorada: true } },
    select: { conversaId: true },
    orderBy: { conversaId: "asc" },
  });
  return padrao.map((p) => p.conversaId);
}

const ehUnico = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

/**
 * Na segunda (7h ou mais, São Paulo), cria um rascunho de aviso por evento divulgável da semana seguinte.
 * Fora desse momento não consulta nada.
 */
export async function gerarRascunhosDaSemana(
  agora: Date,
  cliente?: Pick<Anthropic, "messages"> | null,
): Promise<{ criados: number; jaExistiam: number }> {
  if (!ehSegundaDepoisDas7(agora)) return { criados: 0, jaExistiam: 0 };
  const ia = cliente === undefined ? obterClienteAnthropic() : cliente;
  const { inicio, fim } = semanaSeguinte(agora);
  const eventos = await prisma.eventoInstitucional.findMany({
    where: { excluidoEm: null, dataInicio: { gte: inicio, lte: fim }, tipo: { divulgarNosGrupos: true } },
    orderBy: [{ dataInicio: "asc" }, { id: "asc" }],
  });
  if (eventos.length === 0) return { criados: 0, jaExistiam: 0 };
  const existentes = await prisma.avisoGrupo.findMany({
    where: { eventoId: { in: eventos.map((e) => e.id) } },
    select: { eventoId: true },
  });
  const jaTem = new Set(existentes.map((a) => a.eventoId));
  let criados = 0;
  let jaExistiam = 0;
  for (const evento of eventos) {
    if (jaTem.has(evento.id)) {
      jaExistiam++;
      continue;
    }
    const { texto, porIa } = await escreverAviso(evento, ia, agora);
    const grupos = await gruposSugeridos(evento);
    try {
      await prisma.avisoGrupo.create({
        data: {
          eventoId: evento.id,
          texto,
          textoPorIa: porIa,
          origem: "agenda",
          agendadoPara: horarioSugerido(evento.dataInicio),
          envios: { create: grupos.map((conversaId) => ({ conversaId, situacao: "aguardando" as const })) },
        },
      });
      criados++;
    } catch (e) {
      if (!ehUnico(e)) throw e;
      jaExistiam++;
    }
  }
  return { criados, jaExistiam };
}
