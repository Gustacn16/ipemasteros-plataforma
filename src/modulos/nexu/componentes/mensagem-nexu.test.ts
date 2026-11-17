import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MensagemNexu, urlSegura } from "./mensagem-nexu";

const html = (texto: string) => renderToStaticMarkup(createElement(MensagemNexu, { papel: "assistente", texto }));

describe("MensagemNexu", () => {
  it("não renderiza imagens", () => {
    expect(html("![x](https://evil.example/?d=1)")).not.toContain("<img");
  });
  it("não cria a tag de HTML bruto", () => {
    expect(html("<script>alert(1)</script>")).not.toContain("<script");
  });
  it("neutraliza link javascript:", () => {
    expect(html("[clique](javascript:alert(1))")).not.toContain("javascript:");
  });
  it("mantém link https", () => {
    expect(html("[ok](https://exemplo.com)")).toContain('href="https://exemplo.com"');
  });
  it("urlSegura bloqueia esquemas perigosos", () => {
    expect(urlSegura("data:text/html,x")).toBe("");
    expect(urlSegura("/nexu")).toBe("/nexu");
  });
});
