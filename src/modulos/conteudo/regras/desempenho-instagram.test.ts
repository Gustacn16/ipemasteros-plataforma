import { describe, expect, it } from "vitest";
import {
  type PostAnalise,
  desempenhoPorFormato,
  destaques,
  engajamento,
  porDiaDaSemana,
  porPeriodoDoDia,
  sugestoesDeConteudo,
  temasEmAlta,
} from "./desempenho-instagram";

let n = 0;
/** Post de teste; `quando` é a hora de São Paulo (UTC-3). */
const post = (p: Partial<PostAnalise> & { quando?: string }): PostAnalise => {
  const { quando = "2026-11-03T19:00", ...resto } = p;
  n += 1;
  return {
    id: `p${n}`,
    tipo: "reels",
    titulo: `Post ${n}`,
    legenda: null,
    publicadoEm: new Date(`${quando}:00-03:00`),
    alcance: 1000,
    visualizacoes: 2000,
    interacoes: 50,
    salvamentos: 5,
    compartilhamentos: 5,
    comentarios: 5,
    ...resto,
  };
};

describe("engajamento", () => {
  it("interações sobre alcance, em % com uma casa", () => {
    expect(engajamento(1000, 55)).toBe(5.5);
    expect(engajamento(0, 10)).toBeNull();
    expect(engajamento(null, 10)).toBeNull();
    expect(engajamento(100, null)).toBeNull();
  });
});

describe("desempenhoPorFormato", () => {
  it("médias por formato, do maior alcance médio para o menor, ignorando posts sem números", () => {
    const linhas = desempenhoPorFormato([
      post({ tipo: "reels", alcance: 3000, interacoes: 150 }),
      post({ tipo: "reels", alcance: 1000, interacoes: 50 }),
      post({ tipo: "carrossel", alcance: 1000, interacoes: 100, salvamentos: 20 }),
      post({ tipo: "carrossel", alcance: null, interacoes: null }),
    ]);
    expect(linhas.map((l) => l.tipo)).toEqual(["reels", "carrossel"]);
    expect(linhas[0]).toMatchObject({ quantidade: 2, alcanceMedio: 2000, engajamento: 5 });
    expect(linhas[1]).toMatchObject({ quantidade: 1, alcanceMedio: 1000, engajamento: 10, salvamentosMedio: 20 });
  });
});

describe("por dia e por período", () => {
  it("agrupa pelo horário de São Paulo e deixa os stories de fora", () => {
    const posts = [
      post({ quando: "2026-11-03T19:00", alcance: 3000 }), // terça, noite
      post({ quando: "2026-11-03T08:00", alcance: 1000 }), // terça, manhã
      post({ quando: "2026-11-02T23:30", alcance: 500 }), // segunda, noite (já é terça em UTC)
      post({ tipo: "story", quando: "2026-11-04T10:00", alcance: 9000 }),
    ];
    const dias = porDiaDaSemana(posts);
    expect(dias).toHaveLength(7);
    expect(dias.find((d) => d.chave === "2")).toMatchObject({ rotulo: "Terça", quantidade: 2, alcanceMedio: 2000 });
    expect(dias.find((d) => d.chave === "1")).toMatchObject({ quantidade: 1, alcanceMedio: 500 });
    expect(dias.find((d) => d.chave === "3")).toMatchObject({ quantidade: 0, alcanceMedio: null });
    const periodos = porPeriodoDoDia(posts);
    expect(periodos.map((p) => p.chave)).toEqual(["madrugada", "manha", "tarde", "noite"]);
    expect(periodos.find((p) => p.chave === "noite")).toMatchObject({ quantidade: 2, alcanceMedio: 1750 });
  });
});

describe("destaques", () => {
  it("o mais salvo, o mais compartilhado, o mais comentado e o maior engajamento com alcance relevante", () => {
    const salvo = post({ salvamentos: 90 });
    const compartilhado = post({ compartilhamentos: 70 });
    const comentado = post({ comentarios: 40 });
    const engajado = post({ alcance: 500, interacoes: 100 });
    const pequeno = post({ alcance: 20, interacoes: 15 });
    const d = destaques([salvo, compartilhado, comentado, engajado, pequeno]);
    expect(d.maisSalvo?.id).toBe(salvo.id);
    expect(d.maisCompartilhado?.id).toBe(compartilhado.id);
    expect(d.maisComentado?.id).toBe(comentado.id);
    expect(d.maiorEngajamento?.id).toBe(engajado.id);
  });
  it("sem posts, nada em destaque", () => {
    expect(destaques([])).toEqual({ maisSalvo: null, maisCompartilhado: null, maisComentado: null, maiorEngajamento: null });
  });
});

describe("temasEmAlta", () => {
  it("palavras e hashtags que se repetem nos posts de maior alcance e pouco no resto", () => {
    const fortes = [
      "Implante dentário: o que ninguém conta #implante",
      "Implante em 1 dia? Veja como funciona #implante",
      "Mitos sobre implante e prótese",
    ].map((legenda) => post({ legenda, alcance: 5000 }));
    const fracos = [
      "Bom dia, equipe!",
      "Feriado: estaremos fechados",
      "Conheça nossa equipe",
      "Promoção de clareamento",
      "Agenda aberta",
    ].map((legenda) => post({ legenda, alcance: 300 }));
    const temas = temasEmAlta([...fortes, ...fracos]);
    expect(temas[0]).toBe("implante");
    expect(temas).toContain("#implante");
    expect(temas).not.toContain("equipe");
    expect(temas).not.toContain("sobre");
  });
  it("com poucos posts, não tira conclusão", () => {
    expect(temasEmAlta([post({ legenda: "implante implante" })])).toEqual([]);
  });
});

describe("sugestoesDeConteudo", () => {
  it("com poucos posts, não sugere nada", () => {
    expect(sugestoesDeConteudo([post({}), post({})])).toEqual([]);
  });

  it("aponta o formato, o dia e o período que mais trazem alcance e o post mais salvo", () => {
    const posts = [
      ...[0, 1, 2].map(() => post({ tipo: "reels", alcance: 3000, quando: "2026-11-03T19:00" })),
      ...[0, 1, 2].map(() => post({ tipo: "carrossel", alcance: 1000, quando: "2026-11-05T09:00" })),
      post({ tipo: "carrossel", alcance: 1000, quando: "2026-11-06T09:00", salvamentos: 200, titulo: "Guia do implante" }),
    ];
    const s = sugestoesDeConteudo(posts);
    const titulos = s.map((x) => x.titulo);
    expect(titulos).toContain("Priorize Reels");
    expect(s.find((x) => x.titulo === "Priorize Reels")?.texto).toContain("3×");
    expect(titulos).toContain("Poste na terça");
    expect(titulos).toContain("Poste à noite");
    expect(s.find((x) => x.titulo === "Faça uma continuação")?.texto).toContain("Guia do implante");
  });

  it("não sugere formato quando a diferença é pequena ou há poucos posts no formato", () => {
    const posts = [
      ...[0, 1, 2].map(() => post({ tipo: "reels", alcance: 1100 })),
      ...[0, 1, 2].map(() => post({ tipo: "carrossel", alcance: 1000 })),
      post({ tipo: "post", alcance: 9000 }),
    ];
    expect(sugestoesDeConteudo(posts).map((x) => x.titulo)).not.toContain("Priorize Reels");
    expect(sugestoesDeConteudo(posts).map((x) => x.titulo)).not.toContain("Priorize Post");
  });
});
