import { describe, expect, it } from "vitest";
import { lerExportacao, type ExportacaoLovable } from "./ler";
import { acharUsuario, chaveMeta, idCanalNovo, idVenda, metodoDe, planejarImportacao, whatsappDe, type Contexto } from "./planejar";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const PRODUTO = U(1);
const ARTHUR = U(2);
const NOVATO = U(3);

const venda = (n: number, extra: Partial<ExportacaoLovable["sales"][number]> = {}): ExportacaoLovable["sales"][number] => ({
  id: U(100 + n),
  sale_date: "2026-07-10",
  lead_entry_date: null,
  seller_id: ARTHUR,
  product_id: PRODUTO,
  value: 6000,
  down_payment: 500,
  installment_value: 550,
  installments_count: 10,
  payment_method: "Pix",
  customer_name: `Cliente ${n}`,
  channel: "Meta Ads",
  delivery_date: null,
  first_due_date: null,
  notes: null,
  next_actions: null,
  whatsapp: null,
  created_by: ARTHUR,
  status: "ativa",
  ...extra,
});

const dados = (parcial: Partial<ExportacaoLovable> = {}): ExportacaoLovable => ({
  sales: [venda(1)],
  sales_seller_product_targets: [],
  products: [{ id: PRODUTO, name: "Transplante Capilar" }],
  profiles: [
    { user_id: ARTHUR, full_name: "Arthur Bernades" },
    { user_id: NOVATO, full_name: "Luisa Santos" },
  ],
  ...parcial,
});

const ctx = (parcial: Partial<Contexto> = {}): Contexto => ({
  produtos: [{ id: "prod_tc", nome: "Transplante Capilar" }],
  usuarios: [{ id: "u_arthur", nome: "Arthur Bernardes", apelido: "Arthur Bernades" }],
  canais: [{ id: "c_meta", nome: "meta ads" }],
  idsVendasImportadas: new Set(),
  vendasDoSistema: [],
  chavesMetas: new Set(),
  idsMetasImportadas: new Set(),
  precoPorProduto: { prod_tc: "6000.00" },
  ...parcial,
});

describe("conversões", () => {
  it("forma de pagamento antiga vira a nova", () => {
    expect(metodoDe("Cartão de Crédito")).toBe("cartao");
    expect(metodoDe("Boleto")).toBe("boleto");
    expect(metodoDe("pix")).toBe("pix");
    expect(metodoDe(null)).toBeNull();
    expect(metodoDe("Permuta")).toBeNull();
  });

  it("WhatsApp fica só com dígitos e sem o 55", () => {
    expect(whatsappDe("+55 (34) 99999-1234")).toBe("34999991234");
    expect(whatsappDe("553499991234")).toBe("3499991234");
    expect(whatsappDe("34999991234")).toBe("34999991234");
    expect(whatsappDe("123")).toBeNull();
    expect(whatsappDe(null)).toBeNull();
  });

  it("acha o vendedor pelo nome, apelido ou parte do nome; ambíguo não casa", () => {
    const usuarios = [
      { id: "a", nome: "Ketelin Souza", apelido: null },
      { id: "b", nome: "Pedro Prado", apelido: null },
      { id: "c", nome: "Pedro Magalhães", apelido: null },
    ];
    expect(acharUsuario("Ketelin", usuarios)?.id).toBe("a");
    expect(acharUsuario("pedro prado", usuarios)?.id).toBe("b");
    expect(acharUsuario("Pedro", usuarios)).toBeNull();
    expect(acharUsuario("", usuarios)).toBeNull();
  });
});

