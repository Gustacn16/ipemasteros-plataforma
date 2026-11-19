import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { REGRAS_PADRAO } from "../esquemas/regras-atendimento";
import { semanaDaConsulta, ultimasSemanas } from "../regras/dia";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    metricas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    consultasMensagens: 0,
  };
  // Como no mock de saude.test.ts: o LIKE do MySQL da Hostinger não pode ser usado.
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const confere = (valor: unknown, filtro: any): boolean => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (filtro === undefined) return true;
    if (filtro !== null && typeof filtro === "object" && !(filtro instanceof Date)) {
      if ("in" in filtro) return filtro.in.includes(valor);
      if ("gte" in filtro && !((valor as Date) >= filtro.gte)) return false;
      if ("lt" in filtro && !((valor as Date) < filtro.lt)) return false;
      return true;
    }
    return valor === filtro;
  };
  const numeroDe = (id: string | null) => estado.numeros.find((n) => n.id === id);
  const prisma = {
    numeroWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.numeros
          .filter((n) => confere(n.excluidoEm, where.excluidoEm) && confere(n.id, where.id))
          .map((n) => ({ ...n }));
      },
    },
    metricaAtendimentoDia: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.metricas.filter((m) => confere(m.numeroId, where.numeroId) && confere(m.dia, where.dia)).map((m) => ({ ...m }));
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.conversas
          .filter(
            (c) =>
              confere(c.tipo, where.tipo) &&
              confere(c.categoria, where.categoria) &&
              confere(c.ultimaMensagemEm, where.ultimaMensagemEm) &&
              (where.numero?.excluidoEm !== null || numeroDe(c.numeroId)?.excluidoEm === null),
          )
          .map((c) => ({ ...c, numero: { nome: numeroDe(c.numeroId)?.nome } }));
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        estado.consultasMensagens++;
        return estado.mensagens
          .filter((m) => confere(m.conversaId, where.conversaId) && confere(m.enviadaEm, where.enviadaEm))
          .sort((a, b) => a.enviadaEm.getTime() - b.enviadaEm.getTime() || a.id.localeCompare(b.id))
          .map((m) => ({ conversaId: m.conversaId, deMim: m.deMim, enviadaEm: m.enviadaEm }));
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("./configuracao", () => ({ obterRegrasAtendimento: async () => REGRAS_PADRAO }));

import { evolucaoDoNumero, resumoDaSemana, semRespostaAgora } from "./painel-atendimento";

const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const comercial = { id: "c1", papel: "comercial" } as UsuarioAtual;
// Quarta 18/11/2026, 12h em SP (15h UTC): dentro do horário comercial.
const agora = new Date("2026-11-18T15:00:00Z");
const semana = semanaDaConsulta("2026-11-16", agora);
const min = (m: number) => new Date(agora.getTime() - m * 60_000);

const numero = (id: string, extra: Linha = {}) => ({
  id,
  nome: `Número ${id}`,
  time: "comercial",
  excluidoEm: null,
  usuario: { nome: "Ana Souza", apelido: "Ana" },
  ...extra,
});
const metrica = (numeroId: string, dia: string, extra: Linha = {}) => ({
  numeroId,
  dia: new Date(`${dia}T00:00:00.000Z`),
  time: "comercial",
  conversasComCliente: 1,
  primeirasRespostasSeg: [],
  respostasSeg: [],
  respostasNoSla: 0,
  semResposta: 0,
  followupsFeitos: 0,
  followupsPerdidos: 0,
  ...extra,
});
const conversa = (id: string, numeroId: string, extra: Linha = {}) => ({
  id,
  numeroId,
  tipo: "individual",
  categoria: "lead",
  nome: null,
  contato: { nomeExibido: `Contato ${id}` },
  ultimaMensagemEm: min(5),
  ...extra,
});
let seq = 0;
const msg = (conversaId: string, deMim: boolean, enviadaEm: Date) => ({ id: `m${String(++seq).padStart(4, "0")}`, conversaId, deMim, enviadaEm });

beforeEach(() => {
  banco.estado.numeros = [];
  banco.estado.metricas = [];
  banco.estado.conversas = [];
  banco.estado.mensagens = [];
  banco.estado.consultasMensagens = 0;
});

