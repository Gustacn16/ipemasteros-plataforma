import { describe, expect, it } from "vitest";
import { aniversariantesDoMes, linkWhatsapp, proximosAniversarios, type Pessoa } from "./aniversarios";

const p = (nome: string, dataNascimento: string, tipo: Pessoa["tipo"] = "aluno"): Pessoa => ({ id: nome, nome, tipo, dataNascimento, telefone: null });

describe("aniversariantesDoMes", () => {
  it("só os do mês, por dia e nome, marcando o de hoje", () => {
    const r = aniversariantesDoMes([p("Caio", "1980-12-03"), p("Bia", "1990-11-20"), p("Ana", "1985-11-05", "professor"), p("Davi", "1991-11-05")], "2026-11-05");
    expect(r.map((a) => [a.nome, a.dia, a.hoje])).toEqual([
      ["Ana", "2026-11-05", true],
      ["Davi", "2026-11-05", true],
      ["Bia", "2026-11-20", false],
    ]);
  });

  it("29/02 vira 28/02 em ano comum", () => {
    expect(aniversariantesDoMes([p("Ana", "1992-02-29")], "2026-02-10")[0].dia).toBe("2026-02-28");
    expect(aniversariantesDoMes([p("Ana", "1992-02-29")], "2028-02-10")[0].dia).toBe("2028-02-29");
  });
});

describe("proximosAniversarios", () => {
  it("de hoje até hoje + dias, atravessando o ano", () => {
    const r = proximosAniversarios([p("Ana", "1990-01-02"), p("Bia", "1990-01-05"), p("Caio", "1990-12-28"), p("Davi", "1990-12-27")], "2026-12-28", 7);
    expect(r.map((a) => [a.nome, a.dia, a.hoje])).toEqual([
      ["Caio", "2026-12-28", true],
      ["Ana", "2027-01-02", false],
    ]);
  });

  it("29/02 entra na janela em 28/02 de ano comum", () => {
    expect(proximosAniversarios([p("Ana", "1992-02-29")], "2026-02-25", 7)[0].dia).toBe("2026-02-28");
  });
});

describe("linkWhatsapp", () => {
  it("põe o 55 quando falta e recusa telefone curto ou vazio", () => {
    expect(linkWhatsapp("62999990000")).toBe("https://wa.me/5562999990000");
    expect(linkWhatsapp("6233330000")).toBe("https://wa.me/556233330000");
    expect(linkWhatsapp("5562999990000")).toBe("https://wa.me/5562999990000");
    expect(linkWhatsapp(null)).toBeNull();
    expect(linkWhatsapp("123")).toBeNull();
  });
});
