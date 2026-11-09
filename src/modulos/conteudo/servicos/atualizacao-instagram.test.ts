import { beforeEach, describe, expect, it } from "vitest";
import { ErroMeta } from "@/lib/meta-graph";
import type { InsightMeta } from "../regras/instagram";
import { type RepositorioInstagram, executarAtualizacao, iniciarAtualizacao } from "./atualizacao-instagram";
import type { ClienteInstagram, MidiaMeta } from "./instagram-graph";

const AGORA = new Date("2026-11-05T07:00:00Z"); // 04h em São Paulo

type Midia = {
  id: string;
  contaId: string;
  idExterno: string;
  tipo: string;
  codigo: string;
  publicadoEm: Date;
  metricasEm: Date | null;
  removidaEm: Date | null;
  publicacaoId: string | null;
  numeros: Record<string, number | null> | null;
};

/** Repositório em memória com o mínimo que a atualização usa. */
function repositorioFalso() {
  const estado = {
    atualizacoes: [] as { id: string; tipo: string; status: string; iniciadoEm: Date; registros: number; erro: string | null }[],
    contas: [] as { id: string; idExterno: string; canalId: string | null; ativa: boolean }[],
    midias: [] as Midia[],
    linhas: new Map<string, Record<string, unknown>>(),
    ligacoes: [] as { midiaId: string; publicacaoId: string }[],
    copias: 0,
    publicacoes: [] as { id: string; contaId: string; url: string | null; etapa: string }[],
  };
  let seq = 0;
  const repo: RepositorioInstagram = {
    async emAndamento(tipo) {
      return (
        estado.atualizacoes
          .filter((a) => a.tipo === tipo && a.status === "em_andamento")
          .sort((a, b) => +b.iniciadoEm - +a.iniciadoEm)[0] ?? null
      );
    },
    async marcarInterrompidas(tipo, antesDe) {
      for (const a of estado.atualizacoes)
        if (a.tipo === tipo && a.status === "em_andamento" && a.iniciadoEm < antesDe)
          Object.assign(a, { status: "falhou", erro: "Interrompida." });
    },
    async criarAtualizacao(d) {
      const a = { id: `a${++seq}`, status: "em_andamento", iniciadoEm: d.iniciadoEm ?? AGORA, registros: 0, erro: null, ...d };
      estado.atualizacoes.push(a);
      return { id: a.id };
    },
    async fecharAtualizacao(id, d) {
      Object.assign(
        estado.atualizacoes.find((a) => a.id === id)!,
        d,
      );
    },
    async salvarContas(contas) {
      for (const c of contas)
        if (!estado.contas.some((e) => e.idExterno === c.idExterno))
          estado.contas.push({ id: `c${++seq}`, idExterno: c.idExterno, canalId: null, ativa: true });
    },
    async contasParaImportar() {
      return estado.contas.filter((c) => c.ativa && c.canalId);
    },
    async temMidias(contaId) {
      return estado.midias.some((m) => m.contaId === contaId && m.tipo !== "story");
    },
    async temHistoricoConta(contaId) {
      return estado.linhas.has(`${contaId}|mes|2026-01-01`);
    },
    async salvarMidias(contaId, midias) {
      const ids = new Map<string, string>();
      for (const m of midias) {
        const atual = estado.midias.find((e) => e.idExterno === m.idExterno);
        if (atual) Object.assign(atual, { removidaEm: null });
        else
          estado.midias.push({
            id: `m${++seq}`,
            contaId,
            idExterno: m.idExterno,
            tipo: m.tipo,
            codigo: m.codigo,
            publicadoEm: m.publicadoEm,
            metricasEm: null,
            removidaEm: null,
            publicacaoId: null,
            numeros: null,
          });
        ids.set(m.idExterno, estado.midias.find((e) => e.idExterno === m.idExterno)!.id);
      }
      return ids;
    },
    async marcarRemovidas(contaId, desde, vistos, agora) {
      let n = 0;
      for (const m of estado.midias)
        if (m.contaId === contaId && m.tipo !== "story" && m.publicadoEm >= desde && !vistos.includes(m.idExterno) && !m.removidaEm) {
          m.removidaEm = agora;
          n++;
        }
      return n;
    },
    async midiasParaNumeros(contaId, o) {
      const lista = estado.midias.filter(
        (m) => m.contaId === contaId && m.tipo !== "story" && !m.removidaEm && (o.todas || !m.metricasEm || m.publicadoEm >= o.desde),
      );
      return [...lista.filter((m) => !m.metricasEm), ...lista.filter((m) => m.metricasEm)].map((m) => ({
        id: m.id,
        idExterno: m.idExterno,
        tipo: m.tipo as never,
      }));
    },
    async salvarNumerosMidia(id, numeros, agora) {
      Object.assign(
        estado.midias.find((m) => m.id === id)!,
        { numeros, metricasEm: agora },
      );
    },
    async salvarLinhaConta(contaId, periodo, dia, numeros) {
      estado.linhas.set(`${contaId}|${periodo}|${dia}`, { ...estado.linhas.get(`${contaId}|${periodo}|${dia}`), ...numeros });
    },
    async salvarSeguidores(contaId, dia, seguidores) {
      estado.linhas.set(`${contaId}|dia|${dia}`, { ...estado.linhas.get(`${contaId}|dia|${dia}`), seguidores });
    },
    async midiasSemLigacao(contaId) {
      return estado.midias
        .filter((m) => m.contaId === contaId && !m.publicacaoId && !m.removidaEm)
        .map((m) => ({ id: m.id, codigo: m.codigo }));
    },
    async publicacoesCandidatas(contaId) {
      return estado.publicacoes.filter((p) => p.contaId === contaId && !estado.ligacoes.some((l) => l.publicacaoId === p.id));
    },
    async ligar(midiaId, publicacaoId) {
      estado.ligacoes.push({ midiaId, publicacaoId });
      estado.midias.find((m) => m.id === midiaId)!.publicacaoId = publicacaoId;
    },
    async copiarNumerosLigados() {
      estado.copias++;
    },
  };
  return { estado, repo };
}

