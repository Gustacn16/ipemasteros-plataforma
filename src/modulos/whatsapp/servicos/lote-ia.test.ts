import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o lote do dia usa.
const banco = vi.hoisted(() => {
  const estado = {
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    contatos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    turmas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    resumos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    lotes: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    config: null as Record<string, any> | null, // eslint-disable-line @typescript-eslint/no-explicit-any
    gastoMes: 0,
    seq: 0,
  };
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const mesmoDia = (a: Date, b: Date) => a.getTime() === b.getTime();
  const resumoCombina = (r: Linha, where: Linha) => {
    if (where.id?.in && !where.id.in.includes(r.id)) return false;
    if (where.situacao?.not && r.situacao === where.situacao.not) return false;
    return true;
  };
  const porChave = (w: Linha) =>
    estado.resumos.find((r) => r.conversaId === w.conversaId_dia.conversaId && mesmoDia(r.dia, w.conversaId_dia.dia));
  const prisma = {
    configuracaoWhatsapp: { findUnique: async () => estado.config },
    usoIa: {
      aggregate: async ({ where }: { where: Linha }) => {
        if (where.origem !== "whatsapp") throw new Error("origem errada");
        return { _sum: { custoMicroUsd: estado.gastoMes } };
      },
    },
    loteIa: {
      findFirst: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.lotes.find((l) => l.tipo === where.tipo && mesmoDia(l.dia, where.dia)) ?? null;
      },
      create: async ({ data }: { data: Linha }) => {
        const l = { id: `lote${++estado.seq}`, situacao: "aberto", ...data };
        estado.lotes.push(l);
        return { id: l.id };
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.conversas
          .filter((c) => c.tipo === where.tipo && c.monitorada === where.monitorada)
          .map((c) => ({ id: c.id, nome: c.nome, turma: estado.turmas.find((t) => t.id === c.turmaId) ?? null }));
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.mensagens
          .filter((m) => m.conversaId === where.conversaId && m.enviadaEm >= where.enviadaEm.gte && m.enviadaEm < where.enviadaEm.lt)
          .sort((a, b) => a.enviadaEm - b.enviadaEm)
          .map((m) => {
            const c = estado.contatos.find((x) => x.id === m.contatoId);
            return {
              enviadaEm: m.enviadaEm,
              deMim: m.deMim,
              tipo: m.tipo,
              texto: m.texto,
              contato: c ? { nomeExibido: c.nomeExibido, usuarioId: c.usuarioId } : null,
            };
          });
      },
    },
    resumoGrupo: {
      findUnique: async ({ where }: { where: Linha }) => porChave(where) ?? null,
      upsert: async ({ where, create, update }: { where: Linha; create: Linha; update: Linha }) => {
        const atual = porChave(where);
        if (atual) {
          Object.assign(atual, update);
          return { id: atual.id };
        }
        const r = { id: `res${++estado.seq}`, ...create };
        estado.resumos.push(r);
        return { id: r.id };
      },
      updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
        const alvo = estado.resumos.filter((r) => resumoCombina(r, where));
        alvo.forEach((r) => Object.assign(r, data));
        return { count: alvo.length };
      },
    },
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/ia/cliente", () => ({ obterClienteAnthropic: () => null }));

import { calcularCustoMicroUsd } from "@/lib/ia/precos";
import { INSTRUCOES_RESUMO } from "../ia/resumo-grupo";
import { criarLoteDoDia, type ClienteLotes, type ResultadoLote } from "./lote-ia";

// 18/11 às 07:30 UTC (04:30 em São Paulo): "ontem" é 17/11 de 03:00Z até 18/11 03:00Z.
const AGORA = new Date("2026-11-18T07:30:00Z");
const DIA = new Date("2026-11-17T00:00:00.000Z");
const ONTEM = (h: number) => new Date(Date.UTC(2026, 10, 17, 3 + h));

function clienteFalso(opcoes: { falhar?: boolean } = {}) {
  const enviados: unknown[][] = [];
  const cliente: ClienteLotes = {
    async criar(requisicoes) {
      if (opcoes.falhar) throw new Error("rede");
      enviados.push(requisicoes);
      return { id: "msgbatch_1" };
    },
    async buscar() {
      return { processing_status: "in_progress" };
    },
    async *resultados(): AsyncIterable<ResultadoLote> {},
  };
  return { cliente, enviados };
}

function grupo(id: string, dados: Linha = {}) {
  banco.estado.conversas.push({ id, tipo: "grupo", monitorada: true, nome: `Grupo ${id}`, turmaId: null, ...dados });
}
let n = 0;
function mensagem(conversaId: string, dados: Linha = {}) {
  banco.estado.mensagens.push({
    id: `m${++n}`,
    conversaId,
    deMim: false,
    tipo: "texto",
    texto: "oi",
    contatoId: null,
    enviadaEm: ONTEM(2),
    ...dados,
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pedidosDe = (enviados: unknown[][]) => enviados[0] as any[];

beforeEach(() => {
  Object.assign(banco.estado, {
    conversas: [],
    mensagens: [],
    contatos: [],
    turmas: [],
    resumos: [],
    lotes: [],
    config: null,
    gastoMes: 0,
    seq: 0,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarLoteDoDia", () => {
  it("sem ANTHROPIC_API_KEY (cliente null) não faz nada: motivo sem_chave", async () => {
    grupo("g1");
    mensagem("g1");
    expect(await criarLoteDoDia(AGORA, null)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "sem_chave" });
    // Sem cliente explícito, usa obterClienteAnthropic(), que aqui devolve null.
    expect(await criarLoteDoDia(AGORA)).toMatchObject({ motivo: "sem_chave" });
    expect(banco.estado.resumos).toHaveLength(0);
  });

  it("já existe LoteIa resumo_grupo do dia: motivo ja_existe, nenhuma requisição", async () => {
    grupo("g1");
    mensagem("g1");
    banco.estado.lotes.push({ id: "l0", idExterno: "x", tipo: "resumo_grupo", dia: DIA, situacao: "aberto" });
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ criado: false, motivo: "ja_existe" });
    expect(enviados).toHaveLength(0);
    expect(banco.estado.resumos).toHaveLength(0);
  });

  it("um pedido por grupo monitorado com mensagem ontem; grupo não monitorado ou sem mensagem fica fora", async () => {
    grupo("g1");
    grupo("g2");
    grupo("g3", { monitorada: false });
    grupo("g4");
    mensagem("g1");
    mensagem("g2", { enviadaEm: ONTEM(20) });
    mensagem("g3");
    mensagem("g4", { enviadaEm: ONTEM(-1) }); // anteontem em São Paulo
    mensagem("g4", { enviadaEm: ONTEM(24) }); // hoje em São Paulo
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: true, pedidos: 2, semVerba: 0 });
    expect(enviados).toHaveLength(1);
    expect(pedidosDe(enviados)).toHaveLength(2);
    expect(banco.estado.resumos.map((r) => r.conversaId).sort()).toEqual(["g1", "g2"]);
    expect(banco.estado.lotes).toEqual([
      expect.objectContaining({ idExterno: "msgbatch_1", tipo: "resumo_grupo", dia: DIA, situacao: "aberto" }),
    ]);
    // Segunda execução no mesmo dia: trava.
    expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ motivo: "ja_existe" });
  });

  it("cria ResumoGrupo pendente com participação e totalMensagens antes de enviar; custom_id = resumo:<id>", async () => {
    banco.estado.turmas.push({ id: "t1", nome: "Turma A" });
    banco.estado.contatos.push(
      { id: "c1", nomeExibido: "Ana", usuarioId: null },
      { id: "c2", nomeExibido: "Bruno", usuarioId: "u1" },
      { id: "c3", nomeExibido: null, usuarioId: null },
    );
    grupo("g1", { turmaId: "t1" });
    mensagem("g1", { contatoId: "c1", texto: "dúvida", enviadaEm: ONTEM(1) });
    mensagem("g1", { contatoId: "c1", texto: "alguém?", enviadaEm: ONTEM(2) });
    mensagem("g1", { contatoId: "c2", texto: "respondo", enviadaEm: ONTEM(3) });
    mensagem("g1", { contatoId: "c3", texto: "eu também", enviadaEm: ONTEM(4) });
    mensagem("g1", { deMim: true, texto: "aviso", enviadaEm: ONTEM(5) });

    let resumosNoEnvio: Linha[] = [];
    const { cliente, enviados } = clienteFalso();
    const criar = cliente.criar;
    cliente.criar = async (r) => {
      resumosNoEnvio = banco.estado.resumos.map((x) => ({ ...x }));
      return criar(r);
    };
    await criarLoteDoDia(AGORA, cliente);

    expect(resumosNoEnvio).toEqual([
      expect.objectContaining({
        conversaId: "g1",
        dia: DIA,
        situacao: "pendente",
        totalMensagens: 5,
        modelo: "claude-opus-5-5",
        participacao: [
          { autor: "Ana", mensagens: 2 },
          { autor: "Participante", mensagens: 1 },
        ],
      }),
    ]);
    const resumo = banco.estado.resumos[0];
    const [pedido] = pedidosDe(enviados);
    expect(pedido.custom_id).toBe(`resumo:${resumo.id}`);
    expect(pedido.params.model).toBe("claude-opus-5-5");
    const entrada: string = pedido.params.messages[0].content;
    expect(entrada).toContain("Turma: Turma A");
    expect(entrada).toContain("Bruno (equipe): respondo");
    expect(entrada).toContain("Equipe IPEMaster (equipe): aviso");
    expect(entrada).toContain("Participante: eu também");
    expect(resumo.loteId).toBe(banco.estado.lotes[0].id);
  });

  it("verba restante só cabe em 1 dos 2 grupos: entra o de mais mensagens, o outro fica falhou com o texto do limite", async () => {
    grupo("g1");
    grupo("g2");
    mensagem("g1");
    mensagem("g2");
    mensagem("g2", { enviadaEm: ONTEM(3) });
    // Custo estimado por pedido (entradas pequenas e parecidas): basta para um, não para dois.
    const estimativa = calcularCustoMicroUsd(
      "claude-opus-5-5",
      { entrada: Math.ceil((INSTRUCOES_RESUMO.length + 60) / 3), cacheEscrita: 0, cacheLeitura: 0, saida: 8000 },
      { lote: true },
    );
    banco.estado.config = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 10_000_000 };
    banco.estado.gastoMes = 10_000_000 - Math.floor(estimativa * 1.5);

    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: true, pedidos: 1, semVerba: 1 });
    const g1 = banco.estado.resumos.find((r) => r.conversaId === "g1")!;
    const g2 = banco.estado.resumos.find((r) => r.conversaId === "g2")!;
    expect(pedidosDe(enviados).map((p) => p.custom_id)).toEqual([`resumo:${g2.id}`]);
    expect(g2).toMatchObject({ situacao: "pendente", loteId: banco.estado.lotes[0].id });
    expect(g1).toMatchObject({ situacao: "falhou", erro: "Limite mensal de IA do WhatsApp atingido.", loteId: null });
  });

  it("sem verba para nenhum grupo: nada_a_fazer e nenhum lote", async () => {
    grupo("g1");
    mensagem("g1");
    banco.estado.gastoMes = 80_000_000;
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 1, motivo: "nada_a_fazer" });
    expect(enviados).toHaveLength(0);
    expect(banco.estado.lotes).toHaveLength(0);
  });

  it("resumo já pronto do dia não é refeito", async () => {
    grupo("g1");
    mensagem("g1");
    banco.estado.resumos.push({ id: "r0", conversaId: "g1", dia: DIA, situacao: "pronto", resumo: "ok" });
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ criado: false, motivo: "nada_a_fazer" });
    expect(enviados).toHaveLength(0);
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pronto", resumo: "ok" });
  });

  it("falha ao criar o lote: resumos do dia viram falhou e nada de LoteIa", async () => {
    grupo("g1");
    grupo("g2");
    mensagem("g1", { texto: "segredo do aluno" });
    mensagem("g2");
    const { cliente } = clienteFalso({ falhar: true });
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 0 });
    expect(banco.estado.lotes).toHaveLength(0);
    expect(banco.estado.resumos).toHaveLength(2);
    for (const r of banco.estado.resumos) expect(r).toMatchObject({ situacao: "falhou", erro: "Não foi possível enviar o lote." });
    // O log leva só o nome do erro.
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("segredo");
  });
});
