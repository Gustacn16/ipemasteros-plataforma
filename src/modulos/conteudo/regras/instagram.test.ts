import { describe, expect, it } from "vitest";
import {
  METRICAS_POR_TIPO,
  MENSAGEM_SEM_CONTA_INSTAGRAM,
  codigoDoPermalink,
  escolherPublicacao,
  lerInsightsConta,
  lerInsightsMidia,
  mensagemErroInstagram,
  mesDoPost,
  periodosConta,
  permissoesFaltando,
  podeIniciarAtualizacao,
  postRecente,
  tipoDaMidia,
} from "./instagram";

describe("tipoDaMidia", () => {
  it("separa reels, carrossel, post e story", () => {
    expect(tipoDaMidia({ media_type: "VIDEO", media_product_type: "REELS" })).toBe("reels");
    expect(tipoDaMidia({ media_type: "CAROUSEL_ALBUM", media_product_type: "FEED" })).toBe("carrossel");
    expect(tipoDaMidia({ media_type: "IMAGE", media_product_type: "FEED" })).toBe("post");
    expect(tipoDaMidia({ media_type: "VIDEO", media_product_type: "FEED" })).toBe("post");
    expect(tipoDaMidia({ media_type: "IMAGE", media_product_type: "STORY" })).toBe("story");
  });
});

describe("METRICAS_POR_TIPO", () => {
  it("pede só as métricas que cada tipo aceita", () => {
    expect(METRICAS_POR_TIPO.reels).not.toContain("profile_visits");
    expect(METRICAS_POR_TIPO.story).toContain("replies");
    expect(METRICAS_POR_TIPO.post).toEqual([
      "reach",
      "views",
      "likes",
      "comments",
      "saved",
      "shares",
      "total_interactions",
      "profile_visits",
    ]);
    expect(METRICAS_POR_TIPO.carrossel).toEqual(METRICAS_POR_TIPO.post);
  });
});

describe("codigoDoPermalink", () => {
  it("acha o código em links colados de jeitos diferentes", () => {
    expect(codigoDoPermalink("https://www.instagram.com/reel/ABC123/?igsh=xyz")).toBe("ABC123");
    expect(codigoDoPermalink("instagram.com/p/XYZ")).toBe("XYZ");
    expect(codigoDoPermalink("https://instagram.com/reels/A-b_9/")).toBe("A-b_9");
    expect(codigoDoPermalink("https://www.instagram.com/tv/TV1")).toBe("TV1");
    expect(codigoDoPermalink("https://www.instagram.com/ipemaster/p/COM_USUARIO/")).toBe("COM_USUARIO");
    expect(codigoDoPermalink("https://www.instagram.com/stories/ipemaster/3456789/")).toBe("3456789");
  });

  it("devolve null para o que não é post", () => {
    expect(codigoDoPermalink("https://www.instagram.com/ipemaster/")).toBeNull();
    expect(codigoDoPermalink("https://youtube.com/p/ABC")).toBeNull();
    expect(codigoDoPermalink("")).toBeNull();
    expect(codigoDoPermalink(null)).toBeNull();
  });
});

describe("lerInsightsMidia", () => {
  it("lista vazia ou ausente deixa tudo null", () => {
    const vazio = lerInsightsMidia([]);
    expect(Object.values(vazio).every((v) => v === null)).toBe(true);
    expect(lerInsightsMidia(undefined).alcance).toBeNull();
  });

  it("lê `values` e `total_value` com os nomes do sistema", () => {
    const n = lerInsightsMidia([
      { name: "reach", values: [{ value: 120 }] },
      { name: "views", total_value: { value: 300 } },
      { name: "saved", values: [{ value: 0 }] },
      { name: "profile_visits", values: [{ value: 7 }] },
      { name: "replies", values: [{ value: 2 }] },
      { name: "desconhecida", values: [{ value: 9 }] },
    ]);
    expect(n).toMatchObject({ alcance: 120, visualizacoes: 300, salvamentos: 0, visitasPerfil: 7, respostas: 2, curtidas: null });
  });
});

describe("lerInsightsConta", () => {
  it("lê os totais e divide seguir e deixar de seguir", () => {
    const n = lerInsightsConta([
      { name: "reach", total_value: { value: 5000 } },
      { name: "saves", total_value: { value: 40 } },
      { name: "profile_links_taps", total_value: { value: 12 } },
      {
        name: "follows_and_unfollows",
        total_value: {
          value: 30,
          breakdowns: [
            {
              results: [
                { dimension_values: ["FOLLOWER"], value: 25 },
                { dimension_values: ["NON_FOLLOWER"], value: 5 },
              ],
            },
          ],
        },
      },
    ]);
    expect(n).toMatchObject({
      alcance: 5000,
      salvamentos: 40,
      cliquesLink: 12,
      novosSeguidores: 25,
      deixaramDeSeguir: 5,
      visualizacoes: null,
    });
  });
});

