import { describe, expect, it } from "vitest";
import { esquemaFiltrosVendas, esquemaVenda } from "./venda";

const base = {
  produtoId: "p1",
  vendedorId: "u1",
  dataVenda: "2026-11-02",
  nomeCliente: "Dr. João Silva",
  metodoPagamento: "pix",
  entrada: "2.000,00",
  numeroParcelas: "12",
  valorParcela: "5.800,00",
};

const erroEm = (dados: Record<string, unknown>, campo: string) => {
  const r = esquemaVenda.safeParse(dados);
  return r.success ? undefined : r.error.issues.find((i) => i.path[0] === campo)?.message;
};

describe("esquemaVenda", () => {
  it("lê valores, parcelas e campos vazios", () => {
    const v = esquemaVenda.parse({ ...base, ofertaId: "", canalId: "", whatsappCliente: "", observacoes: "" });
    expect(v).toMatchObject({
      entrada: "2000.00",
      numeroParcelas: 12,
      valorParcela: "5800.00",
      ofertaId: null,
      canalId: null,
      whatsappCliente: null,
      observacoes: null,
      dataEntradaLead: null,
    });
  });

  it("guarda o WhatsApp só com dígitos, sem o 55", () => {
    expect(esquemaVenda.parse({ ...base, whatsappCliente: "(11) 99999-9999" }).whatsappCliente).toBe("11999999999");
    expect(esquemaVenda.parse({ ...base, whatsappCliente: "+55 61 99999-0000" }).whatsappCliente).toBe("61999990000");
    expect(erroEm({ ...base, whatsappCliente: "123" }, "whatsappCliente")).toBe("WhatsApp inválido");
  });

  it("recusa venda com valor total zero", () => {
    expect(erroEm({ ...base, entrada: "", numeroParcelas: "", valorParcela: "" }, "entrada")).toBe("Informe o valor da venda");
  });

  it("recusa lead que entrou depois da venda", () => {
    expect(erroEm({ ...base, dataEntradaLead: "2026-11-05" }, "dataEntradaLead")).toBe("O lead não pode ter entrado depois da venda");
    expect(esquemaVenda.safeParse({ ...base, dataEntradaLead: "2026-10-20" }).success).toBe(true);
  });

  it("recusa mais de 60 parcelas, método desconhecido e venda sem data", () => {
    expect(esquemaVenda.safeParse({ ...base, numeroParcelas: "61" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...base, metodoPagamento: "dinheiro" }).success).toBe(false);
    expect(esquemaVenda.safeParse({ ...base, dataVenda: "" }).success).toBe(false);
  });
});

describe("esquemaFiltrosVendas", () => {
  it("padrão: este mês", () => {
    expect(esquemaFiltrosVendas.parse({})).toMatchObject({ periodo: "mes" });
  });
});
