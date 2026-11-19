import "server-only";
import { prisma } from "@/lib/prisma";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { metricasDosDias, type MensagemTempo } from "../regras/atendimento";
import { obterRegrasAtendimento } from "./configuracao";

const DIAS_CARGA_INICIAL = 35;
const DIAS_RECALCULO = 5; // hoje e os 4 anteriores: o follow-up se decide em até 3 dias
const DIAS_ANTES_DA_JANELA = 7;
const LOTE_CONVERSAS = 1000;

const ultimosDias = (hoje: string, total: number) => Array.from({ length: total }, (_, i) => somarDias(hoje, i - (total - 1)));

/**
 * Recalcula a linha diária de cada número não excluído para hoje e os 4 dias anteriores.
 * Número sem nenhuma linha ainda (novo, ou a tabela vazia) recebe 35 dias, para carregar o histórico.
 * Linhas de dias anteriores a hoje mantêm o `time` gravado. Devolve só contagens
 * (`dias` é o maior período recalculado).
 */
export async function recalcularMetricas(agora: Date = new Date()): Promise<{ dias: number; linhas: number }> {
  const hoje = diaEmSaoPaulo(agora);
  const regras = await obterRegrasAtendimento();
  const numeros = await prisma.numeroWhatsapp.findMany({ where: { excluidoEm: null }, select: { id: true, time: true } });
  const comLinhas = new Set(
    (await prisma.metricaAtendimentoDia.findMany({ distinct: ["numeroId"], select: { numeroId: true } })).map((l) => l.numeroId),
  );
  const totalDe = (numeroId: string) => (comLinhas.has(numeroId) ? DIAS_RECALCULO : DIAS_CARGA_INICIAL);
  const total = Math.max(0, ...numeros.map((n) => totalDe(n.id)));
  // Mensagens carregadas uma vez, desde o dia mais antigo que algum número precisa (mais a folga de 7 dias).
  const maisAntigo = somarDias(hoje, -(Math.max(total, 1) - 1));
  const desde = new Date(`${somarDias(maisAntigo, -DIAS_ANTES_DA_JANELA)}T00:00:00.000-03:00`);
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
    const lista = porNumero.get(numeroId) ?? [];
    lista.push({ mensagens });
    porNumero.set(numeroId, lista);
  }

  let linhas = 0;
  for (const numero of numeros) {
    const dias = ultimosDias(hoje, totalDe(numero.id));
    const porDia = metricasDosDias(porNumero.get(numero.id) ?? [], dias, agora, regras);
    for (const dia of dias) {
      const linha = porDia.get(dia)!;
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
