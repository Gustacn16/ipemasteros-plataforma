import { valorDaMeta } from "../regras/meta";
import type { ExportacaoLovable, VendaLovable } from "./ler";

// Planeja a importação do histórico da plataforma antiga (Lovable) sem tocar
// no banco: decide o que criar e o que pular. Rodar de novo não duplica,
// porque os ids novos são derivados dos ids antigos (prefixo "lovable-").

export const PREFIXO = "lovable-";
export const idVenda = (idAntigo: string) => `${PREFIXO}${idAntigo}`;
export const idMeta = (idAntigo: string) => `${PREFIXO}${idAntigo}`;
export const idVendedorNovo = (userIdAntigo: string) => `${PREFIXO}${userIdAntigo}`;
export const idCanalNovo = (nome: string) => `${PREFIXO}canal-${normalizar(nome).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
export const chaveMeta = (mes: string, produtoId: string, vendedorId: string) => `${mes}|${produtoId}|${vendedorId}`;

export type Metodo = "pix" | "cartao" | "boleto" | "transferencia";

export type Contexto = {
  /** Inclui os excluídos: venda antiga de produto excluído volta a apontar para ele. */
  produtos: { id: string; nome: string; excluido?: boolean }[];
  usuarios: { id: string; nome: string; apelido: string | null }[];
  canais: { id: string; nome: string }[];
  /** Vendas que já vieram de uma importação anterior (id com o prefixo). */
  idsVendasImportadas: Set<string>;
  /** Vendas registradas direto no sistema novo, para não contar a mesma venda duas vezes. */
  vendasDoSistema: { produtoId: string; dataVenda: string; nomeCliente: string }[];
  chavesMetas: Set<string>;
  idsMetasImportadas: Set<string>;
  /** Preço usado nas metas do sistema novo (oferta padrão), por produto. */
  precoPorProduto: Record<string, string | null>;
};

export type VendaPlanejada = {
  id: string;
  produtoId: string;
  vendedorId: string;
  criadoPorId: string;
  dataVenda: string;
  dataEntradaLead: string | null;
  nomeCliente: string;
  whatsappCliente: string | null;
  canalId: string | null;
  dataEntrega: string | null;
  metodoPagamento: Metodo;
  entrada: string;
  numeroParcelas: number;
  valorParcela: string;
  primeiroVencimento: string | null;
  valorTotal: string;
  observacoes: string | null;
  proximosPassos: string | null;
};

export type MetaPlanejada = { id: string; mes: string; produtoId: string; vendedorId: string; valorAlvo: string; quantidadeAlvo: number };

export type Plano = {
  erros: string[];
  /** Produtos excluídos que têm vendas ou metas antigas: voltam como inativos (regras 2 e 3). */
  produtosRestaurar: { id: string; nome: string }[];
  vendedores: { nomeAntigo: string; id: string; nomeNovo: string; novo: boolean }[];
  canaisNovos: { id: string; nome: string }[];
  vendas: VendaPlanejada[];
  metas: MetaPlanejada[];
  contagens: {
    vendasNoArquivo: number;
    vendasJaImportadas: number;
    vendasCanceladas: number;
    vendasRegistradasNoSistema: number;
    metasNoArquivo: number;
    metasJaExistentes: number;
    metasZeradas: number;
  };
  avisos: string[];
};

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const tokens = (texto: string) => normalizar(texto).split(/[^a-z0-9]+/).filter(Boolean);

const METODOS: Record<string, Metodo> = {
  pix: "pix",
  boleto: "boleto",
  "cartao de credito": "cartao",
  "cartao de debito": "cartao",
  cartao: "cartao",
  transferencia: "transferencia",
  ted: "transferencia",
};

/** Forma de pagamento antiga → nova. `null` quando não informada ou desconhecida. */
export function metodoDe(texto: string | null): Metodo | null {
  return texto ? (METODOS[normalizar(texto)] ?? null) : null;
}

/** WhatsApp só com dígitos e sem o 55. Número fora do tamanho vira nulo. */
export function whatsappDe(texto: string | null): string | null {
  if (!texto) return null;
  let digitos = texto.replace(/\D/g, "");
  if (digitos.length >= 12 && digitos.startsWith("55")) digitos = digitos.slice(2);
  return digitos.length >= 10 && digitos.length <= 11 ? digitos : null;
}

const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => (c / 100).toFixed(2);

/**
 * Acha o usuário do sistema novo pelo nome (ou apelido) do vendedor antigo, nesta ordem:
 * nome igual; igual sem espaços ("PedroPrado"); todas as palavras do antigo no novo;
 * todas as palavras do novo no antigo ("Luisa" ↔ "Luisa Santos"). Sem candidato único, `null`.
 */
export function acharUsuario(nomeAntigo: string, usuarios: Contexto["usuarios"]): Contexto["usuarios"][number] | null {
  const alvo = normalizar(nomeAntigo);
  if (!alvo) return null;
  const nomes = (u: Contexto["usuarios"][number]) => [u.nome, u.apelido ?? ""].filter((n) => normalizar(n));
  const compacto = (t: string) => normalizar(t).replace(/[^a-z0-9]/g, "");
  const procurados = tokens(nomeAntigo);
  const criterios: ((u: Contexto["usuarios"][number]) => boolean)[] = [
    (u) => nomes(u).some((n) => normalizar(n) === alvo),
    (u) => nomes(u).some((n) => compacto(n) === compacto(nomeAntigo)),
    (u) => nomes(u).some((n) => procurados.every((t) => tokens(n).includes(t))),
    (u) => nomes(u).some((n) => tokens(n).every((t) => procurados.includes(t))),
  ];
  for (const criterio of criterios) {
    const achados = usuarios.filter(criterio);
    if (achados.length === 1) return achados[0];
    if (achados.length > 1) return null;
  }
  return null;
}

export function planejarImportacao(dados: ExportacaoLovable, ctx: Contexto): Plano {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Produtos: pelo nome do produto antigo (as vendas guardam o id).
  // Prefere o produto não excluído quando houver dois com o mesmo nome.
  const produtoNovo = new Map<string, Contexto["produtos"][number]>();
  for (const p of dados.products) {
    const mesmos = ctx.produtos.filter((n) => normalizar(n.nome) === normalizar(p.name));
    const achado = mesmos.find((n) => !n.excluido) ?? mesmos[0];
    if (achado) produtoNovo.set(p.id, achado);
  }
  const usados = new Set([...dados.sales.map((v) => v.product_id), ...dados.sales_seller_product_targets.map((m) => m.product_id)]);
  for (const id of usados) {
    if (produtoNovo.has(id)) continue;
    const nome = dados.products.find((p) => p.id === id)?.name;
    erros.push(nome ? `O produto “${nome}” não existe no catálogo novo.` : "Há venda ou meta de um produto que não veio no arquivo.");
  }

  // Vendedores: usuário já importado antes, ou pelo nome; senão, um vendedor inativo novo.
  const nomeDoPerfil = new Map(dados.profiles.map((p) => [p.user_id, p.full_name.trim()]));
  const vendedores = new Map<string, Plano["vendedores"][number]>();
  const vendedorDe = (userId: string): string => {
    const pronto = vendedores.get(userId);
    if (pronto) return pronto.id;
    const nomeAntigo = nomeDoPerfil.get(userId) || "Vendedor da plataforma antiga";
    const jaCriado = ctx.usuarios.find((u) => u.id === idVendedorNovo(userId));
    const achado = jaCriado ?? acharUsuario(nomeAntigo, ctx.usuarios);
    const item = achado
      ? { nomeAntigo, id: achado.id, nomeNovo: achado.nome, novo: false }
      : { nomeAntigo, id: idVendedorNovo(userId), nomeNovo: nomeAntigo, novo: true };
    vendedores.set(userId, item);
    return item.id;
  };

  // Canais: pelo nome, sem acento nem maiúscula; os que faltam são criados.
  const canaisNovos = new Map<string, { id: string; nome: string }>();
  const canalDe = (nome: string | null): string | null => {
    if (!nome) return null;
    const existente = ctx.canais.find((c) => normalizar(c.nome) === normalizar(nome));
    if (existente) return existente.id;
    const id = idCanalNovo(nome);
    if (!canaisNovos.has(id)) canaisNovos.set(id, { id, nome: nome.slice(0, 60) });
    return id;
  };

  const doSistema = new Set(ctx.vendasDoSistema.map((v) => `${v.produtoId}|${v.dataVenda}|${normalizar(v.nomeCliente)}`));
  const contagens: Plano["contagens"] = {
    vendasNoArquivo: dados.sales.length,
    vendasJaImportadas: 0,
    vendasCanceladas: 0,
    vendasRegistradasNoSistema: 0,
    metasNoArquivo: dados.sales_seller_product_targets.length,
    metasJaExistentes: 0,
    metasZeradas: 0,
  };

  let semPagamento = 0;
  let leadDepois = 0;
  let totalDiferente = 0;
  const vendas: VendaPlanejada[] = [];
  for (const v of dados.sales) {
    const produtoId = produtoNovo.get(v.product_id)?.id;
    if (!produtoId) continue;
    if (normalizar(v.status).startsWith("cancel")) {
      contagens.vendasCanceladas++;
      continue;
    }
    if (ctx.idsVendasImportadas.has(idVenda(v.id))) {
      contagens.vendasJaImportadas++;
      continue;
    }
    const nomeCliente = (v.customer_name ?? "Cliente não informado").slice(0, 150);
    if (doSistema.has(`${produtoId}|${v.sale_date}|${normalizar(nomeCliente)}`)) {
      contagens.vendasRegistradasNoSistema++;
      continue;
    }
    const metodo = metodoDe(v.payment_method);
    if (!metodo) semPagamento++;
    if (v.lead_entry_date && v.lead_entry_date > v.sale_date) leadDepois++;
    const { entrada, parcela, total, confere } = valores(v);
    if (!confere) totalDiferente++;
    const vendedorId = vendedorDe(v.seller_id);
    vendas.push({
      id: idVenda(v.id),
      produtoId,
      vendedorId,
      criadoPorId: v.created_by && nomeDoPerfil.has(v.created_by) ? vendedorDe(v.created_by) : vendedorId,
      dataVenda: v.sale_date,
      dataEntradaLead: v.lead_entry_date,
      nomeCliente,
      whatsappCliente: whatsappDe(v.whatsapp),
      canalId: canalDe(v.channel),
      dataEntrega: v.delivery_date,
      metodoPagamento: metodo ?? "pix",
      entrada,
      numeroParcelas: v.installments_count,
      valorParcela: parcela,
      primeiroVencimento: v.first_due_date,
      valorTotal: total,
      observacoes: juntar(v.notes, metodo ? null : "Forma de pagamento não informada na plataforma antiga."),
      proximosPassos: v.next_actions,
    });
  }
  if (semPagamento) avisos.push(`${semPagamento} venda(s) sem forma de pagamento: entram como Pix, com uma observação.`);
  if (leadDepois) avisos.push(`${leadDepois} venda(s) com a data do lead depois da data da venda: mantidas como vieram.`);
  if (totalDiferente) avisos.push(`${totalDiferente} venda(s) com valor total diferente de entrada + parcelas: vale o valor recalculado.`);

  const metas: MetaPlanejada[] = [];
  const vistas = new Set<string>();
  for (const m of dados.sales_seller_product_targets) {
    const produtoId = produtoNovo.get(m.product_id)?.id;
    if (!produtoId) continue;
    if (m.sales_count === 0) {
      contagens.metasZeradas++;
      continue;
    }
    const mes = `${m.year}-${String(m.month).padStart(2, "0")}-01`;
    const vendedorId = vendedorDe(m.seller_id);
    const chave = chaveMeta(mes, produtoId, vendedorId);
    if (ctx.idsMetasImportadas.has(idMeta(m.id)) || ctx.chavesMetas.has(chave) || vistas.has(chave)) {
      contagens.metasJaExistentes++;
      continue;
    }
    vistas.add(chave);
    // Ticket próprio da meta, quando houver; senão, o mesmo preço que o sistema novo usa nas metas.
    const ticket = m.ticket_override && m.ticket_override > 0 ? m.ticket_override.toFixed(2) : (ctx.precoPorProduto[produtoId] ?? null);
    metas.push({ id: idMeta(m.id), mes, produtoId, vendedorId, quantidadeAlvo: m.sales_count, valorAlvo: valorDaMeta(ticket, m.sales_count) });
  }

  const comHistorico = new Set([...vendas.map((v) => v.produtoId), ...metas.map((m) => m.produtoId)]);
  const produtosRestaurar = [...new Map([...produtoNovo.values()].filter((p) => p.excluido && comHistorico.has(p.id)).map((p) => [p.id, { id: p.id, nome: p.nome }])).values()];

  return {
    erros,
    produtosRestaurar,
    vendedores: [...vendedores.values()],
    canaisNovos: [...canaisNovos.values()],
    vendas,
    metas,
    contagens,
    avisos,
  };
}

/** Entrada, parcela e total (regra 6: total = entrada + parcelas × parcela, em centavos). */
function valores(v: VendaLovable) {
  const entrada = centavos(v.down_payment);
  const parcela = centavos(v.installment_value);
  const total = entrada + v.installments_count * parcela;
  return { entrada: reais(entrada), parcela: reais(parcela), total: reais(total), confere: total === centavos(v.value) };
}

function juntar(...partes: (string | null)[]): string | null {
  const texto = partes.filter(Boolean).join("\n\n");
  return texto || null;
}
