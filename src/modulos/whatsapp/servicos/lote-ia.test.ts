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
    usos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    gastoMes: 0,
    seq: 0,
    falharUpdateLote: false,
  };
  const p2002 = () => Object.assign(new Error("único"), { code: "P2002" });
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const mesmoDia = (a: Date, b: Date) => a.getTime() === b.getTime();
  const resumoCombina = (r: Linha, where: Linha) => {
    if (where.id?.in && !where.id.in.includes(r.id)) return false;
    if (where.situacao?.not && r.situacao === where.situacao.not) return false;
    if (typeof where.situacao === "string" && r.situacao !== where.situacao) return false;
    if (where.id !== undefined && typeof where.id === "string" && r.id !== where.id) return false;
    if (where.loteId !== undefined && r.loteId !== where.loteId) return false;
    if (where.conversaId !== undefined && r.conversaId !== where.conversaId) return false;
    if (where.dia !== undefined && !mesmoDia(r.dia, where.dia)) return false;
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
      create: async ({ data }: { data: Linha }) => {
        estado.usos.push(data);
        return data;
      },
    },
    loteIa: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.lotes
          .filter((l) => l.tipo === where.tipo && l.situacao === where.situacao)
          .map((l) => ({ id: l.id, idExterno: l.idExterno, criadoEm: l.criadoEm }));
      },
      findFirst: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.lotes.find((l) => l.tipo === where.tipo && mesmoDia(l.dia, where.dia)) ?? null;
      },
      // Respeita o único (tipo, dia) como o MySQL: o segundo create do dia dá P2002.
      create: async ({ data }: { data: Linha }) => {
        await Promise.resolve();
        if (estado.lotes.some((l) => l.tipo === data.tipo && mesmoDia(l.dia, data.dia))) throw p2002();
        const l = { id: `lote${++estado.seq}`, situacao: "aberto", idExterno: null, criadoEm: new Date(), ...data };
        estado.lotes.push(l);
        return { id: l.id };
      },
      update: async ({ where, data }: { where: Linha; data: Linha }) => {
        if (estado.falharUpdateLote) throw new Error("banco caiu");
        Object.assign(estado.lotes.find((l) => l.id === where.id)!, data);
      },
      delete: async ({ where }: { where: Linha }) => {
        estado.lotes = estado.lotes.filter((l) => l.id !== where.id);
        estado.resumos.filter((r) => r.loteId === where.id).forEach((r) => (r.loteId = null)); // onDelete: SetNull
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
      findUnique: async ({ where }: { where: Linha }) =>
        (where.id !== undefined ? estado.resumos.find((r) => r.id === where.id) : porChave(where)) ?? null,
      create: async ({ data }: { data: Linha }) => {
        if (porChave({ conversaId_dia: { conversaId: data.conversaId, dia: data.dia } })) throw p2002();
        const r = { id: `res${++estado.seq}`, ...data };
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
import { coletarLotes, criarLoteDoDia, type ClienteLotes, type ResultadoLote } from "./lote-ia";

// 18/11 às 07:30 UTC (04:30 em São Paulo): "ontem" é 17/11 de 03:00Z até 18/11 03:00Z.
const AGORA = new Date("2026-11-18T07:30:00Z");
const DIA = new Date("2026-11-17T00:00:00.000Z");
const ONTEM = (h: number) => new Date(Date.UTC(2026, 10, 17, 3 + h));

function clienteFalso(opcoes: { falhar?: boolean } = {}) {
  const enviados: unknown[][] = [];
  const cliente: ClienteLotes & { falhar?: boolean } = {
    falhar: opcoes.falhar,
    async criar(requisicoes) {
      if (cliente.falhar) throw new Error("rede");
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
    usos: [],
    gastoMes: 0,
    seq: 0,
    falharUpdateLote: false,
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
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "falha_envio" });
    expect(banco.estado.lotes).toHaveLength(0);
    expect(banco.estado.resumos).toHaveLength(2);
    for (const r of banco.estado.resumos) expect(r).toMatchObject({ situacao: "falhou", erro: "Não foi possível enviar o lote." });
    // O log leva só o nome do erro.
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("segredo");
  });

  it("duas execuções simultâneas: só uma envia (a outra pega ja_existe pelo único)", async () => {
    grupo("g1");
    mensagem("g1");
    const { cliente, enviados } = clienteFalso();
    const criar = vi.spyOn(banco.prisma.loteIa, "create");
    const resultados = await Promise.all([criarLoteDoDia(AGORA, cliente), criarLoteDoDia(AGORA, cliente)]);
    expect(resultados.filter((r) => r.criado)).toHaveLength(1);
    expect(resultados.filter((r) => r.motivo === "ja_existe")).toHaveLength(1);
    // As duas passaram pelo caminho rápido; quem barrou a segunda foi o único (tipo, dia).
    expect(criar).toHaveBeenCalledTimes(2);
    criar.mockRestore();
    expect(enviados).toHaveLength(1);
    expect(banco.estado.lotes).toHaveLength(1);
    expect(banco.estado.lotes[0].idExterno).toBe("msgbatch_1");
    expect(banco.estado.resumos).toEqual([expect.objectContaining({ situacao: "pendente", loteId: banco.estado.lotes[0].id })]);
  });

  it("falha ao gravar idExterno depois do envio: não reenvia na próxima execução", async () => {
    grupo("g1");
    mensagem("g1");
    const { cliente, enviados } = clienteFalso();
    banco.estado.falharUpdateLote = true;
    await expect(criarLoteDoDia(AGORA, cliente)).rejects.toThrow();
    expect(enviados).toHaveLength(1);
    expect(banco.estado.lotes).toEqual([expect.objectContaining({ situacao: "aberto", idExterno: null })]);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");

    banco.estado.falharUpdateLote = false;
    expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ criado: false, motivo: "ja_existe" });
    expect(enviados).toHaveLength(1);
  });

  it("falha no envio apaga a reserva e permite nova tentativa", async () => {
    grupo("g1");
    mensagem("g1");
    const { cliente, enviados } = clienteFalso({ falhar: true });
    expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ criado: false, motivo: "falha_envio" });
    expect(banco.estado.lotes).toHaveLength(0);
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "Não foi possível enviar o lote.", loteId: null });

    cliente.falhar = false;
    expect(await criarLoteDoDia(AGORA, cliente)).toEqual({ criado: true, pedidos: 1, semVerba: 0 });
    expect(enviados).toHaveLength(1);
    expect(banco.estado.resumos).toHaveLength(1);
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pendente", erro: null, loteId: banco.estado.lotes[0].id });
  });

  it("nunca reabre um resumo já pronto, mesmo se ficar pronto no meio da execução", async () => {
    grupo("g1");
    grupo("g2");
    mensagem("g1");
    mensagem("g2");
    // g1 fica pronto entre a leitura inicial e a gravação (simula a coleta terminando em paralelo).
    const findUnique = banco.prisma.resumoGrupo.findUnique;
    let leituras = 0;
    banco.prisma.resumoGrupo.findUnique = async (args: { where: Linha }) => {
      const r = await findUnique(args);
      if (args.where.conversaId_dia.conversaId === "g1" && ++leituras === 1) {
        banco.estado.resumos.push({ id: "r0", conversaId: "g1", dia: DIA, situacao: "pronto", resumo: "ok" });
      }
      return r;
    };
    const { cliente, enviados } = clienteFalso();
    try {
      expect(await criarLoteDoDia(AGORA, cliente)).toMatchObject({ criado: true, pedidos: 1 });
    } finally {
      banco.prisma.resumoGrupo.findUnique = findUnique;
    }
    expect(pedidosDe(enviados).map((p) => p.custom_id)).not.toContain("resumo:r0");
    expect(banco.estado.resumos.find((r) => r.id === "r0")).toMatchObject({ situacao: "pronto", resumo: "ok" });
  });
});

