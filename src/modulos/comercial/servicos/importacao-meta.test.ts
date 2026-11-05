import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteMeta, InsightAnuncioMeta, InsightMeta } from "./meta-graph";
import { ErroMeta } from "./meta-graph";

// Banco em memória só com o que a importação usa.
const banco = vi.hoisted(() => {
  type Linha = Record<string, unknown> & { id: string };
  const estado = {
    contas: [] as Linha[],
    campanhas: [] as Linha[],
    metricas: [] as Linha[],
    criativos: [] as Linha[],
    metricasCriativo: [] as Linha[],
    importacoes: [] as Linha[],
    seq: 0,
  };
  const novoId = () => `id${++estado.seq}`;
  const upsertPor = (lista: Linha[], achar: (l: Linha) => boolean, create: Record<string, unknown>, update: Record<string, unknown>) => {
    const atual = lista.find(achar);
    if (atual) return Object.assign(atual, update);
    const nova = { id: novoId(), ...create };
    lista.push(nova);
    return nova;
  };
  const prisma = {
    importacaoAnuncios: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const l = { id: novoId(), status: "em_andamento", iniciadoEm: new Date(), registros: 0, ...data };
        estado.importacoes.push(l);
        return l;
      },
      findFirst: async ({ where }: { where: { status: string } }) =>
        estado.importacoes.filter((i) => i.status === where.status).sort((a, b) => +(b.iniciadoEm as Date) - +(a.iniciadoEm as Date))[0] ??
        null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Object.assign(
          estado.importacoes.find((i) => i.id === where.id)!,
          data,
        ),
      updateMany: async ({ where, data }: { where: { status: string; iniciadoEm: { lt: Date } }; data: Record<string, unknown> }) => {
        const alvo = estado.importacoes.filter((i) => i.status === where.status && (i.iniciadoEm as Date) < where.iniciadoEm.lt);
        for (const i of alvo) Object.assign(i, data);
        return { count: alvo.length };
      },
    },
    contaAnuncio: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { idExterno: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) =>
        upsertPor(
          estado.contas,
          (c) => c.idExterno === where.idExterno,
          { ativa: true, historicoCompletoEm: null, historicoCriativosEm: null, ...create },
          update,
        ),
      findMany: async ({ where }: { where: { ativa: boolean; idExterno: { in: string[] } } }) =>
        estado.contas.filter((c) => c.ativa === where.ativa && where.idExterno.in.includes(c.idExterno as string)),
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Object.assign(
          estado.contas.find((c) => c.id === where.id)!,
          data,
        ),
    },
    campanhaAnuncio: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { idExterno: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => upsertPor(estado.campanhas, (c) => c.idExterno === where.idExterno, create, update),
    },
    metricaDiariaAnuncio: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { campanhaId_data: { campanhaId: string; data: Date } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) =>
        upsertPor(
          estado.metricas,
          (m) => m.campanhaId === where.campanhaId_data.campanhaId && +(m.data as Date) === +where.campanhaId_data.data,
          create,
          update,
        ),
    },
    criativoAnuncio: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { idExterno: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => upsertPor(estado.criativos, (c) => c.idExterno === where.idExterno, create, update),
    },
    metricaDiariaCriativo: {
      deleteMany: async ({ where }: { where: { criativo: { campanha: { contaId: string } }; data: { gte: Date; lte: Date } } }) => {
        const daConta = (criativoId: unknown) => {
          const criativo = estado.criativos.find((c) => c.id === criativoId);
          return estado.campanhas.find((c) => c.id === criativo?.campanhaId)?.contaId === where.criativo.campanha.contaId;
        };
        const antes = estado.metricasCriativo.length;
        const ficam = estado.metricasCriativo.filter(
          (m) => !(daConta(m.criativoId) && (m.data as Date) >= where.data.gte && (m.data as Date) <= where.data.lte),
        );
        estado.metricasCriativo.splice(0, estado.metricasCriativo.length, ...ficam);
        return { count: antes - ficam.length };
      },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        for (const d of data) estado.metricasCriativo.push({ id: novoId(), ...d });
        return { count: data.length };
      },
    },
    $transaction: async (passos: Promise<unknown>[]) => Promise.all(passos),
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