describe("periodosConta", () => {
  it("dia a dia refaz os últimos 7 dias; no começo do mês, também o mês anterior", () => {
    const p = periodosConta({ hoje: "2026-11-02", primeiraVez: false });
    expect(p.dias).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(p.meses).toEqual([
      { mes: "2026-10", desde: "2026-10-01", ate: "2026-10-31" },
      { mes: "2026-11", desde: "2026-11-01", ate: "2026-11-01" },
    ]);
  });

  it("no dia 1 o mês atual ainda não tem dia fechado", () => {
    expect(periodosConta({ hoje: "2026-11-01", primeiraVez: false }).meses).toEqual([
      { mes: "2026-10", desde: "2026-10-01", ate: "2026-10-31" },
    ]);
  });

  it("no meio do mês, só o mês atual até ontem", () => {
    expect(periodosConta({ hoje: "2026-11-15", primeiraVez: false }).meses).toEqual([
      { mes: "2026-11", desde: "2026-11-01", ate: "2026-11-14" },
    ]);
  });

  it("a primeira vez traz tudo desde 2026-01-01", () => {
    const p = periodosConta({ hoje: "2026-11-05", primeiraVez: true });
    expect(p.dias[0]).toBe("2026-01-01");
    expect(p.dias.at(-1)).toBe("2026-11-04");
    expect(p.meses.map((m) => m.mes)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(p.meses[1]).toEqual({ mes: "2026-02", desde: "2026-02-01", ate: "2026-02-28" });
  });

  it("vira o ano", () => {
    const p = periodosConta({ hoje: "2027-01-02", primeiraVez: false });
    expect(p.meses.map((m) => m.mes)).toEqual(["2026-12", "2027-01"]);
    expect(p.dias[0]).toBe("2026-12-26");
  });
});

describe("postRecente e mesDoPost", () => {
  const agora = new Date("2026-11-05T12:00:00Z");
  it("recente é até 30 dias", () => {
    expect(postRecente(new Date("2026-10-07T12:00:00Z"), agora)).toBe(true);
    expect(postRecente(new Date("2026-10-05T11:00:00Z"), agora)).toBe(false);
  });
  it("o mês é o de São Paulo", () => {
    expect(mesDoPost(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(mesDoPost(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });
});

describe("escolherPublicacao", () => {
  const url = (c: string) => `https://www.instagram.com/p/${c}/`;
  it("liga quando há exatamente uma publicação aprovada com o mesmo código", () => {
    expect(
      escolherPublicacao("ABC", [
        { id: "1", url: url("ABC"), etapa: "aprovado" },
        { id: "2", url: url("OUTRO"), etapa: "aprovado" },
        { id: "3", url: null, etapa: "publicado" },
      ]),
    ).toBe("1");
  });
  it("não liga com duas candidatas ou conteúdo não aprovado", () => {
    expect(
      escolherPublicacao("ABC", [
        { id: "1", url: url("ABC"), etapa: "aprovado" },
        { id: "2", url: `${url("ABC")}?igsh=1`, etapa: "publicado" },
      ]),
    ).toBeNull();
    expect(escolherPublicacao("ABC", [{ id: "1", url: url("ABC"), etapa: "revisao" }])).toBeNull();
    expect(escolherPublicacao("ABC", [])).toBeNull();
  });
  it("não confunde código que é prefixo de outro", () => {
    expect(escolherPublicacao("ABC", [{ id: "1", url: url("ABCD"), etapa: "aprovado" }])).toBeNull();
  });
});

describe("permissoesFaltando", () => {
  it("lista, na ordem, as permissões não concedidas", () => {
    expect(
      permissoesFaltando([
        { permission: "instagram_basic", status: "granted" },
        { permission: "instagram_manage_insights", status: "declined" },
        { permission: "pages_read_engagement", status: "granted" },
        { permission: "ads_read", status: "granted" },
      ]),
    ).toEqual(["instagram_manage_insights", "pages_show_list"]);
  });
});

describe("mensagemErroInstagram", () => {
  it("traduz os códigos da Meta", () => {
    expect(mensagemErroInstagram(190, "x")).toBe("A chave de acesso da Meta é inválida ou foi revogada.");
    expect(mensagemErroInstagram(10, "x")).toBe("A chave não tem permissão para ler o Instagram.");
    expect(mensagemErroInstagram(200, "x")).toBe("A chave não tem permissão para ler o Instagram.");
    for (const c of [4, 17, 32, 613, 80002]) {
      expect(mensagemErroInstagram(c, "x")).toBe("A Meta limitou as consultas. Tente de novo em alguns minutos.");
    }
    expect(mensagemErroInstagram(100, "Bad")).toBe("Erro da Meta: Bad");
    expect(MENSAGEM_SEM_CONTA_INSTAGRAM).toBe(
      "Nenhuma conta do Instagram encontrada. Confira se o usuário do sistema recebeu a Página e a conta do Instagram.",
    );
  });
});

describe("podeIniciarAtualizacao", () => {
  const agora = new Date("2026-11-05T12:00:00Z");
  it("recusa com uma em andamento há menos de 30 minutos", () => {
    expect(podeIniciarAtualizacao(null, agora)).toEqual({ pode: true, expirada: false });
    expect(podeIniciarAtualizacao({ iniciadoEm: new Date("2026-11-05T11:45:00Z") }, agora)).toEqual({ pode: false, expirada: false });
    expect(podeIniciarAtualizacao({ iniciadoEm: new Date("2026-11-05T11:20:00Z") }, agora)).toEqual({ pode: true, expirada: true });
  });
});
