import "server-only";
import { prisma } from "@/lib/prisma";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { metricasDoDia, type MensagemTempo } from "../regras/atendimento";
import { obterRegrasAtendimento } from "./configuracao";

const DIAS_CARGA_INICIAL = 35;
const DIAS_RECALCULO = 5; // hoje e os 4 anteriores: o follow-up se decide em até 3 dias
const DIAS_ANTES_DA_JANELA = 7;
const LOTE_CONVERSAS = 1000;

/**
 * Recalcula a linha diária de cada número não excluído para hoje e os 4 dias anteriores
 * (35 dias se a tabela estiver vazia). Linhas de dias anteriores a hoje mantêm o `time` gravado.
 * Devolve só contagens.
 */
export async function recalcularMetricas(agora: Date = new Date()): Promise<{ dias: number; linhas: number }> {
  const hoje = diaEmSaoPaulo(agora);
  const total = (await prisma.metricaAtendimentoDia.count()) === 0 ? DIAS_CARGA_INICIAL : DIAS_RECALCULO;
  const dias = Array.from({ length: total }, (_, i) => somarDias(hoje, i - (total - 1)));
  const desde = new Date(`${somarDias(dias[0]!, -DIAS_ANTES_DA_JANELA)}T00:00:00.000-03:00`);

  const regras = await obterRegrasAtendimento();
  const numeros = await prisma.numeroWhatsapp.findMany({ where: { excluidoEm: null }, select: { id: true, time: true } });
  const conversas = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "individual", categoria: { in: ["lead", "aluno"] }, numero: { excluidoEm: null } },
    select: { id: true, numeroId: true },
  });

  const numeroDa = new Map(conversas.map((c) => [c.id, c.numeroId]));
  const porConversa = new Map<string, MensagemTempo[]>();
  for (let i = 0; i < conversas.length; i += LOTE_CONVERSAS) {
    const ids = conversas.slice(i, i + LOTE_CONVERSAS).map((c) => c.id);
    const mensagens = await prisma.mensagemWhatsapp.findMany({
      where: { conversaId: { in: ids }, enviadaEm: { gte: desde } },
      select: { conversaId: true, deMim: true, enviadaEm: true },
      orderBy: [{ enviadaEm: "asc" }, { id: "asc" }],
    });
    for (const m of mensagens) {
      const lista = porConversa.get(m.conversaId) ?? [];
      lista.push({ deMim: m.deMim, enviadaEm: m.enviadaEm });
      porConversa.set(m.conversaId, lista);
    }
  }
  const porNumero = new Map<string, { mensagens: MensagemTempo[] }[]>();
  for (const [conversaId, mensagens] of porConversa) {
    const numeroId = numeroDa.get(conversaId)!;
    porNumero.set(numeroId, [...(porNumero.get(numeroId) ?? []), { mensagens }]);
  }

  let linhas = 0;
  for (const numero of numeros) {
    for (const dia of dias) {
      const linha = metricasDoDia(porNumero.get(numero.id) ?? [], dia, agora, regras);
      const dados = {
        conversasComCliente: linha.conversasComCliente,
        primeirasRespostasSeg: linha.primeirasRespostasSeg,
        respostasSeg: linha.respostasSeg,
        respostasNoSla: linha.respostasNoSla,
        semResposta: linha.semResposta,
        followupsFeitos: linha.followupsFeitos,
        followupsPerdidos: linha.followupsPerdidos,
      };
      await prisma.metricaAtendimentoDia.upsert({
        where: { numeroId_dia: { numeroId: numero.id, dia: new Date(`${dia}T00:00:00.000Z`) } },
        create: { numeroId: numero.id, dia: new Date(`${dia}T00:00:00.000Z`), time: numero.time, ...dados },
        update: dia === hoje ? { time: numero.time, ...dados } : dados,
      });
      linhas++;
    }
  }
  return { dias: total, linhas };
}
