import { z } from "zod";

// Lê o `dados-comerciais.json` exportado da plataforma antiga (Lovable).
// Só as tabelas que viram dados do Comercial: vendas, metas por vendedor,
// produtos (para achar o produto novo pelo nome) e o mapa de vendedores.

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const diaOuNulo = dia.nullable().optional().transform((v) => v ?? null);
const textoOuNulo = z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));
const numero = z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)]);

const venda = z.object({
  id: uuid,
  sale_date: dia,
  lead_entry_date: diaOuNulo,
  seller_id: uuid,
  product_id: uuid,
  value: numero,
  down_payment: numero,
  installment_value: numero,
  installments_count: z.number().int().min(0),
  payment_method: textoOuNulo,
  customer_name: textoOuNulo,
  channel: textoOuNulo,
  delivery_date: diaOuNulo,
  first_due_date: diaOuNulo,
  notes: textoOuNulo,
  next_actions: textoOuNulo,
  whatsapp: textoOuNulo,
  created_by: uuid.nullable().optional().transform((v) => v ?? null),
  status: z.string(),
});

const metaVendedor = z.object({
  id: uuid,
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  seller_id: uuid,
  product_id: uuid,
  sales_count: z.number().int().min(0),
  ticket_override: numero.nullable().optional().transform((v) => v ?? null),
});

const produto = z.object({ id: uuid, name: z.string().min(1) });
const perfil = z.object({ user_id: uuid, full_name: z.string() });

export const esquemaExportacao = z.object({
  sales: z.array(venda),
  sales_seller_product_targets: z.array(metaVendedor).default([]),
  products: z.array(produto),
  profiles: z.array(perfil),
});

export type ExportacaoLovable = z.infer<typeof esquemaExportacao>;
export type VendaLovable = ExportacaoLovable["sales"][number];
export type MetaLovable = ExportacaoLovable["sales_seller_product_targets"][number];

/** Valida o arquivo. Mensagem curta, sem dado de cliente. */
export function lerExportacao(json: unknown): { ok: true; dados: ExportacaoLovable } | { ok: false; erro: string } {
  const r = esquemaExportacao.safeParse(json);
  if (r.success) return { ok: true, dados: r.data };
  const primeiro = r.error.issues[0];
  return { ok: false, erro: `Arquivo fora do formato esperado (${primeiro.path.join(".") || "raiz"}).` };
}
