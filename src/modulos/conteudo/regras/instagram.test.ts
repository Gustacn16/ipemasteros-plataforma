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
  atualizacaoRodando,
  relatorioDoMes,
  diasFechados,
  variacao,
  validarLigacao,
  ordenarCandidatas,
  ordenarMidias,
  lerOrdem,
  dividirPeriodoConta,
  juntarNumerosConta,
  alcanceAproximado,
  type NumerosConta,
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

describe("atualizacaoRodando", () => {
  it("só conta a em andamento há menos de 30 minutos", () => {
    const agora = new Date("2026-11-05T12:00:00Z");
    expect(atualizacaoRodando([{ status: "em_andamento", iniciadoEm: "2026-11-05T11:50:00Z" }], agora)).toBe(true);
    expect(atualizacaoRodando([{ status: "em_andamento", iniciadoEm: "2026-11-05T11:00:00Z" }], agora)).toBe(false);
    expect(atualizacaoRodando([{ status: "concluida", iniciadoEm: "2026-11-05T11:59:00Z" }], agora)).toBe(false);
  });
});

describe("variacao e relatorioDoMes", () => {
  const conta = (n: Partial<NumerosConta>): NumerosConta => ({
    alcance: null,
    visualizacoes: null,
    interacoes: null,
    curtidas: null,
    comentarios: null,
    salvamentos: null,
    compartilhamentos: null,
    cliquesLink: null,
    novosSeguidores: null,
    deixaramDeSeguir: null,
    ...n,
  });

  it("variação em % arredondada; divisor zero ou ausente é null", () => {
    expect(variacao(112, 100)).toBe(12);
    expect(variacao(90, 120)).toBe(-25);
    expect(variacao(10, 0)).toBeNull();
    expect(variacao(null, 10)).toBeNull();
    expect(variacao(10, null)).toBeNull();
  });

  it("dias fechados: no mês atual, até ontem; mês passado é inteiro (null)", () => {
    expect(diasFechados("2026-11", "2026-11-12")).toBe(11);
    expect(diasFechados("2026-11", "2026-11-01")).toBe(0);
    expect(diasFechados("2026-10", "2026-11-12")).toBeNull();
  });

  it("monta os cartões do mês fechado, comparando com o mês anterior inteiro", () => {
    const c = relatorioDoMes({
      mes: conta({
        alcance: 5000,
        visualizacoes: 9000,
        interacoes: 300,
        curtidas: 200,
        comentarios: 50,
        salvamentos: 30,
        compartilhamentos: 20,
        novosSeguidores: 80,
        deixaramDeSeguir: 30,
      }),
      comparacao: conta({ alcance: 4000, visualizacoes: 9000, interacoes: 0 }),
      parcial: false,
      seguidores: 1100,
      visitasPerfil: 60,
      visitasPerfilAnterior: 40,
    });
    expect(c.alcance).toEqual({ valor: 5000, variacao: 25 });
    expect(c.visualizacoes).toEqual({ valor: 9000, variacao: 0 });
    expect(c.interacoes).toEqual({ valor: 300, variacao: null, curtidas: 200, comentarios: 50, salvamentos: 30, compartilhamentos: 20 });
    expect(c.seguidores).toEqual({ valor: 1100, novos: 80, sairam: 30, saldo: 50 });
    expect(c.visitasPerfil).toEqual({ valor: 60, variacao: 50 });
  });

  it("no mês em andamento, o alcance fica sem comparação (pessoas únicas não se somam por dia)", () => {
    const c = relatorioDoMes({
      mes: conta({ alcance: 5000, visualizacoes: 1200 }),
      comparacao: conta({ alcance: 9000, visualizacoes: 1000 }),
      parcial: true,
      seguidores: null,
      visitasPerfil: null,
      visitasPerfilAnterior: null,
    });
    expect(c.alcance).toEqual({ valor: 5000, variacao: null });
    expect(c.visualizacoes).toEqual({ valor: 1200, variacao: 20 });
  });

  it("sem números, tudo vazio e saldo só com novos e saídas", () => {
    const c = relatorioDoMes({
      mes: conta({ novosSeguidores: 10 }),
      comparacao: null,
      parcial: false,
      seguidores: null,
      visitasPerfil: null,
      visitasPerfilAnterior: null,
    });
    expect(c.alcance).toEqual({ valor: null, variacao: null });
    expect(c.seguidores).toEqual({ valor: null, novos: 10, sairam: null, saldo: null });
  });
});

