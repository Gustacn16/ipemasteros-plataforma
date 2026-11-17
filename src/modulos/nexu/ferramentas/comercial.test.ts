import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioAtual } from "@/lib/sessao";

const mocks = vi.hoisted(() => ({ vendas: vi.fn(), metas: vi.fn(), produtos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/modulos/comercial/servicos/vendas", () => ({ listarVendas: mocks.vendas }));
vi.mock("@/modulos/comercial/servicos/metas", () => ({ obterVisaoMetas: mocks.metas }));
vi.mock("@/modulos/comercial/servicos/produtos", () => ({ listarProdutos: mocks.produtos }));

const { ferramentaVendasEMetas, ferramentaProdutos } = await import("./comercial");
const { ErroNegocio } = await import("@/lib/erros");

const ator = { id: "v1", nome: "Caio", papel: "comercial" } as UsuarioAtual;
const ctx = { conversaId: "c1", toolUseId: "t1" };

const venda = (id: string, vendedorId: string) => ({
  id,
  vendedorId,
  dataVenda: "2026-11-05",
  nomeCliente: "Fulana Cliente",
  whatsappCliente: "11999998888",
  observacoes: "segredo",
  proximosPassos: "ligar",
  produtoNome: "Pós",
  ofertaNome: null,
  vendedorNome: vendedorId === "v1" ? "Caio" : "Outra",
  canalNome: "Instagram",
  metodoPagamento: "pix",
  valorTotal: "1000.00",
});

beforeEach(() => {
  mocks.vendas.mockReset();
  mocks.metas.mockReset();
  mocks.metas.mockResolvedValue({ equipe: false, total: {}, vendedores: [{ id: "v1", nome: "Caio", foto: null }] });
});

describe("vendas_e_metas", () => {
  it("o comercial com vendedorId de outra pessoa recebe só as próprias vendas e nada de WhatsApp", async () => {
    // Como o serviço real: sem ver_equipe, ignora o filtro e devolve só as do ator.
    mocks.vendas.mockImplementation(async (a: UsuarioAtual) => ({
      vendas: [venda("s1", "v1"), venda("s2", "v2")].filter((v) => v.vendedorId === a.id),
      total: "1000.00",
      equipe: false,
    }));
    const r = await ferramentaVendasEMetas.executar(ator, { mes: "2026-11", vendedorId: "v2" }, ctx);
    expect(mocks.vendas.mock.calls[0][1]).toMatchObject({ periodo: "intervalo", de: "2026-11-01", ate: "2026-11-30", vendedor: "v2" });
    const json = JSON.stringify(r);
    expect(json).not.toContain("whatsapp");
    expect(json).not.toContain("11999998888");
    expect(json).not.toContain("segredo");
    expect(json).not.toContain("Fulana Cliente");
    expect(json).not.toContain("cliente");
    const { vendas, porVendedor } = r as { vendas: { itens: { vendedor: string }[] }; porVendedor: { nome: string }[] };
    expect(vendas.itens.map((v) => v.vendedor)).toEqual(["Caio"]);
    expect(porVendedor).toEqual([{ nome: "Caio", quantidade: 1, valorTotal: "1000.00" }]);
  });

  it("rejeita mês inválido", async () => {
    await expect(ferramentaVendasEMetas.executar(ator, { mes: "novembro" }, ctx)).rejects.toBeInstanceOf(ErroNegocio);
  });
});

describe("produtos", () => {
  it("lista os ativos com a oferta padrão e sem campos internos", async () => {
    mocks.produtos.mockResolvedValue([
      {
        id: "p1",
        nome: "Pós",
        tipo: "pos",
        area: "Saúde",
        sku: "X1",
        ativo: true,
        ofertaPadrao: { precoCheio: "9000.00", parcelas: 18, valorParcela: "500.00" },
        quantidadeOfertas: 2,
        quantidadeLinks: 1,
      },
    ]);
    const r = (await ferramentaProdutos.executar(ator, {}, ctx)) as { itens: unknown[] };
    expect(mocks.produtos.mock.calls[0][1]).toEqual({ situacao: "ativos", busca: undefined });
    expect(r.itens).toEqual([
      { id: "p1", nome: "Pós", tipo: "pos", area: "Saúde", ofertaPadrao: { precoCheio: "9000.00", parcelas: 18, valorParcela: "500.00" } },
    ]);
  });
});
