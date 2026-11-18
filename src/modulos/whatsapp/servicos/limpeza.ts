import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DIAS_RETENCAO, categoriaInicial, chaveTelefone } from "../regras/captura";
import { esquecerTelefonesCadastrados, ligacoesDoTelefone } from "./captura";

const LOTE = 5000;
const LOTE_CONTATOS = 500;

/**
 * Apaga em lotes (o deleteMany do Prisma não tem `take`): escolhe os ids e apaga até vir menos que um lote.
 * O filtro é conferido de novo no delete: o que deixou de casar no meio do caminho fica.
 */
async function apagarEmLotes(where: Prisma.MensagemWhatsappWhereInput): Promise<number> {
  let total = 0;
  for (;;) {
    const lote = await prisma.mensagemWhatsapp.findMany({ where, select: { id: true }, take: LOTE });
    if (lote.length === 0) break;
    const { count } = await prisma.mensagemWhatsapp.deleteMany({ where: { ...where, id: { in: lote.map((m) => m.id) } } });
    total += count;
    if (lote.length < LOTE) break;
  }
  return total;
}

/**
 * Liga aos cadastros feitos depois os contatos que ainda não têm aluno nem usuário.
 * Só a conversa ainda em "lead" muda de categoria: o que a gestão escolheu à mão fica.
 */
async function religarContatos(): Promise<number> {
  esquecerTelefonesCadastrados(); // o job vê os cadastros de agora, não os de até 60 s atrás
  let religados = 0;
  let ultimo: string | undefined;
  for (;;) {
    const lote = await prisma.contatoWhatsapp.findMany({
      where: { telefone: { not: null }, alunoId: null, usuarioId: null, ...(ultimo ? { id: { gt: ultimo } } : {}) },
      select: { id: true, telefone: true },
      orderBy: { id: "asc" },
      take: LOTE_CONTATOS,
    });
    if (lote.length === 0) break;
    ultimo = lote[lote.length - 1]!.id;
    for (const c of lote) {
      const chave = chaveTelefone(c.telefone);
      if (!chave) continue;
      const ligado = await ligacoesDoTelefone(chave);
      if (!ligado.alunoId && !ligado.usuarioId) continue;
      // Juntos: falhar no meio não deixa o contato ligado com a conversa parada em "lead".
      await prisma.$transaction([
        prisma.contatoWhatsapp.update({ where: { id: c.id }, data: ligado }),
        prisma.conversaWhatsapp.updateMany({
          where: { contatoId: c.id, tipo: "individual", categoria: "lead" },
          data: { categoria: categoriaInicial(ligado) },
        }),
      ]);
      religados++;
    }
    if (lote.length < LOTE_CONTATOS) break;
  }
  return religados;
}

/**
 * Limpeza diária: apaga as mensagens provisórias vencidas de grupos que continuam não monitorados
 * (e zera `provisoriaAte`) e as mensagens com mais de 90 dias e os resumos de grupo com mais de 365 dias; religa contatos a alunos e usuários
 * cadastrados depois; apaga conversas individuais vazias (menos "pessoal") e contatos sem nada.
 * Devolve só contagens.
 */
export async function limparWhatsapp(
  agora: Date = new Date(),
): Promise<{ provisorias: number; antigas: number; resumosAntigos: number; religados: number; conversasVazias: number; contatosVazios: number }> {
  const vencidas = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "grupo", monitorada: false, provisoriaAte: { lt: agora } },
    select: { id: true },
  });
  let provisorias = 0;
  if (vencidas.length > 0) {
    const ids = vencidas.map((c) => c.id);
    // O grupo pode ter virado monitorado depois da busca: a condição vai junto em cada passo.
    provisorias = await apagarEmLotes({ conversaId: { in: ids }, conversa: { monitorada: false, tipo: "grupo" } });
    await prisma.conversaWhatsapp.updateMany({ where: { id: { in: ids }, monitorada: false }, data: { provisoriaAte: null } });
  }
  const limite = new Date(agora.getTime() - DIAS_RETENCAO * 24 * 60 * 60 * 1000);
  const antigas = await apagarEmLotes({ enviadaEm: { lt: limite } });

  // Resumos de grupo ficam 1 ano; `dia` é a data de São Paulo guardada como meia-noite UTC.
  const { count: resumosAntigos } = await prisma.resumoGrupo.deleteMany({
    where: { dia: { lt: new Date(agora.getTime() - 365 * 24 * 60 * 60 * 1000) } },
  });

  const religados = await religarContatos();
  // As conversas saem antes dos contatos: o contato só some quando não tem mais conversa.
  const { count: conversasVazias } = await prisma.conversaWhatsapp.deleteMany({
    where: {
      tipo: "individual",
      categoria: { not: "pessoal" },
      mensagens: { none: {} },
      OR: [{ ultimaMensagemEm: { lt: limite } }, { ultimaMensagemEm: null, criadoEm: { lt: limite } }],
    },
  });
  // Contato criado há menos de 1 dia fica: a captura cria o contato antes de gravar suas mensagens e conversa.
  const umDiaAtras = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  const { count: contatosVazios } = await prisma.contatoWhatsapp.deleteMany({
    where: { mensagens: { none: {} }, conversas: { none: {} }, alunoId: null, usuarioId: null, criadoEm: { lt: umDiaAtras } },
  });
  return { provisorias, antigas, resumosAntigos, religados, conversasVazias, contatosVazios };
}
