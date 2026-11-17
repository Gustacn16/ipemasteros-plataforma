import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { ferramentasDoPapel, limitarLista, paraFerramentaApi, TODAS_FERRAMENTAS } = await import("./registro");

const nomes = (papel: Parameters<typeof ferramentasDoPapel>[0]) => ferramentasDoPapel(papel).map((f) => f.nome);

describe("ferramentasDoPapel", () => {
  it("o comercial recebe ver_agenda e não o relatório da equipe", () => {
    expect(nomes("comercial")).toContain("ver_agenda");
    expect(nomes("comercial")).not.toContain("relatorio_tarefas_equipe");
  });

  it("o professor não tem nexu:usar e recebe lista vazia", () => {
    expect(ferramentasDoPapel("professor")).toEqual([]);
  });

  it("propor_criar_evento exige editar a agenda institucional (todo evento criado é institucional)", () => {
    const evento = TODAS_FERRAMENTAS.find((f) => f.nome === "propor_criar_evento");
    expect(evento?.permissao).toBe("agenda:editar_institucional");
    expect(nomes("colaborador")).toContain("propor_criar_evento");
  });

  it("propor_registrar_venda só para quem registra venda", () => {
    expect(nomes("comercial")).toContain("propor_registrar_venda");
    expect(nomes("colaborador")).not.toContain("propor_registrar_venda");
  });

  it("as ações ficam no fim da ordem fixa", () => {
    const todas = TODAS_FERRAMENTAS.map((f) => f.tipo);
    expect(todas.slice(todas.indexOf("proposta")).every((t) => t === "proposta")).toBe(true);
  });

  it("a ordem é estável entre chamadas", () => {
    expect(nomes("admin")).toEqual(nomes("admin"));
    expect(nomes("admin")).toEqual(TODAS_FERRAMENTAS.map((f) => f.nome));
  });
});

describe("paraFerramentaApi", () => {
  it("gera schema sem strict, sem $schema e sem propriedades extras", () => {
    for (const f of TODAS_FERRAMENTAS) {
      const api = paraFerramentaApi(f);
      expect(api).not.toHaveProperty("strict");
      expect(api.name).toBe(f.nome);
      expect(api.input_schema.type).toBe("object");
      expect((api.input_schema as Record<string, unknown>).additionalProperties).toBe(false);
      expect(api.input_schema).not.toHaveProperty("$schema");
    }
  });
});

describe("schemas das ferramentas (todas, como admin)", () => {
  // Restrições que o strict tool use não aceita; o Zod já valida tudo isso no laço.
  const PROIBIDAS = ["minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "pattern"];

  function chavesProibidas(no: unknown, caminho: string): string[] {
    if (Array.isArray(no)) return no.flatMap((v, i) => chavesProibidas(v, `${caminho}[${i}]`));
    if (!no || typeof no !== "object") return [];
    return Object.entries(no as Record<string, unknown>).flatMap(([k, v]) => {
      // Dentro de "properties" as chaves são nomes de campos, não palavras do schema.
      if (k === "properties" && v && typeof v === "object") {
        return Object.entries(v as Record<string, unknown>).flatMap(([campo, sub]) =>
          chavesProibidas(sub, `${caminho}.properties.${campo}`),
        );
      }
      return [...(PROIBIDAS.includes(k) ? [`${caminho}.${k}`] : []), ...chavesProibidas(v, `${caminho}.${k}`)];
    });
  }

  it("nenhum input_schema tem palavra-chave de restrição", () => {
    const todas = ferramentasDoPapel("admin");
    expect(todas.length).toBe(TODAS_FERRAMENTAS.length);
    const achadas = todas.flatMap((f) => chavesProibidas(paraFerramentaApi(f).input_schema, f.nome));
    expect(achadas).toEqual([]);
  });

  it("a restrição continua valendo no Zod (buscar_pessoas exige 2 letras)", () => {
    const f = TODAS_FERRAMENTAS.find((x) => x.nome === "buscar_pessoas")!;
    expect(f.entrada.safeParse({ nome: "a" }).success).toBe(false);
  });
});

describe("limitarLista", () => {
  it("corta em 50 e informa o total", () => {
    const r = limitarLista(Array.from({ length: 132 }, (_, i) => i));
    expect(r.itens).toHaveLength(50);
    expect(r.total).toBe(132);
    expect(r.mostrando).toBe(50);
  });
});
