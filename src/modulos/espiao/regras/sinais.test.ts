import { describe, expect, it } from "vitest";
import { type MidiaParaRegra, sinalDeBio, sinalDeRitmo, sinalDeSeguidores, sinaisDeConteudo, sinaisDePagina } from "./sinais";

const AGORA = new Date("2026-11-18T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);

function reels(id: string, dias: number, visualizacoes: number | null, extra: Partial<MidiaParaRegra> = {}): MidiaParaRegra {
  return { idExterno: id, tipo: "reels", permalink: `https://ig/${id}`, publicadoEm: diasAtras(dias), curtidas: 10, comentarios: 0, visualizacoes, jaSinalizada: false, resumo: null, ...extra };
}
/** 5 Reels de base com mediana 1000 e um candidato. */
const base = () => [reels("b1", 20, 900), reels("b2", 21, 1000), reels("b3", 22, 1000), reels("b4", 23, 1100), reels("b5", 24, 1000)];

describe("sinaisDeConteudo", () => {
  it("Reels com 3,0× a mediana dispara, com a chave da mídia", () => {
    const s = sinaisDeConteudo([...base(), reels("c", 2, 3000)], AGORA);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ tipo: "conteudo_destaque", chave: "conteudo_destaque:c", origemUrl: "https://ig/c", titulo: "Reels com 3× a média do perfil" });
  });

  it("2,9× não dispara", () => {
    expect(sinaisDeConteudo([...base(), reels("c", 2, 2900)], AGORA)).toEqual([]);
  });

  it("tipo com menos de 5 mídias não avalia", () => {
    expect(sinaisDeConteudo([...base().slice(0, 3), reels("c", 2, 9000)], AGORA)).toEqual([]);
  });

  it("mídia com 15 dias não dispara", () => {
    expect(sinaisDeConteudo([...base(), reels("c", 15, 9000)], AGORA)).toEqual([]);
  });

  it("mídia já sinalizada não dispara de novo", () => {
    expect(sinaisDeConteudo([...base(), reels("c", 2, 9000, { jaSinalizada: true })], AGORA)).toEqual([]);
  });

  it("Reels sem visualizações usa curtidas + comentários", () => {
    const semVis = [1, 2, 3, 4, 5].map((i) => reels(`s${i}`, 20 + i, null, { curtidas: 100, comentarios: 0 }));
    const s = sinaisDeConteudo([...semVis, reels("c", 1, null, { curtidas: 280, comentarios: 20 })], AGORA);
    expect(s.map((x) => x.chave)).toEqual(["conteudo_destaque:c"]);
  });
});

describe("sinalDeRitmo", () => {
  const semana = (n: number, inicioDias: number) => Array.from({ length: n }, (_, i) => diasAtras(inicioDias + (i % 6) + 0.1));
  it("8 posts na semana contra média de 4 dispara", () => {
    const datas = [...semana(8, 0), ...semana(4, 7), ...semana(4, 14), ...semana(4, 21), ...semana(4, 28)];
    expect(sinalDeRitmo(datas, AGORA)?.tipo).toBe("ritmo_mudou");
  });
  it("com só 3 posts nas 4 semanas anteriores não avalia", () => {
    expect(sinalDeRitmo([...semana(8, 0), ...semana(3, 7)], AGORA)).toBeNull();
  });
  it("ritmo parecido não dispara", () => {
    const datas = [...semana(5, 0), ...semana(4, 7), ...semana(4, 14), ...semana(4, 21), ...semana(4, 28)];
    expect(sinalDeRitmo(datas, AGORA)).toBeNull();
  });
});

describe("sinalDeSeguidores", () => {
  it("+3% dispara e +2,9% não", () => {
    expect(sinalDeSeguidores(1030, { seguidores: 1000, capturadaEm: diasAtras(7) }, AGORA)?.tipo).toBe("seguidores_salto");
    expect(sinalDeSeguidores(1029, { seguidores: 1000, capturadaEm: diasAtras(7) }, AGORA)).toBeNull();
  });
  it("−2% dispara", () => {
    expect(sinalDeSeguidores(980, { seguidores: 1000, capturadaEm: diasAtras(7) }, AGORA)?.tipo).toBe("seguidores_salto");
  });
  it("foto anterior com 4 dias não avalia", () => {
    expect(sinalDeSeguidores(2000, { seguidores: 1000, capturadaEm: diasAtras(4) }, AGORA)).toBeNull();
  });
});

describe("sinalDeBio", () => {
  it("bio ou site mudou dispara; sem anterior não", () => {
    expect(sinalDeBio({ biografia: "a", site: "x" }, { biografia: "b", site: "x" })?.tipo).toBe("bio_link_mudou");
    expect(sinalDeBio({ biografia: "a", site: "y" }, { biografia: "a", site: "x" })?.tipo).toBe("bio_link_mudou");
    expect(sinalDeBio({ biografia: "a", site: "x" }, { biografia: "a", site: "x" })).toBeNull();
    expect(sinalDeBio({ biografia: "a", site: "x" }, null)).toBeNull();
  });
});

describe("sinaisDePagina", () => {
  const cem = (troca: number) => Array.from({ length: 100 }, (_, i) => (i < troca ? `novo${i}` : `p${i}`)).join(" ");
  const pagina = (o: Partial<Parameters<typeof sinaisDePagina>[0]> = {}) =>
    sinaisDePagina({ url: "https://x.com/pos", rotulo: "Pós Dermato", versaoAnterior: { texto: cem(0), precos: ["R$ 10,00"] }, atual: { texto: cem(0), precos: ["R$ 10,00"], legivel: true }, ehLinhaDeBase: false, ...o });

  it("linha de base não gera sinal", () => {
    expect(pagina({ ehLinhaDeBase: true, atual: { texto: cem(50), precos: ["R$ 1,00"], legivel: true } })).toEqual([]);
  });
  it("preço mudou gera só preco_mudou, com antes e depois", () => {
    const s = pagina({ atual: { texto: cem(30), precos: ["R$ 8,00"], legivel: true } });
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ tipo: "preco_mudou", detalhe: { antes: ["R$ 10,00"], depois: ["R$ 8,00"] } });
  });
  it("4% de palavras não gera sinal; 5% gera pagina_mudou", () => {
    expect(pagina({ atual: { texto: cem(4), precos: ["R$ 10,00"], legivel: true } })).toEqual([]);
    expect(pagina({ atual: { texto: cem(5), precos: ["R$ 10,00"], legivel: true } })[0]).toMatchObject({ tipo: "pagina_mudou", titulo: "Página Pós Dermato mudou" });
  });
  it("página sem nenhuma versão legível anterior vira pagina_nova", () => {
    expect(pagina({ versaoAnterior: null })[0]?.tipo).toBe("pagina_nova");
  });
});