describe("coletarLotes", () => {
  // Coleta às 10:00 UTC do dia 18; o lote foi criado às 07:30.
  const COLETA = new Date("2026-11-18T10:00:00Z");
  const USAGE = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  const JSON_OK = {
    resumo: "Dia tranquilo.",
    temas: ["prova", "horário"],
    pendencias: [{ autor: "Ana", hora: "10:15", texto: "Quando sai a nota?" }],
    destaques: ["Elogio à aula"],
  };

  function sucesso(customId: string, texto: string, extra: Linha = {}): ResultadoLote {
    return {
      custom_id: customId,
      result: {
        type: "succeeded",
        message: {
          id: "msg",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [{ type: "text", text: texto, citations: null }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: USAGE,
          ...extra,
        } as never,
      },
    };
  }

  function clienteColeta(status: string, itens: ResultadoLote[] = []) {
    const cliente: ClienteLotes = {
      async criar() {
        throw new Error("não deve criar");
      },
      async buscar() {
        return { processing_status: status };
      },
      async *resultados() {
        for (const i of itens) yield i;
      },
    };
    return cliente;
  }

  function lote(dados: Linha = {}) {
    const l = {
      id: "l1",
      idExterno: "msgbatch_1",
      tipo: "resumo_grupo",
      dia: DIA,
      situacao: "aberto",
      erro: null,
      criadoEm: AGORA,
      concluidoEm: null,
      ...dados,
    };
    banco.estado.lotes.push(l);
    return l;
  }
  function resumo(id: string, dados: Linha = {}) {
    const r = {
      id,
      conversaId: `g-${id}`,
      dia: DIA,
      loteId: "l1",
      situacao: "pendente",
      erro: null,
      resumo: null,
      modelo: "claude-opus-5-5",
      participacao: [],
      totalMensagens: 1,
      ...dados,
    };
    banco.estado.resumos.push(r);
    return r;
  }

  it("sem cliente (sem chave) não faz nada", async () => {
    lote();
    expect(await coletarLotes(COLETA, null)).toEqual({ lotes: 0, prontos: 0, falhos: 0 });
    expect(await coletarLotes(COLETA)).toEqual({ lotes: 0, prontos: 0, falhos: 0 });
  });

  it("lote ainda processando: nada muda", async () => {
    lote();
    resumo("r1");
    expect(await coletarLotes(COLETA, clienteColeta("in_progress"))).toEqual({ lotes: 0, prontos: 0, falhos: 0 });
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "aberto", concluidoEm: null });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pendente" });
    expect(banco.estado.usos).toHaveLength(0);
  });

  it("succeeded com JSON válido: resumo pronto com temas, pendências e destaques; registra uso de lote", async () => {
    lote();
    resumo("r1");
    const cliente = clienteColeta("ended", [sucesso("resumo:r1", JSON.stringify(JSON_OK))]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 1, falhos: 0 });
    expect(banco.estado.resumos[0]).toMatchObject({
      situacao: "pronto",
      erro: null,
      resumo: "Dia tranquilo.",
      temas: ["prova", "horário"],
      pendencias: [{ autor: "Ana", hora: "10:15", texto: "Quando sai a nota?" }],
      destaques: ["Elogio à aula"],
      modelo: "claude-opus-5-5",
    });
    const custoLote = calcularCustoMicroUsd(
      "claude-opus-5-5",
      { entrada: 1000, cacheEscrita: 0, cacheLeitura: 0, saida: 500 },
      { lote: true },
    );
    expect(banco.estado.usos).toEqual([
      expect.objectContaining({
        origem: "whatsapp",
        usuarioId: null,
        inicioPergunta: false,
        modelo: "claude-opus-5-5",
        tokensEntrada: 1000,
        tokensSaida: 500,
        custoMicroUsd: custoLote,
      }),
    ]);
  });

  it("JSON válido com listas longas e hora inválida: aparado e hora normalizada", async () => {
    lote();
    resumo("r1");
    const longo = {
      ...JSON_OK,
      temas: ["1", "2", "3", "4", "5", "6", "7"],
      pendencias: [{ autor: "Ana", hora: "25:99", texto: "x" }],
    };
    await coletarLotes(COLETA, clienteColeta("ended", [sucesso("resumo:r1", JSON.stringify(longo))]));
    expect(banco.estado.resumos[0].temas).toHaveLength(6);
    expect(banco.estado.resumos[0].pendencias).toEqual([{ autor: "Ana", hora: "", texto: "x" }]);
  });

  it("modelo da resposta desconhecido: o preço usa ResumoGrupo.modelo", async () => {
    lote();
    resumo("r1", { modelo: "claude-sonnet-5-5" });
    await coletarLotes(
      COLETA,
      clienteColeta("ended", [sucesso("resumo:r1", JSON.stringify(JSON_OK), { model: "claude-sonnet-5-5-20261101" })]),
    );
    expect(banco.estado.usos[0].modelo).toBe("claude-sonnet-5-5");
  });

  it("stop_reason refusal: falhou com 'A IA recusou este resumo.'", async () => {
    lote();
    resumo("r1");
    const cliente = clienteColeta("ended", [sucesso("resumo:r1", "", { stop_reason: "refusal" })]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 0, falhos: 1 });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "A IA recusou este resumo." });
    // O uso é registrado mesmo na recusa.
    expect(banco.estado.usos).toHaveLength(1);
  });

  it("JSON fora do formato: falhou com 'Resposta fora do formato.'", async () => {
    lote();
    resumo("r1");
    resumo("r2");
    resumo("r3");
    const cliente = clienteColeta("ended", [
      sucesso("resumo:r1", "isto não é JSON"),
      sucesso("resumo:r2", JSON.stringify({ resumo: "só isso" })),
      sucesso("resumo:r3", "", { content: [] }),
    ]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 0, falhos: 3 });
    for (const r of banco.estado.resumos) expect(r).toMatchObject({ situacao: "falhou", erro: "Resposta fora do formato." });
    expect(banco.estado.usos).toHaveLength(3);
  });

  it("errored e expired: falhou com 'Erro da IA.' e 'O pedido expirou.'", async () => {
    lote();
    resumo("r1");
    resumo("r2");
    resumo("r3");
    const cliente = clienteColeta("ended", [
      { custom_id: "resumo:r1", result: { type: "errored" } },
      { custom_id: "resumo:r2", result: { type: "expired" } },
      { custom_id: "resumo:r3", result: { type: "canceled" } },
    ]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 0, falhos: 3 });
    expect(banco.estado.resumos.map((r) => [r.situacao, r.erro])).toEqual([
      ["falhou", "Erro da IA."],
      ["falhou", "O pedido expirou."],
      ["falhou", "O pedido foi cancelado."],
    ]);
    expect(banco.estado.usos).toHaveLength(0);
  });

  it("custom_id de resumo já pronto não é regravado (coleta repetida)", async () => {
    lote();
    resumo("r1", { situacao: "pronto", resumo: "antigo" });
    const cliente = clienteColeta("ended", [sucesso("resumo:r1", JSON.stringify(JSON_OK))]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 0, falhos: 0 });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pronto", resumo: "antigo" });
    expect(banco.estado.usos).toHaveLength(0);
  });

  it("custom_id desconhecido ou malformado: ignorado, sem conteúdo no log", async () => {
    lote();
    resumo("r1");
    const cliente = clienteColeta("ended", [
      sucesso("outro:r1", JSON.stringify({ ...JSON_OK, resumo: "segredo" })),
      sucesso("resumo:nao-existe", JSON.stringify(JSON_OK)),
      sucesso("resumo:r1", JSON.stringify(JSON_OK)),
    ]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 1, falhos: 0 });
    expect(banco.estado.usos).toHaveLength(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("segredo");
  });

  it("erro inesperado ao gravar um item: loga o nome do erro, item falhou e segue para o próximo", async () => {
    lote();
    resumo("r1");
    resumo("r2");
    const updateMany = banco.prisma.resumoGrupo.updateMany;
    let chamadas = 0;
    banco.prisma.resumoGrupo.updateMany = async (args: { where: Linha; data: Linha }) => {
      if (++chamadas === 1) throw new Error("banco caiu");
      return updateMany(args);
    };
    try {
      const cliente = clienteColeta("ended", [
        sucesso("resumo:r1", JSON.stringify(JSON_OK)),
        sucesso("resumo:r2", JSON.stringify(JSON_OK)),
      ]);
      expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 1, falhos: 1 });
    } finally {
      banco.prisma.resumoGrupo.updateMany = updateMany;
    }
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "Não foi possível salvar o resumo." });
    expect(banco.estado.resumos[1]).toMatchObject({ situacao: "pronto" });
    // Só o item gravado como pronto foi cobrado (o que falhou na gravação não passou pela reserva).
    expect(banco.estado.usos).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");
  });

  it("falha ao registrar o uso: o resumo fica pronto, loga só o nome do erro e segue", async () => {
    lote();
    resumo("r1");
    resumo("r2");
    const create = banco.prisma.usoIa.create;
    let chamadas = 0;
    banco.prisma.usoIa.create = async (args: { data: Linha }) => {
      if (++chamadas === 1) throw new Error("banco caiu");
      return create(args);
    };
    try {
      const cliente = clienteColeta("ended", [
        sucesso("resumo:r1", JSON.stringify(JSON_OK)),
        sucesso("resumo:r2", JSON.stringify(JSON_OK)),
      ]);
      expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 2, falhos: 0 });
    } finally {
      banco.prisma.usoIa.create = create;
    }
    expect(banco.estado.resumos.map((r) => r.situacao)).toEqual(["pronto", "pronto"]);
    expect(banco.estado.usos).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "Error");
  });

  it("duas coletas simultâneas do mesmo item registram o uso uma vez só", async () => {
    lote();
    resumo("r1");
    const itens = [sucesso("resumo:r1", JSON.stringify(JSON_OK))];
    const findUnique = banco.prisma.resumoGrupo.findUnique;
    let leiturasPendentes = 0;
    banco.prisma.resumoGrupo.findUnique = async (args: { where: Linha }) => {
      const r = await findUnique(args);
      if (r?.situacao === "pendente") leiturasPendentes++;
      return r ? { ...r } : r;
    };
    const [a, b] = await Promise.all([
      coletarLotes(COLETA, clienteColeta("ended", itens)),
      coletarLotes(COLETA, clienteColeta("ended", itens)),
    ]);
    banco.prisma.resumoGrupo.findUnique = findUnique;
    // As duas leram o resumo ainda pendente; a gravação condicional decidiu quem cobra.
    expect(leiturasPendentes).toBe(2);
    expect(a.prontos + b.prontos).toBe(1);
    expect(banco.estado.usos).toHaveLength(1);
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pronto" });
  });

  it("bloco de thinking antes do texto: usa o primeiro bloco de texto e fica pronto", async () => {
    lote();
    resumo("r1");
    const cliente = clienteColeta("ended", [
      sucesso("resumo:r1", "", {
        content: [
          { type: "thinking", thinking: "pensando", signature: "sig" },
          { type: "text", text: JSON.stringify(JSON_OK), citations: null },
        ],
      }),
    ]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 1, falhos: 0 });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pronto", resumo: "Dia tranquilo." });
  });

  it("stop_reason max_tokens com JSON cortado: falhou 'Resposta fora do formato.' e uso registrado uma vez", async () => {
    lote();
    resumo("r1");
    const cortado = JSON.stringify(JSON_OK).slice(0, 30);
    const cliente = clienteColeta("ended", [sucesso("resumo:r1", cortado, { stop_reason: "max_tokens" })]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 0, falhos: 1 });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "Resposta fora do formato." });
    expect(banco.estado.usos).toHaveLength(1);
    // Coleta repetida não cobra de novo.
    banco.estado.lotes[0].situacao = "aberto";
    await coletarLotes(COLETA, cliente);
    expect(banco.estado.usos).toHaveLength(1);
  });

  it("no fim, LoteIa concluido com concluidoEm", async () => {
    lote();
    resumo("r1");
    resumo("r2"); // sem resultado no lote: não fica pendente para sempre
    await coletarLotes(COLETA, clienteColeta("ended", [sucesso("resumo:r1", JSON.stringify(JSON_OK))]));
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "concluido", concluidoEm: COLETA });
    expect(banco.estado.resumos[1]).toMatchObject({ situacao: "falhou", erro: "A IA não devolveu este resumo." });
    // Coleta seguinte: o lote já não está aberto.
    expect(await coletarLotes(COLETA, clienteColeta("ended"))).toEqual({ lotes: 0, prontos: 0, falhos: 0 });
  });

  it("lote aberto há mais de 25 h vira falhou e seus resumos pendentes também", async () => {
    lote({ criadoEm: new Date(COLETA.getTime() - 26 * 3_600_000) });
    resumo("r1");
    resumo("r2", { situacao: "pronto", resumo: "ok" });
    expect(await coletarLotes(COLETA, clienteColeta("in_progress"))).toEqual({ lotes: 1, prontos: 0, falhos: 1 });
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "falhou", erro: "O pedido expirou.", concluidoEm: COLETA });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "O pedido expirou." });
    expect(banco.estado.resumos[1]).toMatchObject({ situacao: "pronto", resumo: "ok" });
  });

  it("reserva sem idExterno há menos de 1 h: ainda enviando, nada muda", async () => {
    lote({ idExterno: null, criadoEm: new Date(COLETA.getTime() - 30 * 60_000) });
    resumo("r1");
    const cliente = clienteColeta("ended");
    const buscar = vi.spyOn(cliente, "buscar");
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 0, prontos: 0, falhos: 0 });
    expect(buscar).not.toHaveBeenCalled();
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "aberto" });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "pendente" });
  });

  it("reserva sem idExterno há mais de 1 h: lote e pendentes falham com 'O lote não foi enviado.', sem apagar a reserva", async () => {
    lote({ idExterno: null, criadoEm: new Date(COLETA.getTime() - 2 * 3_600_000) });
    resumo("r1");
    expect(await coletarLotes(COLETA, clienteColeta("ended"))).toEqual({ lotes: 1, prontos: 0, falhos: 1 });
    expect(banco.estado.lotes).toEqual([expect.objectContaining({ situacao: "falhou", erro: "O lote não foi enviado." })]);
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: "O lote não foi enviado." });
    // A reserva continua: o lote do dia não é reenviado.
    const { cliente: novo, enviados } = clienteFalso();
    grupo("g1");
    mensagem("g1");
    expect(await criarLoteDoDia(AGORA, novo)).toMatchObject({ motivo: "ja_existe" });
    expect(enviados).toHaveLength(0);
  });

  it("falha ao ler os resultados: lote continua aberto e a próxima coleta termina", async () => {
    lote();
    resumo("r1");
    resumo("r2");
    const quebrado: ClienteLotes = {
      ...clienteColeta("ended"),
      async *resultados() {
        yield sucesso("resumo:r1", JSON.stringify(JSON_OK));
        throw new Error("rede");
      },
    };
    expect(await coletarLotes(COLETA, quebrado)).toEqual({ lotes: 0, prontos: 1, falhos: 0 });
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "aberto" });
    const cliente = clienteColeta("ended", [
      sucesso("resumo:r1", JSON.stringify(JSON_OK)),
      sucesso("resumo:r2", JSON.stringify(JSON_OK)),
    ]);
    expect(await coletarLotes(COLETA, cliente)).toEqual({ lotes: 1, prontos: 1, falhos: 0 });
    expect(banco.estado.usos).toHaveLength(2);
  });
  it("lote encerrado cujo resultado não se lê há mais de 7 dias: lote e pendentes falham", async () => {
    lote({ criadoEm: new Date(COLETA.getTime() - 8 * 24 * 3_600_000) });
    resumo("r1");
    resumo("r2", { situacao: "pronto", resumo: "ok" });
    const quebrado: ClienteLotes = {
      ...clienteColeta("ended"),
      async *resultados() {
        throw new Error("rede");
      },
    };
    expect(await coletarLotes(COLETA, quebrado)).toEqual({ lotes: 1, prontos: 0, falhos: 1 });
    const texto = "Não foi possível ler o resultado do lote.";
    expect(banco.estado.lotes[0]).toMatchObject({ situacao: "falhou", erro: texto, concluidoEm: COLETA });
    expect(banco.estado.resumos[0]).toMatchObject({ situacao: "falhou", erro: texto });
    expect(banco.estado.resumos[1]).toMatchObject({ situacao: "pronto", resumo: "ok" });
  });
});