describe("planejarImportacao", () => {
  it("monta a venda com produto, vendedor e canal do sistema novo", () => {
    const p = planejarImportacao(dados(), ctx());
    expect(p.erros).toEqual([]);
    expect(p.vendas).toHaveLength(1);
    expect(p.vendas[0]).toMatchObject({
      id: idVenda(U(101)),
      produtoId: "prod_tc",
      vendedorId: "u_arthur",
      criadoPorId: "u_arthur",
      canalId: "c_meta",
      metodoPagamento: "pix",
      entrada: "500.00",
      numeroParcelas: 10,
      valorParcela: "550.00",
      valorTotal: "6000.00",
    });
    expect(p.vendedores).toEqual([{ nomeAntigo: "Arthur Bernades", id: "u_arthur", nomeNovo: "Arthur Bernardes", novo: false }]);
  });

  it("rodar de novo não duplica: venda já importada é pulada", () => {
    const p = planejarImportacao(dados(), ctx({ idsVendasImportadas: new Set([idVenda(U(101))]) }));
    expect(p.vendas).toEqual([]);
    expect(p.contagens.vendasJaImportadas).toBe(1);
  });

  it("venda já registrada no sistema novo (mesmo produto, dia e cliente) é pulada", () => {
    const p = planejarImportacao(
      dados(),
      ctx({ vendasDoSistema: [{ produtoId: "prod_tc", dataVenda: "2026-07-10", nomeCliente: "CLIENTE 1" }] }),
    );
    expect(p.vendas).toEqual([]);
    expect(p.contagens.vendasRegistradasNoSistema).toBe(1);
  });

  it("vendedor sem usuário no sistema novo vira vendedor novo com id fixo", () => {
    const p = planejarImportacao(dados({ sales: [venda(1, { seller_id: NOVATO, created_by: null })] }), ctx());
    expect(p.vendedores).toEqual([{ nomeAntigo: "Luisa Santos", id: `lovable-${NOVATO}`, nomeNovo: "Luisa Santos", novo: true }]);
    expect(p.vendas[0].vendedorId).toBe(`lovable-${NOVATO}`);
    expect(p.vendas[0].criadoPorId).toBe(`lovable-${NOVATO}`);
  });

  it("vendedor criado numa importação anterior é reaproveitado", () => {
    const usuarios = [...ctx().usuarios, { id: `lovable-${NOVATO}`, nome: "Luisa Santos", apelido: null }];
    const p = planejarImportacao(dados({ sales: [venda(1, { seller_id: NOVATO })] }), ctx({ usuarios }));
    expect(p.vendedores[0]).toMatchObject({ id: `lovable-${NOVATO}`, novo: false });
  });

  it("canal que falta é criado uma vez só; sem canal fica nulo", () => {
    const p = planejarImportacao(
      dados({ sales: [venda(1, { channel: "Orgânico" }), venda(2, { channel: "organico" }), venda(3, { channel: null })] }),
      ctx(),
    );
    expect(p.canaisNovos).toEqual([{ id: idCanalNovo("Orgânico"), nome: "Orgânico" }]);
    expect(p.vendas.map((v) => v.canalId)).toEqual([idCanalNovo("Orgânico"), idCanalNovo("Orgânico"), null]);
  });

  it("sem forma de pagamento entra como Pix com observação e aviso", () => {
    const p = planejarImportacao(dados({ sales: [venda(1, { payment_method: null, notes: "Pagou na hora" })] }), ctx());
    expect(p.vendas[0].metodoPagamento).toBe("pix");
    expect(p.vendas[0].observacoes).toBe("Pagou na hora\n\nForma de pagamento não informada na plataforma antiga.");
    expect(p.avisos[0]).toMatch(/1 venda\(s\) sem forma de pagamento/);
  });

  it("cancelada não entra", () => {
    const p = planejarImportacao(dados({ sales: [venda(1, { status: "cancelada" })] }), ctx());
    expect(p.vendas).toEqual([]);
    expect(p.contagens.vendasCanceladas).toBe(1);
  });

  it("total sempre recalculado em centavos", () => {
    const p = planejarImportacao(
      dados({ sales: [venda(1, { value: 999, down_payment: 0.1, installment_value: 0.2, installments_count: 3 })] }),
      ctx(),
    );
    expect(p.vendas[0].valorTotal).toBe("0.70");
    expect(p.avisos.some((a) => a.includes("valor recalculado"))).toBe(true);
  });

  it("produto que não existe no catálogo novo bloqueia", () => {
    const p = planejarImportacao(dados(), ctx({ produtos: [] }));
    expect(p.erros).toEqual(["O produto “Transplante Capilar” não existe no catálogo novo."]);
  });

  describe("metas", () => {
    const meta = (extra: Partial<ExportacaoLovable["sales_seller_product_targets"][number]> = {}) => ({
      id: U(500),
      year: 2026,
      month: 7,
      seller_id: ARTHUR,
      product_id: PRODUTO,
      sales_count: 3,
      ticket_override: null,
      ...extra,
    });

    it("valor = quantidade × preço do produto; ticket próprio prevalece", () => {
      const p = planejarImportacao(dados({ sales: [], sales_seller_product_targets: [meta(), meta({ id: U(501), month: 8, ticket_override: 5000 })] }), ctx());
      expect(p.metas).toEqual([
        { id: `lovable-${U(500)}`, mes: "2026-07-01", produtoId: "prod_tc", vendedorId: "u_arthur", quantidadeAlvo: 3, valorAlvo: "18000.00" },
        { id: `lovable-${U(501)}`, mes: "2026-08-01", produtoId: "prod_tc", vendedorId: "u_arthur", quantidadeAlvo: 3, valorAlvo: "15000.00" },
      ]);
    });

    it("não sobrescreve meta que já existe no mês, nem grava meta zerada", () => {
      const p = planejarImportacao(
        dados({ sales: [], sales_seller_product_targets: [meta(), meta({ id: U(502), month: 9, sales_count: 0 })] }),
        ctx({ chavesMetas: new Set([chaveMeta("2026-07-01", "prod_tc", "u_arthur")]) }),
      );
      expect(p.metas).toEqual([]);
      expect(p.contagens).toMatchObject({ metasJaExistentes: 1, metasZeradas: 1 });
    });
  });
});

describe("lerExportacao", () => {
  it("aceita o formato e recusa arquivo estranho sem mostrar dados", () => {
    expect(lerExportacao(dados()).ok).toBe(true);
    const r = lerExportacao({ sales: [{ id: "x" }], products: [], profiles: [] });
    expect(r).toEqual({ ok: false, erro: "Arquivo fora do formato esperado (sales.0.id)." });
  });

  it("aceita números como texto e campos nulos", () => {
    const r = lerExportacao({ ...dados(), sales: [{ ...venda(1), value: "6000.00", whatsapp: undefined, notes: "  " }] });
    expect(r.ok && r.dados.sales[0]).toMatchObject({ value: 6000, whatsapp: null, notes: null });
  });
});
