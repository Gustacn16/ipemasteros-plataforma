import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { montarAvisoVenda, webhookMascarado, webhookValido, type VendaParaAviso } from "../regras/aviso-venda";
import { exigirPermissaoComercial } from "./acesso";

// Aviso de venda nova no grupo do C.S, pelo webhook do Make. O link do webhook
// funciona como uma senha (quem tem o link posta no grupo), então fica cifrado
// no banco e a tela só mostra o final dele.

const ID = "unica";
const PERMISSAO = "comercial:gerenciar_aviso_venda" as const;
const TEMPO_LIMITE_MS = 10_000;

function chave(): Buffer {
  const segredo = process.env.BETTER_AUTH_SECRET;
  if (!segredo) throw new Error("BETTER_AUTH_SECRET não configurado.");
  return Buffer.from(hkdfSync("sha256", segredo, "ipemaster-comercial", "webhook-venda:v1", 32));
}

function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return ["v1", iv.toString("base64url"), cifra.getAuthTag().toString("base64url"), dados.toString("base64url")].join(".");
}

function decifrar(cifrado: string): string | null {
  const [versao, ...partes] = cifrado.split(".");
  if (versao !== "v1" || partes.length !== 3) return null;
  const [iv, tag, dados] = partes.map((p) => Buffer.from(p, "base64url"));
  try {
    const decifra = createDecipheriv("aes-256-gcm", chave(), iv!, { authTagLength: 16 });
    decifra.setAuthTag(tag!);
    return Buffer.concat([decifra.update(dados!), decifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function lerConfiguracao() {
  const c = await prisma.configuracaoComercial.findUnique({ where: { id: ID } });
  const url = c?.webhookVendaCifrado ? decifrar(c.webhookVendaCifrado) : null;
  return { url, ativo: c?.avisoVendaAtivo ?? true, atualizadoEm: c?.atualizadoEm ?? null };
}

export async function situacaoAvisoVenda(ator: UsuarioAtual) {
  exigirPermissaoComercial(ator, PERMISSAO);
  const { url, ativo, atualizadoEm } = await lerConfiguracao();
  return { configurado: Boolean(url), mascarado: url ? webhookMascarado(url) : null, ativo, atualizadoEm };
}
export type SituacaoAvisoVenda = Awaited<ReturnType<typeof situacaoAvisoVenda>>;

/** Salva o link (quando vier) e liga/desliga o aviso. Link vazio mantém o atual. */
export async function salvarAvisoVenda(ator: UsuarioAtual, dados: { url: string | null; ativo: boolean }) {
  exigirPermissaoComercial(ator, PERMISSAO);
  const url = dados.url?.trim() || null;
  if (url && !webhookValido(url)) throw new ErroNegocio("Cole o link do webhook do Make (começa com https://hook. e termina em make.com/...).");
  const campos = { avisoVendaAtivo: dados.ativo, atualizadoPorId: ator.id, ...(url ? { webhookVendaCifrado: cifrar(url) } : {}) };
  await prisma.configuracaoComercial.upsert({ where: { id: ID }, create: { id: ID, ...campos }, update: campos });
  // Nunca o link na auditoria.
  await registrarAuditoria({
    usuarioId: ator.id,
    acao: "comercial.aviso_venda_configurado",
    entidade: "ConfiguracaoComercial",
    entidadeId: ID,
    diff: { ativo: dados.ativo, linkTrocado: Boolean(url) },
  });
}

async function postar(url: string, venda: VendaParaAviso): Promise<boolean> {
  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(montarAvisoVenda(venda)),
      redirect: "error",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
    if (!resposta.ok) console.error(`[aviso-venda] o Make respondeu ${resposta.status}`);
    return resposta.ok;
  } catch (erro) {
    // Sem dados da venda no log.
    console.error("[aviso-venda] falha ao chamar o Make:", erro instanceof Error ? erro.name : "erro");
    return false;
  }
}

const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Avisa o grupo de uma venda recém-criada. Roda depois da resposta (via
 * `after`), então falhar aqui nunca desfaz nem atrasa o registro da venda.
 */
export async function avisarVendaNova(vendaId: string): Promise<void> {
  const { url, ativo } = await lerConfiguracao();
  if (!url || !ativo) return;
  const v = await prisma.venda.findUnique({
    where: { id: vendaId },
    include: { produto: { select: { nome: true, tipo: true } }, vendedor: { select: { nome: true } }, canal: { select: { nome: true } } },
  });
  if (!v || v.excluidoEm) return;
  await postar(url, {
    produtoNome: v.produto.nome,
    produtoTipo: v.produto.tipo,
    canalNome: v.canal?.nome ?? null,
    dataEntradaLead: dia(v.dataEntradaLead),
    dataVenda: dia(v.dataVenda)!,
    vendedorNome: v.vendedor.nome,
    valorTotal: v.valorTotal.toFixed(2),
    entrada: v.entrada.toFixed(2),
    numeroParcelas: v.numeroParcelas,
    valorParcela: v.valorParcela.toFixed(2),
    metodoPagamento: v.metodoPagamento,
    nomeCliente: v.nomeCliente,
    whatsappCliente: v.whatsappCliente,
    dataEntrega: dia(v.dataEntrega),
    observacoes: v.observacoes,
    proximosPassos: v.proximosPassos,
  });
}

/** Manda uma venda de mentira, para conferir a mensagem no grupo. */
export async function enviarTesteAvisoVenda(ator: UsuarioAtual): Promise<void> {
  exigirPermissaoComercial(ator, PERMISSAO);
  const { url } = await lerConfiguracao();
  if (!url) throw new ErroNegocio("Cole e salve o link do webhook antes de testar.");
  const hoje = new Date().toISOString().slice(0, 10);
  const ok = await postar(url, {
    produtoNome: "TESTE — ignore esta mensagem",
    produtoTipo: "pos_graduacao",
    canalNome: "Teste",
    dataEntradaLead: hoje,
    dataVenda: hoje,
    vendedorNome: ator.nome,
    valorTotal: "1000.00",
    entrada: "0.00",
    numeroParcelas: 10,
    valorParcela: "100.00",
    metodoPagamento: "pix",
    nomeCliente: "Cliente de teste",
    whatsappCliente: null,
    dataEntrega: hoje,
    observacoes: "Mensagem de teste do IPEMaster OS",
    proximosPassos: null,
  });
  if (!ok) throw new ErroNegocio("O Make não aceitou o envio. Confira se o cenário está ligado e se o link está certo.");
}