const { importarMetaAds } = await import("./importacao-meta");

const AGORA = new Date("2026-03-05T07:00:00Z"); // 04h em São Paulo
const contas = [
  { id: "act_A", name: "Conta A", currency: "BRL", account_status: 1 },
  { id: "act_B", name: "Conta B", currency: "BRL", account_status: 1 },
];

/** Cliente falso: um dia de números por período pedido, por conta. */
function clienteFalso(
  o: {
    falharInsights?: (conta: string, desde: string) => boolean;
    falharAnuncios?: (conta: string) => boolean;
    pedidos?: string[];
    pedidosAnuncios?: string[];
    limitarDados?: boolean;
  } = {},
): ClienteMeta {
  return {
    listarContas: async () => contas,
    listarCampanhas: async (conta) => [{ id: `camp_${conta}`, name: `Campanha ${conta}`, status: "ACTIVE" }],
    listarInsights: async (conta, desde) => {
      o.pedidos?.push(`${conta}:${desde}`);
      if (o.falharInsights?.(conta, desde)) throw new ErroMeta("A Meta limitou as consultas. Tente de novo em alguns minutos.", 17);
      const linha: InsightMeta = { campaign_id: `camp_${conta}`, date_start: desde, spend: "10.00", actions: [] };
      return [linha];
    },
    listarAnuncios: async (conta) => {
      if (o.falharAnuncios?.(conta)) throw new ErroMeta("A Meta limitou as consultas. Tente de novo em alguns minutos.", 17);
      return [
        {
          id: `ad_${conta}`,
          name: `Anúncio ${conta}`,
          status: "ACTIVE",
          campaign_id: `camp_${conta}`,
          creative: { thumbnail_url: "https://cdn/mini.jpg", image_url: "https://cdn/grande.jpg" },
        },
      ];
    },
    listarInsightsAnuncios: async (conta, desde, ate) => {
      o.pedidosAnuncios?.push(`${conta}:${desde}`);
      if (o.limitarDados && desde !== ate) throw new ErroMeta("Erro da Meta: Please reduce the amount of data", 1);
      const linha: InsightAnuncioMeta = {
        ad_id: `ad_${conta}`,
        campaign_id: `camp_${conta}`,
        date_start: desde,
        spend: "5.00",
        impressions: "100",
        inline_link_clicks: "3",
        actions: [{ action_type: "onsite_conversion.lead_grouped", value: "2" }],
      };
      return [linha];
    },
  };
}

beforeEach(() => {
  banco.estado.contas.length = 0;
  banco.estado.campanhas.length = 0;
  banco.estado.metricas.length = 0;
  banco.estado.criativos.length = 0;
  banco.estado.metricasCriativo.length = 0;
  banco.estado.importacoes.length = 0;
});