const midia = (id: string, data: string, tipo: "post" | "reels" | "story" = "post"): MidiaMeta => ({
  id,
  media_type: tipo === "reels" ? "VIDEO" : "IMAGE",
  media_product_type: tipo === "reels" ? "REELS" : tipo === "story" ? "STORY" : "FEED",
  permalink: tipo === "story" ? `https://www.instagram.com/stories/ipemaster/${id}/` : `https://www.instagram.com/p/COD${id}/`,
  timestamp: data,
});

/** Cliente falso: posts, stories e respostas configuráveis por teste. */
function clienteFalso(
  o: {
    midias?: MidiaMeta[];
    stories?: MidiaMeta[];
    erroMidia?: Record<string, ErroMeta>;
    erroConta?: ErroMeta;
    limite30Dias?: boolean;
  } = {},
) {
  const pedidos = { insightsMidia: [] as string[], insightsConta: 0, listarMidiasDesde: [] as Date[] };
  const cliente: ClienteInstagram = {
    listarContas: async () => [{ idExterno: "IG1", usuario: "ipemaster", nome: "IPEMaster", paginaId: "P1", fotoUrl: null }],
    listarMidias: async (_conta, desde) => {
      pedidos.listarMidiasDesde.push(desde);
      return (o.midias ?? []).filter((m) => new Date(m.timestamp) >= desde);
    },
    listarStories: async () => o.stories ?? [],
    insightsMidia: async (id): Promise<InsightMeta[]> => {
      pedidos.insightsMidia.push(id);
      const erro = o.erroMidia?.[id];
      if (erro) throw erro;
      return [{ name: "reach", values: [{ value: 100 }] }];
    },
    insightsConta: async (_conta, desde, ate) => {
      pedidos.insightsConta++;
      if (o.erroConta) throw o.erroConta;
      // Como a Meta: mais de 30 dias entre since e until é recusado.
      if (o.limite30Dias && (Date.parse(ate) - Date.parse(desde)) / 86_400_000 + 1 > 30)
        throw new ErroMeta("Erro da Meta: (#100) There cannot be more than 30 days (2592000 s) between since and until.", 100);
      return [{ name: "reach", total_value: { value: 50 } }];
    },
    seguidores: async () => 1000,
    permissoes: async () => [],
  };
  return { cliente, pedidos };
}

let falso: ReturnType<typeof repositorioFalso>;
beforeEach(() => {
  falso = repositorioFalso();
  process.env.META_ACCESS_TOKEN = "TOKEN";
});

/** Liga a conta IG1 a um canal, como o admin faz na tela. */
async function contaLigada() {
  await falso.repo.salvarContas([{ idExterno: "IG1", usuario: "ipemaster", nome: null, paginaId: "P1", fotoUrl: null }]);
  falso.estado.contas[0]!.canalId = "canal1";
  return falso.estado.contas[0]!.id;
}

async function rodar(
  cliente: ClienteInstagram,
  tipo: "completa" | "stories" = "completa",
  origem: "agendada" | "manual" = "agendada",
  agora = AGORA,
) {
  const inicio = await iniciarAtualizacao({ tipo, origem, agora, cliente, repo: falso.repo });
  if (inicio.status !== "iniciada") return inicio;
  return executarAtualizacao({ ...inicio, repo: falso.repo });
}