describe("validarLigacao", () => {
  const midia = { removidaEm: null, canalId: "ig" };
  const pub = { canalId: "ig", temMidia: false, etapa: "aprovado", excluido: false };
  it("aceita publicação do mesmo canal, livre e de conteúdo aprovado ou publicado", () => {
    expect(validarLigacao(midia, pub)).toBeNull();
    expect(validarLigacao(midia, { ...pub, etapa: "publicado" })).toBeNull();
  });
  it("recusa com mensagens em português", () => {
    expect(validarLigacao({ ...midia, removidaEm: new Date() }, pub)).toBe("Este post foi removido do Instagram.");
    expect(validarLigacao(midia, { ...pub, canalId: "outro" })).toBe("A publicação precisa ser do mesmo canal do Instagram.");
    expect(validarLigacao(midia, { ...pub, temMidia: true })).toBe("Esta publicação já está ligada a outro post.");
    expect(validarLigacao(midia, { ...pub, etapa: "revisao" })).toBe("O conteúdo precisa estar aprovado antes de ser ligado a um post.");
    expect(validarLigacao(midia, { ...pub, excluido: true })).toBe("Não encontrado.");
  });
});

describe("ordenarCandidatas", () => {
  it("a data de publicação mais próxima do post vem primeiro; sem data, por último", () => {
    const post = new Date("2026-11-10T12:00:00Z");
    const r = ordenarCandidatas(post, [
      { id: "longe", dataPublicacao: new Date("2026-10-01T00:00:00Z") },
      { id: "sem", dataPublicacao: null },
      { id: "perto", dataPublicacao: new Date("2026-11-11T00:00:00Z") },
    ]);
    expect(r.map((c) => c.id)).toEqual(["perto", "longe", "sem"]);
  });
});

describe("ordenarMidias e lerOrdem", () => {
  const m = (id: string, publicadoEm: string, alcance: number | null, interacoes: number | null) => ({
    id,
    publicadoEm: new Date(publicadoEm),
    alcance,
    interacoes,
  });
  const lista = [m("a", "2026-11-01T00:00:00Z", 10, 5), m("b", "2026-11-03T00:00:00Z", null, 50), m("c", "2026-11-02T00:00:00Z", 99, null)];
  it("ordena por data, alcance ou interações, com '—' por último", () => {
    expect(ordenarMidias(lista, "data").map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(ordenarMidias(lista, "alcance").map((x) => x.id)).toEqual(["c", "a", "b"]);
    expect(ordenarMidias(lista, "interacoes").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("ordem desconhecida vira data", () => {
    expect(lerOrdem("alcance")).toBe("alcance");
    expect(lerOrdem("x")).toBe("data");
    expect(lerOrdem(undefined)).toBe("data");
  });
});

describe("meses de 31 dias (a Meta aceita no máximo 30 dias por pedido)", () => {
  it("divide o mês em 30 dias mais o dia 31", () => {
    expect(dividirPeriodoConta("2026-10-01", "2026-10-31")).toEqual({
      principal: { desde: "2026-10-01", ate: "2026-10-30" },
      extra: "2026-10-31",
    });
    expect(dividirPeriodoConta("2026-11-01", "2026-11-30")).toEqual({ principal: { desde: "2026-11-01", ate: "2026-11-30" }, extra: null });
    expect(dividirPeriodoConta("2026-11-01", "2026-11-08")).toEqual({ principal: { desde: "2026-11-01", ate: "2026-11-08" }, extra: null });
  });

  it("junta o dia 31 somando tudo, menos o alcance (pessoas únicas)", () => {
    const base = lerInsightsConta([
      { name: "reach", total_value: { value: 1000 } },
      { name: "views", total_value: { value: 5000 } },
      { name: "profile_links_taps", total_value: { value: 10 } },
    ]);
    const dia31 = lerInsightsConta([
      { name: "reach", total_value: { value: 300 } },
      { name: "views", total_value: { value: 200 } },
      { name: "total_interactions", total_value: { value: 7 } },
    ]);
    expect(juntarNumerosConta(base, dia31)).toMatchObject({
      alcance: 1000,
      visualizacoes: 5200,
      cliquesLink: 10,
      interacoes: 7,
      curtidas: null,
    });
  });

  it("o alcance do mês é aproximado só quando o mês de 31 dias chegou ao dia 31", () => {
    expect(alcanceAproximado("2026-10", "2026-11-09")).toBe(true);
    expect(alcanceAproximado("2026-11", "2026-12-09")).toBe(false);
    expect(alcanceAproximado("2026-12", "2026-12-15")).toBe(false);
    expect(alcanceAproximado("2026-12", "2027-01-01")).toBe(true);
  });
});
