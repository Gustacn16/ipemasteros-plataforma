import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { chaveTelefone } from "../regras/captura";
import { esquemaTelefoneTitular } from "../esquemas/titular";
import { contatoPorChave } from "./captura";

/**
 * Direito de exclusão do titular (LGPD art. 18): apaga o contato do telefone, as conversas individuais
 * dele e todas as mensagens dele (também as de grupos). A auditoria leva só ids e contagens.
 */
export async function apagarDadosDoTelefone(
  telefone: string,
  atorId: string,
): Promise<{ encontrado: boolean; mensagens: number; conversas: number }> {
  const chave = chaveTelefone(esquemaTelefoneTitular.parse(telefone));
  const contato = chave ? await contatoPorChave(chave) : null;
  if (!contato) return { encontrado: false, mensagens: 0, conversas: 0 };

  return prisma.$transaction(async (tx) => {
    const conversas = await tx.conversaWhatsapp.findMany({
      where: { contatoId: contato.id, tipo: "individual" },
      select: { id: true },
    });
    const idsConversas = conversas.map((c) => c.id);
    // Conta antes de apagar: as mensagens das conversas individuais saem em cascata.
    const doContato = await tx.mensagemWhatsapp.findMany({ where: { contatoId: contato.id }, select: { id: true } });
    const nasConversas = idsConversas.length
      ? await tx.mensagemWhatsapp.findMany({ where: { conversaId: { in: idsConversas } }, select: { id: true } })
      : [];
    const mensagens = new Set([...doContato, ...nasConversas].map((m) => m.id)).size;

    await tx.mensagemWhatsapp.deleteMany({ where: { contatoId: contato.id } });
    if (idsConversas.length) await tx.conversaWhatsapp.deleteMany({ where: { id: { in: idsConversas } } });
    await tx.contatoWhatsapp.delete({ where: { id: contato.id } });

    await registrarAuditoria(
      {
        usuarioId: atorId,
        acao: "whatsapp.dados_telefone_apagados",
        entidade: "ContatoWhatsapp",
        entidadeId: contato.id,
        diff: { mensagens, conversas: idsConversas.length },
      },
      tx,
    );
    return { encontrado: true, mensagens, conversas: idsConversas.length };
  });
}