describe("resumoDaSemana", () => {
  it("resumoDaSemana junta as listas antes da mediana", async () => {
    banco.estado.numeros = [numero("n1")];
    banco.estado.metricas = [
      metrica("n1", "2026-11-16", { primeirasRespostasSeg: [60, 120], respostasSeg: [60, 120], respostasNoSla: 2 }),
      metrica("n1", "2026-11-17", { primeirasRespostasSeg: [600], respostasSeg: [600], conversasComCliente: 2 }),
      // Fora da semana: não entra.
      metrica("n1", "2026-11-23", { primeirasRespostasSeg: [9000], respostasSeg: [9000] }),
      metrica("n1", "2026-11-15", { primeirasRespostasSeg: [9000], respostasSeg: [9000] }),
    ];
    const [linha] = await resumoDaSemana(gestor, semana, { agora });
    expect(linha).toMatchObject({ numeroId: "n1", nome: "Número n1", dono: "Ana", time: "comercial", conversas: 3 });
    expect(linha.primeiraRespostaSeg).toBe(120);
    expect(linha.respostaSeg).toBe(120);
  });

  it("número sem linhas na semana dá tempos null e pct null", async () => {
    banco.estado.numeros = [numero("n1", { usuario: null }), numero("n2", { excluidoEm: min(60) })];
    const linhas = await resumoDaSemana(gestor, semana, { agora });
    expect(linhas).toEqual([
      {
        numeroId: "n1",
        nome: "Número n1",
        dono: null,
        time: "comercial",
        conversas: 0,
        primeiraRespostaSeg: null,
        respostaSeg: null,
        noSlaPct: null,
        followupPct: null,
        semRespostaAgora: 0,
      },
    ]);
  });

  it("noSlaPct conta semResposta no total", async () => {
    banco.estado.numeros = [numero("n1")];
    banco.estado.metricas = [
      metrica("n1", "2026-11-16", { respostasSeg: [60, 120, 3000], respostasNoSla: 2, semResposta: 1, followupsFeitos: 3, followupsPerdidos: 1 }),
    ];
    const [linha] = await resumoDaSemana(gestor, semana, { agora });
    expect(linha.noSlaPct).toBe(50); // 2 ÷ (3 + 1)
    expect(linha.followupPct).toBe(75);
  });

  it("followupPct só para números de venda: cs dá null, comercial dá o valor", async () => {
    banco.estado.numeros = [numero("n1", { time: "cs" }), numero("n2", { time: "comercial" }), numero("n3", { time: "outro" })];
    banco.estado.metricas = [
      metrica("n1", "2026-11-16", { followupsFeitos: 3, followupsPerdidos: 1 }),
      metrica("n2", "2026-11-16", { followupsFeitos: 3, followupsPerdidos: 1 }),
      metrica("n3", "2026-11-16", { followupsFeitos: 3, followupsPerdidos: 1 }),
    ];
    banco.estado.conversas = [conversa("c1", "n1")];
    banco.estado.mensagens = [msg("c1", false, min(40))];
    const linhas = await resumoDaSemana(gestor, semana, { agora });
    expect(linhas.map((l) => [l.numeroId, l.followupPct, l.semRespostaAgora])).toEqual([
      ["n1", null, 1],
      ["n2", 75, 0],
      ["n3", null, 0],
    ]);
  });

  it("semRespostaAgora da linha é a contagem ao vivo do número", async () => {
    banco.estado.numeros = [numero("n1"), numero("n2")];
    banco.estado.conversas = [conversa("c1", "n1"), conversa("c2", "n1"), conversa("c3", "n2")];
    banco.estado.mensagens = [msg("c1", false, min(40)), msg("c2", false, min(30)), msg("c3", false, min(5))];
    const linhas = await resumoDaSemana(gestor, semana, { agora });
    expect(linhas.map((l) => [l.numeroId, l.semRespostaAgora])).toEqual([
      ["n1", 2],
      ["n2", 0],
    ]);
  });
});

