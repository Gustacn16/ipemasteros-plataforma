"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { ErroPermissao } from "@/lib/permissoes";
import { exigirPermissao, exigirUsuario } from "@/lib/sessao";
import { esquemaApagarDadosTelefone } from "../esquemas/titular";
import type { EstadoTela } from "../regras/conexao";
import { TIMES } from "../regras/time";
import {
  alterarTimeNumero,
  criarNumero,
  excluirNumero,
  situacaoParaTela,
  solicitarConexao,
  solicitarDesconexao,
} from "../servicos/numeros";
import { salvarConfiguracaoWhatsapp } from "../servicos/configuracao";
import { apagarDadosDoTelefone } from "../servicos/titular";

const idNumero = z.string().min(1).max(40);

export async function criarNumeroAcao(dados: unknown): Promise<EstadoAcao<{ id: string }>> {
  try {
    const ator = await exigirPermissao("whatsapp:gerenciar_numeros");
    const criado = await criarNumero(ator, dados);
    revalidatePath("/whatsapp/numeros");
    return { ok: true, mensagem: "Número criado.", dados: criado };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

const esquemaTimeNumero = z.object({ numeroId: idNumero, time: z.enum(TIMES) });

export async function alterarTimeNumeroAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("whatsapp:gerenciar_numeros");
    const { numeroId, time } = esquemaTimeNumero.parse(dados);
    await alterarTimeNumero(ator, numeroId, time);
    revalidatePath("/whatsapp/numeros");
    return { ok: true, mensagem: "Time alterado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function excluirNumeroAcao(numeroId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await excluirNumero(ator, idNumero.parse(numeroId));
    revalidatePath("/whatsapp/numeros");
    return { ok: true, mensagem: "Número excluído." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function conectarNumeroAcao(numeroId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await solicitarConexao(ator, idNumero.parse(numeroId));
    revalidatePath("/whatsapp/numeros");
    return { ok: true };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function desconectarNumeroAcao(numeroId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirUsuario();
    await solicitarDesconexao(ator, idNumero.parse(numeroId));
    revalidatePath("/whatsapp/numeros");
    return { ok: true, mensagem: "Desconexão solicitada." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** Consultada a cada 2 s pelo diálogo de conexão. O QR vira SVG aqui, no servidor, e nunca vai para log nem URL. */
export async function situacaoNumeroAcao(
  numeroId: string,
): Promise<EstadoAcao<{ estado: EstadoTela; rotulo: string; detalhe: string | null; qrSvg: string | null }>> {
  try {
    const ator = await exigirUsuario();
    const { estado, rotulo, detalhe, qr } = await situacaoParaTela(ator, idNumero.parse(numeroId));
    const qrSvg = qr ? await QRCode.toString(qr, { type: "svg", margin: 1 }) : null;
    return { ok: true, dados: { estado, rotulo, detalhe, qrSvg } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

/** Pedido de exclusão de um titular (LGPD): apaga contato, conversas individuais e mensagens do telefone. */
export async function apagarDadosTelefoneAcao(dados: unknown): Promise<EstadoAcao<{ encontrado: boolean; mensagens: number; conversas: number }>> {
  try {
    const ator = await exigirPermissao("whatsapp:gerenciar_numeros");
    const { telefone } = esquemaApagarDadosTelefone.parse(dados);
    const r = await apagarDadosDoTelefone(telefone, ator.id);
    revalidatePath("/whatsapp", "layout");
    return {
      ok: true,
      mensagem: r.encontrado ? `Dados apagados: ${r.mensagens} mensagens e ${r.conversas} conversas.` : "Nenhum contato com este telefone.",
      dados: r,
    };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

const esquemaLimiteIa = z.object({
  limiteUsd: z
    .string({ error: "Informe o limite em dólares." })
    .trim()
    .min(1, "Informe o limite em dólares.")
    .transform((v) => Number(v.replace(",", ".")))
    .pipe(z.number({ error: "Informe um valor válido." }).finite().min(0, "O limite não pode ser negativo.").max(500, "O limite máximo é US$ 500.")),
});

/** Limite mensal da IA do WhatsApp, digitado em dólares (ex.: "12,34") e gravado em micro-dólares. Só o admin edita. */
export async function salvarLimiteIaWhatsappAcao(dados: unknown): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("whatsapp:gerenciar_numeros");
    if (ator.papel !== "admin") throw new ErroPermissao("whatsapp:gerenciar_numeros");
    const { limiteUsd } = esquemaLimiteIa.parse(dados);
    await salvarConfiguracaoWhatsapp({ limiteMensalMicroUsd: Math.round(limiteUsd * 1_000_000) }, ator.id);
    revalidatePath("/admin/saude");
    return { ok: true, mensagem: "Limite salvo." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
