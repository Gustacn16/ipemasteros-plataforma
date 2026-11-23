import { describe, expect, it } from "vitest";
import { mensalidades, montarAvisoVenda, webhookMascarado, webhookValido, whatsappLegivel, type VendaParaAviso } from "./aviso-venda";

const venda: VendaParaAviso = {
  produtoNome: "Pós-Graduação em Psiquiatria EAD",
  produtoTipo: "pos_graduacao",
  canalNome: "Meta Ads",
  dataEntradaLead: "2026-07-13",
  dataVenda: "2026-11-20",
  vendedorNome: "Fulano Vendedor",
  valorTotal: "7800.00",
  entrada: "0.00",
  numeroParcelas: 12,
  valorParcela: "650.00",
  metodoPagamento: "boleto",
  nomeCliente: "Cliente Exemplo",
  whatsappCliente: "62999047439",
  dataEntrega: "2026-11-23",
  observacoes: "Condição de Black",
  proximosPassos: "Fazer onboarding",
};

const ler = (v: VendaParaAviso) => JSON.parse(montarAvisoVenda(v).value) as Record<string, string>;

describe("montarAvisoVenda", () => {
  it("manda os campos soltos e também dentro de value, com a mensagem pronta no formato antigo", () => {
    const corpo = montarAvisoVenda(venda);
    expect(typeof corpo.value).toBe("string");
    const { value, ...soltos } = corpo;
    expect(JSON.parse(value)).toEqual(soltos);
    expect(corpo.Mensagem).toMatch(/^VENDA DE PÓS\/CURSO/);
    const c = ler(venda);
    expect(c).toMatchObject({
      Curso: "Pós-Graduação em Psiquiatria EAD",
      Canal: "Meta Ads",
      "Data de primeiro contato": "2026-07-13",
      Vendedor: "Fulano Vendedor",
      Valor: "R$ 7.800,00",
      "Forma de pagamento": "Boleto",
      Wpp: "+55 62 99904-7439",
      "Iniciará em": "2026-11-23",
      Mensalidades: "12x de R$ 650,00",
      "Próximas ações": "Fazer onboarding",
      Entrada: "",
    });
    expect(c.Mensagem).toBe(
      [
        "VENDA DE PÓS/CURSO 🔔🔔🔔🔔🔔🔔",
        "",
        "Curso: Pós-Graduação em Psiquiatria EAD",
        "Canal: Meta Ads",
        "Data de primeiro contato: 2026-07-13",
        "",
        "Vendedor: Fulano Vendedor",
        "Valor: R$ 7.800,00",
        "Forma de pagamento: Boleto",
        "",
        "Informações do comprador:",
        "Nome: Cliente Exemplo",
        "Wpp: +55 62 99904-7439",
        "Iniciará em: 2026-11-23",
        "Observações: Condição de Black",
        "Mensalidades: 12x de R$ 650,00",
        "",
        "Próximas ações: Fazer onboarding",
      ].join("\n"),
    );
  });

  it("paciente modelo tem outro título; entrada aparece quando há; campos vazios ficam em branco", () => {
    const c = ler({
      ...venda,
      produtoTipo: "paciente_modelo",
      entrada: "500.00",
      canalNome: null,
      dataEntradaLead: null,
      whatsappCliente: null,
      observacoes: null,
    });
    expect(c.Tipo).toBe("VENDA DE PACIENTE MODELO");
    expect(c.Mensagem).toContain("Entrada: R$ 500,00\nMensalidades");
    expect(c.Mensagem).toContain("Canal: \n");
    expect(c.Wpp).toBe("");
  });
});

describe("conversões", () => {
  it("WhatsApp legível com 10 ou 11 dígitos", () => {
    expect(whatsappLegivel("6299047439")).toBe("+55 62 9904-7439");
    expect(whatsappLegivel("62999047439")).toBe("+55 62 99904-7439");
    expect(whatsappLegivel(null)).toBe("");
  });

  it("à vista sem parcelas", () => {
    expect(mensalidades({ numeroParcelas: 0, valorParcela: "0.00" })).toBe("À vista");
  });
});

describe("webhook", () => {
  it("só aceita o webhook do Make em https", () => {
    expect(webhookValido("https://hook.us2.make.com/abc123")).toBe(true);
    expect(webhookValido("  https://hook.eu1.make.com/abc123  ")).toBe(true);
    expect(webhookValido("http://hook.us2.make.com/abc123")).toBe(false);
    expect(webhookValido("https://hook.us2.make.com/")).toBe(false);
    expect(webhookValido("https://hook.us2.make.com.evil.io/abc")).toBe(false);
    expect(webhookValido("https://127.0.0.1/abc")).toBe(false);
    expect(webhookValido("https://user:x@hook.us2.make.com/abc")).toBe(false);
    expect(webhookValido("nada")).toBe(false);
  });

  it("mostra o link sem expor o código", () => {
    expect(webhookMascarado("https://hook.us2.make.com/abcdefghij1234")).toBe("hook.us2.make.com/…1234");
  });
});