describe("semRespostaAgora", () => {
  it("semRespostaAgora ignora vez aberta dentro do SLA e conversa equipe", async () => {
    banco.estado.numeros = [numero("n1"), numero("n9", { excluidoEm: min(60) })];
    banco.estado.conversas = [
      conversa("aberta", "n1", { contato: null, nome: "Maria" }),
      conversa("mais-antiga", "n1", { contato: null }),
      conversa("no-sla", "n1"),
      conversa("respondida", "n1"),
      conversa("equipe", "n1", { categoria: "equipe" }),
      conversa("grupo", "n1", { tipo: "grupo" }),
      conversa("excluido", "n9"),
      conversa("velha", "n1", { ultimaMensagemEm: new Date(agora.getTime() - 31 * 86_400_000) }),
    ];
    banco.estado.mensagens = [
      msg("aberta", true, min(60)),
      msg("aberta", false, min(30)),
      msg("aberta", false, min(25)),
      msg("mais-antiga", false, min(90)),
      msg("no-sla", false, min(10)),
      msg("respondida", false, min(60)),
      msg("respondida", true, min(50)),
      msg("equipe", false, min(60)),
      msg("grupo", false, min(60)),
      msg("excluido", false, min(60)),
      msg("velha", false, min(60)),
    ];
    const lista = await semRespostaAgora(gestor, agora);
    expect(lista.map((i) => i.conversaId)).toEqual(["mais-antiga", "aberta"]);
    expect(lista[0]).toEqual({
      conversaId: "mais-antiga",
      numeroId: "n1",
      numeroNome: "Número n1",
      contatoNome: "Sem nome",
      desde: min(90),
      segundos: 90 * 60,
    });
    expect(lista[1]).toMatchObject({ contatoNome: "Maria", desde: min(30), segundos: 30 * 60 });
    expect(banco.estado.consultasMensagens).toBe(1);
  });

  it("conversa com a última mensagem do cliente há 10 dias e sem resposta aparece", async () => {
    banco.estado.numeros = [numero("n1")];
    const dezDias = new Date(agora.getTime() - 10 * 86_400_000);
    banco.estado.conversas = [
      conversa("antiga", "n1", { ultimaMensagemEm: dezDias }),
      conversa("fora", "n1", { ultimaMensagemEm: new Date(agora.getTime() - 31 * 86_400_000) }),
    ];
    banco.estado.mensagens = [msg("antiga", false, dezDias), msg("fora", false, new Date(agora.getTime() - 31 * 86_400_000))];
    const lista = await semRespostaAgora(gestor, agora);
    expect(lista.map((i) => i.conversaId)).toEqual(["antiga"]);
    expect(lista[0]!.desde).toEqual(dezDias);
  });

  it("sem conversas não consulta mensagens", async () => {
    expect(await semRespostaAgora(gestor, agora)).toEqual([]);
    expect(banco.estado.consultasMensagens).toBe(0);
  });

  it("comercial lança ErroPermissao nos três", async () => {
    await expect(resumoDaSemana(comercial, semana, { agora })).rejects.toThrow(ErroPermissao);
    await expect(evolucaoDoNumero(comercial, "n1", ultimasSemanas(agora, 8))).rejects.toThrow(ErroPermissao);
    await expect(semRespostaAgora(comercial, agora)).rejects.toThrow(ErroPermissao);
  });
});

describe("evolucaoDoNumero", () => {
  it("uma linha por semana, em minutos, com null onde não há dado", async () => {
    banco.estado.numeros = [numero("n1")];
    banco.estado.metricas = [
      metrica("n1", "2026-11-16", { primeirasRespostasSeg: [120, 240], respostasSeg: [90], respostasNoSla: 1, followupsFeitos: 1 }),
      metrica("n1", "2026-11-09", { primeirasRespostasSeg: [], respostasSeg: [], semResposta: 2 }),
      metrica("n2", "2026-11-16", { primeirasRespostasSeg: [9000] }),
    ];
    const semanas = ultimasSemanas(agora, 3);
    const pontos = await evolucaoDoNumero(gestor, "n1", semanas);
    expect(pontos).toEqual([
      { rotulo: "02/11 a 08/11", primeiraRespostaMin: null, respostaMin: null, noSlaPct: null, followupPct: null },
      { rotulo: "09/11 a 15/11", primeiraRespostaMin: null, respostaMin: null, noSlaPct: 0, followupPct: null },
      { rotulo: "16/11 a 22/11", primeiraRespostaMin: 3, respostaMin: 1.5, noSlaPct: 100, followupPct: 100 },
    ]);
  });

  it("número cs não tem follow-up na evolução", async () => {
    banco.estado.numeros = [numero("n1", { time: "cs" })];
    banco.estado.metricas = [metrica("n1", "2026-11-16", { respostasSeg: [90], respostasNoSla: 1, followupsFeitos: 1 })];
    const pontos = await evolucaoDoNumero(gestor, "n1", ultimasSemanas(agora, 1));
    expect(pontos).toEqual([{ rotulo: "16/11 a 22/11", primeiraRespostaMin: null, respostaMin: 1.5, noSlaPct: 100, followupPct: null }]);
  });
});
