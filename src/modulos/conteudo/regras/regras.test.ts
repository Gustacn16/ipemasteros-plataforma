import { describe, expect, it } from "vitest";
import { etapaAposPublicacoes, validarMudancaEtapa } from "./etapas";
import { conteudoAtrasado, gradeDoMes, mesAnterior, proximoMes, taxaEngajamento } from "./calendario";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("validarMudancaEtapa", () => {
  const base = { podeAprovar: false, totalCanais: 1, todosPublicados: false };

  it("permite mover livremente entre etapas de produção", () => {
    expect(validarMudancaEtapa({ ...base, para: "edicao" })).toBeNull();
    expect(validarMudancaEtapa({ ...base, para: "ideia" })).toBeNull();
  });

  it("exige canal de destino a partir de planejado", () => {
    expect(validarMudancaEtapa({ ...base, totalCanais: 0, para: "ideia" })).toBeNull();
    expect(validarMudancaEtapa({ ...base, totalCanais: 0, para: "planejado" })).toMatch(/canal/);
  });

  it("só quem aprova move para aprovado", () => {
    expect(validarMudancaEtapa({ ...base, para: "aprovado" })).toMatch(/aprova/);
    expect(validarMudancaEtapa({ ...base, podeAprovar: true, para: "aprovado" })).toBeNull();
  });

  it("publicado não é escolhido à mão", () => {
    expect(validarMudancaEtapa({ ...base, podeAprovar: true, para: "publicado" })).toMatch(/publica/);
  });

  it("cancelar é sempre possível", () => {
    expect(validarMudancaEtapa({ ...base, totalCanais: 0, para: "cancelado" })).toBeNull();
  });
});

describe("etapaAposPublicacoes", () => {
  it("vira publicado quando todas as publicações estão feitas", () => {
    expect(etapaAposPublicacoes("aprovado", ["publicado", "publicado"])).toBe("publicado");
  });

  it("continua aprovado com alguma pendente", () => {
    expect(etapaAposPublicacoes("aprovado", ["publicado", "pendente"])).toBe("aprovado");
  });

  it("volta para aprovado ao desmarcar uma publicação", () => {
    expect(etapaAposPublicacoes("publicado", ["publicado", "pendente"])).toBe("aprovado");
  });

  it("não mexe em outras etapas", () => {
    expect(etapaAposPublicacoes("edicao", ["pendente"])).toBe("edicao");
  });
});

describe("conteudoAtrasado", () => {
  const agora = new Date("2026-11-28T01:00:00Z"); // 27/11, 22h em Brasília

  it("data de hoje ainda não está atrasada", () => {
    expect(conteudoAtrasado(dia("2026-11-27"), "edicao", agora)).toBe(false);
  });

  it("data de ontem está atrasada, exceto publicado ou cancelado", () => {
    expect(conteudoAtrasado(dia("2026-11-26"), "edicao", agora)).toBe(true);
    expect(conteudoAtrasado(dia("2026-11-26"), "publicado", agora)).toBe(false);
    expect(conteudoAtrasado(dia("2026-11-26"), "cancelado", agora)).toBe(false);
  });

  it("sem data nunca está atrasado", () => {
    expect(conteudoAtrasado(null, "ideia", agora)).toBe(false);
  });
});

describe("gradeDoMes", () => {
  it("novembro de 2026 começa num domingo e tem 5 semanas", () => {
    const grade = gradeDoMes("2026-11");
    expect(grade[0][0]).toEqual({ dia: "2026-11-01", doMes: true });
    expect(grade).toHaveLength(5);
    expect(grade.at(-1)!.at(-1)).toEqual({ dia: "2026-12-05", doMes: false });
  });

  it("agosto de 2026 começa num sábado: completa a semana com dias de julho", () => {
    const grade = gradeDoMes("2026-08");
    expect(grade[0][0]).toEqual({ dia: "2026-07-26", doMes: false });
    expect(grade[0][6]).toEqual({ dia: "2026-08-01", doMes: true });
    expect(grade).toHaveLength(6);
  });

  it("toda semana tem 7 dias", () => {
    for (const s of gradeDoMes("2027-02")) expect(s).toHaveLength(7);
  });

  it("navega entre meses, inclusive na virada do ano", () => {
    expect(proximoMes("2026-12")).toBe("2027-01");
    expect(mesAnterior("2027-01")).toBe("2026-12");
  });
});

describe("taxaEngajamento", () => {
  it("soma interações e divide pelo alcance", () => {
    expect(taxaEngajamento({ alcance: 1000, curtidas: 40, comentarios: 5, compartilhamentos: 3, salvamentos: 2 })).toBe(5);
  });

  it("sem alcance não há taxa", () => {
    expect(taxaEngajamento({ alcance: null, curtidas: 40, comentarios: 0, compartilhamentos: 0, salvamentos: 0 })).toBeNull();
    expect(taxaEngajamento({ alcance: 0, curtidas: 1, comentarios: 0, compartilhamentos: 0, salvamentos: 0 })).toBeNull();
  });
});
