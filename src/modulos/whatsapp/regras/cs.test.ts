import { describe, expect, it } from "vitest";
import { DIAS_SEM_CONTATO, rotuloSituacaoCs, situacaoVendaCs } from "./cs";

const venda = new Date("2026-11-10T12:00:00Z");
const depois = (seg: number) => new Date(venda.getTime() + seg * 1000);

describe("situacaoVendaCs", () => {
  it("são 7 dias sem contato", () => {
    expect(DIAS_SEM_CONTATO).toBe(7);
  });

  it("primeiro envio depois da venda vale; envio de antes não conta", () => {
    const r = situacaoVendaCs(venda, true, [depois(-3600), depois(600), depois(1200)], depois(86_400));
    expect(r).toEqual({ situacao: "contatada", primeiroContatoEm: depois(600), segundos: 600 });
  });

  it("envio no mesmo instante da venda vale com 0 s", () => {
    const r = situacaoVendaCs(venda, true, [venda], depois(60));
    expect(r).toEqual({ situacao: "contatada", primeiroContatoEm: venda, segundos: 0 });
  });

  it("sem envio há 3 h → aguardando com 10800 s", () => {
    const r = situacaoVendaCs(venda, true, [], depois(3 * 3600));
    expect(r).toEqual({ situacao: "aguardando", primeiroContatoEm: null, segundos: 10_800 });
  });

  it("só envio de antes da venda, há 3 h → aguardando", () => {
    const r = situacaoVendaCs(venda, true, [depois(-60)], depois(3 * 3600));
    expect(r.situacao).toBe("aguardando");
  });

  it("sem envio há exatamente 7 dias → ainda aguardando", () => {
    const r = situacaoVendaCs(venda, true, [], depois(7 * 86_400));
    expect(r).toEqual({ situacao: "aguardando", primeiroContatoEm: null, segundos: 7 * 86_400 });
  });

  it("sem envio há 8 dias → sem_contato com segundos null", () => {
    const r = situacaoVendaCs(venda, true, [], depois(8 * 86_400));
    expect(r).toEqual({ situacao: "sem_contato", primeiroContatoEm: null, segundos: null });
  });

  it("sem WhatsApp → sem_whatsapp", () => {
    const r = situacaoVendaCs(venda, false, [], depois(3600));
    expect(r).toEqual({ situacao: "sem_whatsapp", primeiroContatoEm: null, segundos: null });
  });
});

describe("tabela-cs: rótulo por situação", () => {
  it("contatada mostra o tempo", () => {
    expect(rotuloSituacaoCs("contatada", 600)).toBe("10 min");
    expect(rotuloSituacaoCs("contatada", 4380)).toBe("1 h 13 min");
  });
  it("aguardando mostra o tempo correndo", () => {
    expect(rotuloSituacaoCs("aguardando", 7200)).toBe("aguardando · 2 h 00 min");
  });
  it("sem contato e sem WhatsApp", () => {
    expect(rotuloSituacaoCs("sem_contato", null)).toBe("sem contato em 7 dias");
    expect(rotuloSituacaoCs("sem_whatsapp", null)).toBe("sem WhatsApp na venda");
  });
});