describe("atualização do Instagram", () => {
  it("sem META_ACCESS_TOKEN falha com 'Integração não configurada.'", async () => {
    delete process.env.META_ACCESS_TOKEN;
    const r = await iniciarAtualizacao({ tipo: "completa", origem: "agendada", agora: AGORA, repo: falso.repo });
    expect(r).toEqual({ status: "falhou", registros: 0, erro: "Integração não configurada." });
    expect(falso.estado.atualizacoes[0]).toMatchObject({ status: "falhou", erro: "Integração não configurada." });
  });

  it("uma completa por vez, mas stories rodam ao mesmo tempo", async () => {
    await falso.repo.criarAtualizacao({ tipo: "completa", origem: "agendada", iniciadoEm: new Date(AGORA.getTime() - 10 * 60_000) });
    const { cliente } = clienteFalso();
    expect(await iniciarAtualizacao({ tipo: "completa", origem: "manual", agora: AGORA, cliente, repo: falso.repo })).toMatchObject({
      status: "recusada",
      erro: "Já existe uma atualização em andamento.",
    });
    expect(await iniciarAtualizacao({ tipo: "stories", origem: "agendada", agora: AGORA, cliente, repo: falso.repo })).toMatchObject({
      status: "iniciada",
    });
  });

  it("sem conta ligada a canal, a primeira carga traz tudo desde 2026-01-01 só depois de ligar", async () => {
    const { cliente, pedidos } = clienteFalso({ midias: [midia("1", "2026-11-03T12:00:00Z")] });
    const r = await rodar(cliente);
    expect(r.status).toBe("concluida");
    expect(pedidos.listarMidiasDesde).toHaveLength(0);
    expect(falso.estado.contas).toHaveLength(1);
  });

  it("primeira carga traz posts e números desde 2026-01-01, e rodar de novo não duplica", async () => {
    const contaId = await contaLigada();
    const { cliente, pedidos } = clienteFalso({ midias: [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-02-01T12:00:00Z")] });
    const r = await rodar(cliente);
    expect(r.status).toBe("concluida");
    expect(pedidos.listarMidiasDesde[0]).toEqual(new Date("2026-01-01T03:00:00Z"));
    expect(falso.estado.midias).toHaveLength(2);
    expect(falso.estado.midias.every((m) => m.numeros?.alcance === 100)).toBe(true);
    expect(falso.estado.linhas.get(`${contaId}|mes|2026-01-01`)).toMatchObject({ alcance: 50 });
    expect(falso.estado.linhas.get(`${contaId}|dia|2026-11-05`)).toMatchObject({ seguidores: 1000 });

    await rodar(cliente, "completa", "agendada", new Date(AGORA.getTime() + 3600_000));
    expect(falso.estado.midias).toHaveLength(2);
    // Na segunda, só os últimos 30 dias são listados e só o post recente é reconsultado.
    expect(pedidos.listarMidiasDesde[1]).toEqual(new Date("2026-10-06T03:00:00Z"));
    expect(pedidos.insightsMidia.slice(2)).toEqual(["1"]);
  });

  it("erro num post não impede os outros e vira aviso no singular", async () => {
    await contaLigada();
    const { cliente } = clienteFalso({
      midias: [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-11-02T12:00:00Z")],
      erroMidia: { "1": new ErroMeta("Erro da Meta: x", 100) },
    });
    const r = await rodar(cliente);
    expect(r.status).toBe("concluida");
    expect(falso.estado.midias.find((m) => m.idExterno === "2")?.numeros?.alcance).toBe(100);
    expect(falso.estado.atualizacoes.at(-1)?.erro).toContain("1 post sem números nesta atualização");
  });

  it("chave inválida num post interrompe a atualização", async () => {
    await contaLigada();
    const { cliente } = clienteFalso({
      midias: [midia("1", "2026-11-03T12:00:00Z")],
      erroMidia: { "1": new ErroMeta("A chave de acesso da Meta é inválida ou foi revogada.", 190) },
    });
    const r = await rodar(cliente);
    expect(r).toMatchObject({ status: "falhou", erro: "A chave de acesso da Meta é inválida ou foi revogada." });
  });

  it("limite da Meta para os posts; a próxima rodada começa pelos que ficaram sem números", async () => {
    await contaLigada();
    const midias = [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-03-02T12:00:00Z"), midia("3", "2026-02-02T12:00:00Z")];
    const limite = new ErroMeta("A Meta limitou as consultas. Tente de novo em alguns minutos.", 4);
    const primeira = clienteFalso({ midias, erroMidia: { "2": limite } });
    const r = await rodar(primeira.cliente);
    expect(r.status).toBe("concluida");
    expect(falso.estado.atualizacoes.at(-1)?.erro).toContain("A Meta limitou as consultas.");
    expect(primeira.pedidos.insightsMidia).toEqual(["1", "2"]);
    const segunda = clienteFalso({ midias });
    await rodar(segunda.cliente, "completa", "agendada", new Date(AGORA.getTime() + 3600_000));
    expect(segunda.pedidos.insightsMidia.slice(0, 2)).toEqual(["2", "3"]);
    expect(falso.estado.midias.every((m) => m.numeros?.alcance === 100)).toBe(true);
  });

  it("post de 30 dias que sumiu da conta é marcado como removido", async () => {
    await contaLigada();
    await rodar(clienteFalso({ midias: [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-11-01T12:00:00Z")] }).cliente);
    await rodar(
      clienteFalso({ midias: [midia("1", "2026-11-03T12:00:00Z")] }).cliente,
      "completa",
      "agendada",
      new Date(AGORA.getTime() + 3600_000),
    );
    expect(falso.estado.midias.find((m) => m.idExterno === "2")?.removidaEm).not.toBeNull();
  });

  it("liga o post à publicação aprovada com o mesmo código e copia os números", async () => {
    const contaId = await contaLigada();
    falso.estado.publicacoes.push(
      { id: "pub1", contaId, url: "https://www.instagram.com/p/COD1/?igsh=abc", etapa: "aprovado" },
      { id: "pub2", contaId, url: "https://www.instagram.com/p/COD2/", etapa: "revisao" },
    );
    await rodar(clienteFalso({ midias: [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-11-02T12:00:00Z")] }).cliente);
    expect(falso.estado.ligacoes).toEqual([{ midiaId: falso.estado.midias.find((m) => m.idExterno === "1")!.id, publicacaoId: "pub1" }]);
    expect(falso.estado.copias).toBeGreaterThan(0);
  });

  it("stories: só os que estão no ar, e story com poucas visualizações não é aviso", async () => {
    await contaLigada();
    const { cliente, pedidos } = clienteFalso({
      midias: [midia("1", "2026-11-03T12:00:00Z")],
      stories: [midia("S1", "2026-11-05T05:00:00Z", "story")],
    });
    const r = await rodar(cliente, "stories");
    expect(r.status).toBe("concluida");
    expect(pedidos.insightsMidia).toEqual(["S1"]);
    expect(pedidos.listarMidiasDesde).toHaveLength(0);
    expect(falso.estado.midias.map((m) => m.tipo)).toEqual(["story"]);
    expect(falso.estado.atualizacoes.at(-1)?.erro ?? null).toBeNull();
  });

  it("'Atualizar agora' refaz os números de todos os posts", async () => {
    await contaLigada();
    const midias = [midia("1", "2026-11-03T12:00:00Z"), midia("2", "2026-02-02T12:00:00Z")];
    await rodar(clienteFalso({ midias }).cliente);
    const manual = clienteFalso({ midias });
    await rodar(manual.cliente, "completa", "manual", new Date(AGORA.getTime() + 3600_000));
    expect(manual.pedidos.insightsMidia.sort()).toEqual(["1", "2"]);
  });
  it("erro nos números da conta vira um aviso só, com a contagem de períodos", async () => {
    await contaLigada();
    const r = await rodar(clienteFalso({ erroConta: new ErroMeta("Erro da Meta: métrica indisponível", 100) }).cliente);
    expect(r.status).toBe("concluida");
    const avisos = (falso.estado.atualizacoes.at(-1)?.erro ?? "").split("\n");
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/^Números da conta: \d+ períodos sem números \(Erro da Meta: métrica indisponível\)\.$/);
  });
  it("mês de 31 dias é pedido em duas partes e não vira aviso", async () => {
    const contaId = await contaLigada();
    const r = await rodar(clienteFalso({ limite30Dias: true }).cliente);
    expect(r.status).toBe("concluida");
    expect(falso.estado.atualizacoes.at(-1)?.erro ?? null).toBeNull();
    // Alcance dos primeiros 30 dias; o resto soma o dia 31 (o falso devolve 50 por pedido).
    expect(falso.estado.linhas.get(`${contaId}|mes|2026-10-01`)).toMatchObject({ alcance: 50 });
    expect(falso.estado.linhas.get(`${contaId}|mes|2026-01-01`)).toBeDefined();
  });
});
