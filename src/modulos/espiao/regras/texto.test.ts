import { describe, expect, it } from "vitest";
import { extrairPrecos, extrairTextoVisivel, fracaoPalavrasMudadas, hashTexto, normalizarParaComparar } from "./texto";

describe("extrairTextoVisivel", () => {
  it("ignora script, nav, footer e junta espaços", () => {
    const html = `<html><head><title>T</title><style>.a{}</style></head><body>
      <nav>Menu Home</nav><header>Topo</header>
      <h1>Pós em   Dermatologia</h1><script>alert(1)</script>
      <p>Matrículas\n abertas</p><footer>Rodapé 2026</footer><noscript>x</noscript></body></html>`;
    expect(extrairTextoVisivel(html)).toBe("Pós em Dermatologia Matrículas abertas");
  });
});

describe("normalizarParaComparar e hashTexto", () => {
  it("data, hora e contador não mudam o hash", () => {
    const a = "Inscrições até 20/11/2026 — faltam 3 dias e 12 vagas";
    const b = "Inscrições até 27/11/2026 — faltam 9 dias e 4 vagas";
    expect(hashTexto(a)).toBe(hashTexto(b));
    expect(normalizarParaComparar("Aula às 19:30 em 05/12")).toBe("Aula às ‹hora› em ‹data›");
  });

  it("texto diferente muda o hash", () => {
    expect(hashTexto("Garantia de 7 dias")).not.toBe(hashTexto("Garantia de 30 dias de reembolso"));
  });
});

describe("extrairPrecos", () => {
  it("acha parcelado e à vista, padronizados", () => {
    expect(extrairPrecos("12x de R$ 899 ou R$ 9.990,00 à vista")).toEqual(["12x R$ 899,00", "R$ 9.990,00"]);
  });

  it("aceita os formatos com e sem espaço e não repete", () => {
    expect(extrairPrecos("12 x R$ 99,90 | 12x R$99,90 | R$1234 | R$ 1.234,00")).toEqual(["12x R$ 99,90", "R$ 1.234,00"]);
  });
});

describe("fracaoPalavrasMudadas", () => {
  it("uma palavra trocada em quatro dá 0,25", () => {
    expect(fracaoPalavrasMudadas("a b c d", "a b c e")).toBe(0.25);
  });

  it("textos iguais dão 0, mesmo em outra ordem", () => {
    expect(fracaoPalavrasMudadas("a b c", "a b c")).toBe(0);
    expect(fracaoPalavrasMudadas("a b c", "c b a")).toBe(0);
  });
});