describe("importarMetaAds", () => {
  it("rodar duas vezes o mesmo período não duplica números", async () => {
    await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() });
    const depoisDaPrimeira = banco.estado.metricas.length;
    await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() });
    expect(banco.estado.metricas.length).toBe(depoisDaPrimeira + 2); // só o dia novo dos "últimos 7 dias" de cada conta
    const segunda = await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() });
    expect(segunda.status).toBe("concluida");
    expect(banco.estado.metricas.length).toBe(depoisDaPrimeira + 2);
  });

  it("erro numa conta não impede a outra e fica anotado", async () => {
    const r = await importarMetaAds({
      origem: "manual",
      agora: AGORA,
      cliente: clienteFalso({ falharInsights: (conta) => conta === "act_B" }),
    });
    expect(r.status).toBe("concluida");
    expect(banco.estado.importacoes.at(-1)?.erro).toContain("Conta B (act_B)");
    expect(banco.estado.metricas.some((m) => m.campanhaId === banco.estado.campanhas.find((c) => c.idExterno === "camp_act_A")?.id)).toBe(
      true,
    );
  });

  it("carga inicial interrompida numa conta é refeita inteira na próxima vez", async () => {
    // A conta B falha no segundo bloco do histórico.
    await importarMetaAds({
      origem: "manual",
      agora: AGORA,
      cliente: clienteFalso({ falharInsights: (conta, desde) => conta === "act_B" && desde > "2026-01-01" }),
    });
    const pedidos: string[] = [];
    await importarMetaAds({ origem: "agendada", agora: AGORA, cliente: clienteFalso({ pedidos }) });
    expect(pedidos).toContain("act_B:2026-01-01"); // B volta a pedir desde o início
    expect(pedidos).not.toContain("act_A:2026-01-01"); // A já tem o histórico completo: só os últimos 7 dias
  });

  it("importa os anúncios com a miniatura (imagem grande quando há) e os números por dia, sem duplicar", async () => {
    await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() });
    const criativoA = banco.estado.criativos.find((c) => c.idExterno === "ad_act_A")!;
    expect(criativoA).toMatchObject({ nome: "Anúncio act_A", miniatura: "https://cdn/grande.jpg" });
    expect(criativoA.campanhaId).toBe(banco.estado.campanhas.find((c) => c.idExterno === "camp_act_A")?.id);
    const doA = () => banco.estado.metricasCriativo.filter((m) => m.criativoId === criativoA.id);
    expect(doA()[0]).toMatchObject({ investimento: "5.00", impressoes: 100, cliquesLink: 3, leadsFormulario: 2 });
    const antes = doA().length;
    await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() });
    expect(doA().length).toBe(antes); // o bloco dos "últimos 7 dias" é refeito, sem duplicar
  });

  it("falha nos anúncios não atrapalha as campanhas e refaz o histórico dos anúncios depois", async () => {
    const r = await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso({ falharAnuncios: (c) => c === "act_B" }) });
    expect(r.status).toBe("concluida");
    expect(banco.estado.importacoes.at(-1)?.erro).toContain("Conta B (act_B), criativos:");
    const contaB = banco.estado.contas.find((c) => c.idExterno === "act_B")!;
    expect(contaB.historicoCompletoEm).not.toBeNull();
    expect(contaB.historicoCriativosEm ?? null).toBeNull();

    const pedidosAnuncios: string[] = [];
    await importarMetaAds({ origem: "agendada", agora: AGORA, cliente: clienteFalso({ pedidosAnuncios }) });
    expect(pedidosAnuncios).toContain("act_B:2026-01-01");
    expect(pedidosAnuncios).not.toContain("act_A:2026-01-01");
  });

  it("se a Meta pedir menos dados, refaz o bloco de anúncios dia a dia", async () => {
    const r = await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso({ limitarDados: true }) });
    expect(r.status).toBe("concluida");
    expect(banco.estado.importacoes.at(-1)?.erro ?? "").not.toContain("criativos");
    expect(banco.estado.metricasCriativo.length).toBeGreaterThan(2);
  });

  it("chave sem contas atribuídas: conclui com o aviso do que fazer", async () => {
    const semContas: ClienteMeta = { ...clienteFalso(), listarContas: async () => [] };
    const r = await importarMetaAds({ origem: "manual", agora: AGORA, cliente: semContas });
    expect(r.status).toBe("concluida");
    expect(banco.estado.importacoes.at(-1)?.erro).toBe(
      "Nenhuma conta de anúncio encontrada para esta chave. No Business Manager, atribua as contas de anúncio ao usuário do sistema.",
    );
  });

  it("recusa enquanto outra importação roda; depois de 30 minutos, a antiga vira interrompida", async () => {
    banco.estado.importacoes.push({
      id: "antiga",
      status: "em_andamento",
      iniciadoEm: new Date(AGORA.getTime() - 10 * 60_000),
      registros: 0,
    });
    expect((await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() })).status).toBe("recusada");

    banco.estado.importacoes[0]!.iniciadoEm = new Date(AGORA.getTime() - 40 * 60_000);
    expect((await importarMetaAds({ origem: "manual", agora: AGORA, cliente: clienteFalso() })).status).toBe("concluida");
    expect(banco.estado.importacoes[0]).toMatchObject({ status: "falhou", erro: "Interrompida." });
  });
});
