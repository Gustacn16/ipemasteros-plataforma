import { describe, expect, it } from "vitest";
import { ErroNegocio } from "@/lib/erros";
import { ErroMeta } from "@/lib/meta-graph";
import { TEXTO_ERRO, categorizarErro } from "./erros";

describe("categorizarErro", () => {
  it("traduz erros conhecidos em categorias seguras", () => {
    expect(categorizarErro(new ErroMeta("x", 110))).toBe("perfil_nao_profissional");
    expect(categorizarErro(new ErroMeta("x", 190))).toBe("chave_meta");
    expect(categorizarErro(new ErroMeta("x", 10))).toBe("chave_meta");
    expect(categorizarErro(new ErroMeta("x", 4))).toBe("meta");
    expect(categorizarErro(new ErroNegocio("Endereço não permitido"))).toBe("endereco_bloqueado");
    expect(categorizarErro(new ErroNegocio("A página demorou demais"))).toBe("pagina_lenta");
    expect(categorizarErro(new ErroNegocio("Página grande demais"))).toBe("pagina_grande");
    expect(categorizarErro(new ErroNegocio("Não foi possível abrir a página"))).toBe("pagina_inacessivel");
    expect(categorizarErro(new TypeError("dado de terceiro"))).toBe("inesperado");
  });

  it("toda categoria tem texto para a tela", () => {
    for (const c of ["perfil_nao_profissional", "chave_meta", "meta", "endereco_bloqueado", "pagina_lenta", "pagina_grande", "pagina_inacessivel", "inesperado"])
      expect(TEXTO_ERRO[c as keyof typeof TEXTO_ERRO]).toBeTruthy();
  });
});

describe("errosDoConcorrente", () => {
  it("textos únicos do concorrente, com o passo, ignorando lixo", async () => {
    const { errosDoConcorrente } = await import("./erros");
    const erros = [
      { concorrenteId: "c1", passo: "instagram", tipo: "perfil_nao_profissional" },
      { concorrenteId: "c1", passo: "paginas", tipo: "pagina_lenta" },
      { concorrenteId: "c1", passo: "paginas", tipo: "pagina_lenta" },
      { concorrenteId: "c2", passo: "instagram", tipo: "meta" },
      "lixo",
    ];
    expect(errosDoConcorrente(erros, "c1")).toEqual([
      "Instagram: O perfil não existe ou não é uma conta profissional (Business ou Criador de conteúdo).",
      "Páginas: A página demorou demais para responder.",
    ]);
    expect(errosDoConcorrente(null, "c1")).toEqual([]);
  });
});
