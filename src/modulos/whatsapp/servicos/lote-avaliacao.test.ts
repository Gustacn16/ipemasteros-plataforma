import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o lote de avaliações usa.
const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    contatos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    avaliacoes: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    resumos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    vendas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    lotes: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    config: null as Record<string, any> | null, // eslint-disable-line @typescript-eslint/no-explicit-any
    gastoMes: 0,
    seq: 0,
  };
  const p2002 = () => Object.assign(new Error("único"), { code: "P2002" });
  const semLike = (where: unknown) => {
    const json = JSON.stringify(where ?? {});
    for (const op of ["contains", "startsWith", "endsWith"]) if (json.includes(`"${op}"`)) throw new Error(`operador ${op} proibido`);
  };
  const mesmoDia = (a: Date, b: Date) => a.getTime() === b.getTime();
  const noIntervalo = (d: Date, f: Linha) => (!f.gte || d >= f.gte) && (!f.lt || d < f.lt) && (!f.lte || d <= f.lte);
  const naLista = (v: unknown, f: unknown) =>
    f === undefined ? true : typeof f === "object" && f !== null && "in" in f ? (f as { in: unknown[] }).in.includes(v) : v === f;
  const avaliacaoCombina = (r: Linha, where: Linha) => {
    if (where.id?.in && !where.id.in.includes(r.id)) return false;
    if (typeof where.id === "string" && r.id !== where.id) return false;
    if (where.situacao?.not && r.situacao === where.situacao.not) return false;
    if (typeof where.situacao === "string" && r.situacao !== where.situacao) return false;
    if (where.loteId !== undefined && (r.loteId ?? null) !== where.loteId) return false;
    if (where.OR && !where.OR.some((w: Linha) => avaliacaoCombina(r, w))) return false;
    if (where.conversaId !== undefined && !naLista(r.conversaId, where.conversaId)) return false;
    if (where.dia !== undefined && !mesmoDia(r.dia, where.dia)) return false;
    return true;
  };
  const porChave = (w: Linha) =>
    estado.avaliacoes.find((r) => r.conversaId === w.conversaId_dia.conversaId && mesmoDia(r.dia, w.conversaId_dia.dia));
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
        await Promise.resolve();
        if (estado.lotes.some((l) => l.tipo === data.tipo && mesmoDia(l.dia, data.dia))) throw p2002();
        const l = { id: `lote${++estado.seq}`, situacao: "aberto", idExterno: null, criadoEm: new Date(), ...data };
        estado.lotes.push(l);
        return { id: l.id };
      },
      update: async ({ where, data }: { where: Linha; data: Linha }) => {
        Object.assign(estado.lotes.find((l) => l.id === where.id)!, data);
      },
      delete: async ({ where }: { where: Linha }) => {
        estado.lotes = estado.lotes.filter((l) => l.id !== where.id);
        estado.avaliacoes.filter((r) => r.loteId === where.id).forEach((r) => (r.loteId = null)); // onDelete: SetNull
      },
    },
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.conversas
          .filter((c) => {
            const numero = estado.numeros.find((x) => x.id === c.numeroId);
            if (c.tipo !== where.tipo || !naLista(c.categoria, where.categoria)) return false;
            if (!numero) return false;
            if (where.numero?.excluidoEm === null && numero.excluidoEm) return false;
            if (!naLista(numero.time, where.numero?.time)) return false;
            const faixa = where.mensagens?.some?.enviadaEm;
            if (faixa && !estado.mensagens.some((m) => m.conversaId === c.id && noIntervalo(m.enviadaEm, faixa))) return false;
            return true;
          })
          .map((c) => {
            const numero = estado.numeros.find((x) => x.id === c.numeroId)!;
            const contato = estado.contatos.find((x) => x.id === c.contatoId);
            return { id: c.id, numeroId: c.numeroId, numero: { time: numero.time }, contato: contato ? { telefone: contato.telefone } : null };
          });
      },
    },
    mensagemWhatsapp: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        if (!where.conversaId?.in) throw new Error("busca por conversa, não em lote");
        return estado.mensagens
          .filter((m) => where.conversaId.in.includes(m.conversaId) && noIntervalo(m.enviadaEm, where.enviadaEm))
          .sort((a, b) => a.enviadaEm - b.enviadaEm)
          .map((m) => ({ conversaId: m.conversaId, enviadaEm: m.enviadaEm, deMim: m.deMim, tipo: m.tipo, texto: m.texto }));
      },
    },
    venda: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.vendas
          .filter((v) => (where.excluidoEm === null ? !v.excluidoEm : true))
          .filter((v) => noIntervalo(v.criadoEm, where.criadoEm))
          .filter((v) => (where.whatsappCliente?.not === null ? v.whatsappCliente != null : true))
          .filter((v) => naLista(v.whatsappCliente, where.whatsappCliente?.in ? where.whatsappCliente : undefined))
          .sort((a, b) => b.criadoEm - a.criadoEm)
          .map((v) => ({ id: v.id, whatsappCliente: v.whatsappCliente, criadoEm: v.criadoEm }));
      },
    },
    resumoGrupo: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.resumos.filter((r) => r.situacao === where.situacao).map((r) => ({ totalMensagens: r.totalMensagens, modelo: r.modelo })),
    },
    avaliacaoConversa: {
      findMany: async ({ where }: { where: Linha }) => {
        semLike(where);
        return estado.avaliacoes.filter((r) => avaliacaoCombina(r, where)).map((r) => ({ conversaId: r.conversaId }));
      },
      count: async ({ where }: { where: Linha }) => estado.avaliacoes.filter((r) => avaliacaoCombina(r, where)).length,
      findUnique: async ({ where }: { where: Linha }) =>
        (where.id !== undefined ? estado.avaliacoes.find((r) => r.id === where.id) : porChave(where)) ?? null,
      create: async ({ data }: { data: Linha }) => {
        if (porChave({ conversaId_dia: { conversaId: data.conversaId, dia: data.dia } })) throw p2002();
        const r = { id: `av${++estado.seq}`, ...data };
        estado.avaliacoes.push(r);
        return { id: r.id };
      },
      updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
        const alvo = estado.avaliacoes.filter((r) => avaliacaoCombina(r, where));
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

import { INSTRUCOES_AVALIACAO } from "../ia/avaliacao-conversa";
import { LoteRecusadoError, type ClienteLotes, type ResultadoLote } from "./lote-ia";
import { criarLoteAvaliacoes, PREFIXO_AVALIACAO, reservaPendentesMicroUsd } from "./lote-avaliacao";

// 18/11 às 07:30 UTC (04:30 em São Paulo): "ontem" é 17/11 (terça) de 03:00Z até 18/11 03:00Z.
const AGORA = new Date("2026-11-18T07:30:00Z");
const DIA = new Date("2026-11-17T00:00:00.000Z");
const ONTEM = (h: number, min = 0) => new Date(Date.UTC(2026, 10, 17, 3 + h, min));
const DIAS_ATRAS = (d: number) => new Date(Date.UTC(2026, 10, 18, 3) - d * 86_400_000);
const LIMITE = "Limite mensal de IA do WhatsApp atingido.";

type Falha = false | "recusa" | "incerto";
function clienteFalso(opcoes: { falhar?: Falha } = {}) {
  const enviados: unknown[][] = [];
  const cliente: ClienteLotes & { falhar?: Falha } = {
    falhar: opcoes.falhar,
    async criar(requisicoes) {
      if (cliente.falhar === "recusa") throw new LoteRecusadoError(400);
      if (cliente.falhar === "incerto") throw new Error("rede");
      enviados.push(requisicoes);
      return { id: "msgbatch_av" };
    },
    async buscar() {
      return { processing_status: "in_progress" };
    },
    async *resultados(): AsyncIterable<ResultadoLote> {},
  };
  return { cliente, enviados };
}

function numero(id: string, time: string, dados: Linha = {}) {
  banco.estado.numeros.push({ id, time, excluidoEm: null, ...dados });
}
let n = 0;
/** Conversa individual com um contato próprio e, por padrão, uma mensagem do cliente ontem. */
function conversa(id: string, numeroId: string, dados: Linha = {}, telefone = `55119${String(++n).padStart(8, "0")}`) {
  banco.estado.contatos.push({ id: `ct_${id}`, telefone });
  banco.estado.conversas.push({ id, tipo: "individual", categoria: "lead", numeroId, contatoId: `ct_${id}`, ...dados });
}
function mensagem(conversaId: string, dados: Linha = {}) {
  banco.estado.mensagens.push({ id: `m${++n}`, conversaId, deMim: false, tipo: "texto", texto: "oi", enviadaEm: ONTEM(10), ...dados });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pedidosDe = (enviados: unknown[][]) => enviados[0] as any[];
const avaliacaoDe = (conversaId: string) => banco.estado.avaliacoes.find((a) => a.conversaId === conversaId);

beforeEach(() => {
  Object.assign(banco.estado, {
    numeros: [],
    contatos: [],
    conversas: [],
    mensagens: [],
    avaliacoes: [],
    resumos: [],
    vendas: [],
    lotes: [],
    config: null,
    gastoMes: 0,
    seq: 0,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("criarLoteAvaliacoes", () => {
  it("sem cliente (sem ANTHROPIC_API_KEY): sem_chave", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1");
    expect(await criarLoteAvaliacoes(AGORA, null)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "sem_chave" });
    expect(await criarLoteAvaliacoes(AGORA)).toMatchObject({ motivo: "sem_chave" });
  });

  it("só entram lead e aluno de números cs, paciente_modelo e comercial, com mensagem ontem", async () => {
    numero("n_cs", "cs");
    numero("n_pm", "paciente_modelo");
    numero("n_com", "comercial");
    numero("n_outro", "outro");
    numero("n_exc", "cs", { excluidoEm: new Date("2026-11-01T00:00:00Z") });
    conversa("c_cs", "n_cs");
    conversa("c_pm", "n_pm", { categoria: "aluno" });
    conversa("c_com", "n_com");
    conversa("c_outro", "n_outro");
    conversa("c_equipe", "n_cs", { categoria: "equipe" });
    conversa("c_exc", "n_exc");
    conversa("c_grupo", "n_cs", { tipo: "grupo" });
    conversa("c_velha", "n_com");
    for (const c of ["c_cs", "c_pm", "c_com", "c_outro", "c_equipe", "c_exc", "c_grupo"]) mensagem(c);
    mensagem("c_velha", { enviadaEm: DIAS_ATRAS(3) });
    mensagem("c_velha", { enviadaEm: ONTEM(24) }); // hoje em São Paulo

    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: true, pedidos: 3, semVerba: 0 });
    expect(banco.estado.avaliacoes.map((a) => a.conversaId).sort()).toEqual(["c_com", "c_cs", "c_pm"]);
    expect(banco.estado.lotes).toEqual([
      expect.objectContaining({ tipo: "avaliacao", dia: DIA, idExterno: "msgbatch_av", situacao: "aberto" }),
    ]);
    for (const p of pedidosDe(enviados)) expect(p.custom_id).toMatch(/^aval_[a-zA-Z0-9_-]+$/);
    expect(PREFIXO_AVALIACAO).toBe("aval_");
  });

  it("número cs usa o esquema de CS; comercial e paciente_modelo, o de vendas; a avaliação pendente leva time, número, modelo e nota de tempo", async () => {
    numero("n_cs", "cs");
    numero("n_com", "comercial");
    conversa("c_cs", "n_cs");
    conversa("c_com", "n_com");
    mensagem("c_cs", { enviadaEm: ONTEM(10) });
    mensagem("c_cs", { deMim: true, texto: "olá, como posso ajudar?", enviadaEm: ONTEM(10, 5) });
    mensagem("c_cs", { deMim: true, enviadaEm: DIAS_ATRAS(5), texto: "conversa antiga" }); // contexto dos 14 dias
    mensagem("c_cs", { enviadaEm: DIAS_ATRAS(20), texto: "fora da janela" });
    mensagem("c_com", { enviadaEm: ONTEM(11) });

    const { cliente, enviados } = clienteFalso();
    await criarLoteAvaliacoes(AGORA, cliente);
    const cs = avaliacaoDe("c_cs")!;
    const com = avaliacaoDe("c_com")!;
    const pedidos = pedidosDe(enviados);
    const pedidoCs = pedidos.find((p) => p.custom_id === `aval_${cs.id}`);
    const pedidoCom = pedidos.find((p) => p.custom_id === `aval_${com.id}`);
    expect(pedidoCs.params.system).toBe(INSTRUCOES_AVALIACAO.cs);
    expect(pedidoCom.params.system).toBe(INSTRUCOES_AVALIACAO.vendas);
    expect(pedidoCs.params.model).toBe("claude-sonnet-5-5");

    const entrada: string = pedidoCs.params.messages[0].content;
    expect(entrada).toContain("Primeira resposta: 5 min");
    expect(entrada).toContain("Tempo de resposta: 5 min");
    expect(entrada).toContain("Respostas dentro do prazo: 1 de 1");
    expect(entrada).toContain("conversa antiga");
    expect(entrada).not.toContain("fora da janela");

    expect(cs).toMatchObject({
      numeroId: "n_cs",
      dia: DIA,
      time: "cs",
      situacao: "pendente",
      erro: null,
      modelo: "claude-sonnet-5-5",
      notaTempo: 10,
      vendaId: null,
      loteId: banco.estado.lotes[0].id,
    });
    // O cliente de c_com ficou sem resposta ontem: fora do prazo.
    expect(com).toMatchObject({ time: "comercial", notaTempo: 0 });
  });

  it("conversa com avaliação pronta ontem não é reenviada", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    conversa("c2", "n1");
    mensagem("c1");
    mensagem("c2");
    banco.estado.avaliacoes.push({ id: "a0", conversaId: "c1", dia: DIA, situacao: "pronto", oQueRespondeu: "ok" });
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: true, pedidos: 1 });
    expect(pedidosDe(enviados).map((p) => p.custom_id)).toEqual([`aval_${avaliacaoDe("c2")!.id}`]);
    expect(avaliacaoDe("c1")).toEqual({ id: "a0", conversaId: "c1", dia: DIA, situacao: "pronto", oQueRespondeu: "ok" });
  });

  it("limite US$ 1, gasto US$ 0,90 e resumo pendente de ~US$ 0,08: nenhuma cabe, todas falham com o aviso do limite", async () => {
    banco.estado.config = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 1_000_000 };
    banco.estado.gastoMes = 900_000;
    banco.estado.resumos.push({ id: "r1", situacao: "pendente", totalMensagens: 640, modelo: "claude-opus-5-5" });
    const reserva = await reservaPendentesMicroUsd();
    expect(reserva).toBeGreaterThan(78_000);
    expect(reserva).toBeLessThan(82_000);

    numero("n1", "cs");
    numero("n2", "comercial");
    conversa("c1", "n1");
    conversa("c2", "n2");
    // Conversas longas: cada pedido custa mais que os US$ 0,02 que sobram, mas caberia sem a reserva.
    mensagem("c1", { texto: "x".repeat(20_000) });
    mensagem("c2", { texto: "y".repeat(20_000) });

    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 2, motivo: "nada_a_fazer" });
    expect(enviados).toHaveLength(0);
    expect(banco.estado.lotes).toHaveLength(0);
    for (const c of ["c1", "c2"]) expect(avaliacaoDe(c)).toMatchObject({ situacao: "falhou", erro: LIMITE, loteId: null });

    // Sem o resumo pendente, as duas caberiam.
    banco.estado.resumos = [];
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: true, pedidos: 2, semVerba: 0 });
  });

  it("a reserva conta as avaliações pendentes (Sonnet, 3000 de saída)", async () => {
    expect(await reservaPendentesMicroUsd()).toBe(0);
    banco.estado.avaliacoes.push(
      { id: "a1", conversaId: "x", dia: DIA, situacao: "pendente" },
      { id: "a2", conversaId: "y", dia: DIA, situacao: "pronto" },
    );
    const uma = await reservaPendentesMicroUsd();
    expect(uma).toBeGreaterThan(15_000); // 3000 tokens de saída do Sonnet a preço de lote = US$ 0,015
    banco.estado.avaliacoes.push({ id: "a3", conversaId: "z", dia: DIA, situacao: "pendente" });
    expect(await reservaPendentesMicroUsd()).toBe(2 * uma);
  });

  it("vendas entram antes de CS quando a verba só cabe uma", async () => {
    banco.estado.config = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 1_000_000 };
    banco.estado.gastoMes = 970_000; // sobram US$ 0,03: cabe um pedido curto (~US$ 0,016), não dois
    numero("n_cs", "cs");
    numero("n_pm", "paciente_modelo");
    conversa("c_cs", "n_cs");
    conversa("c_pm", "n_pm");
    // CS tem mais mensagens ontem, mas vendas vem primeiro.
    for (let h = 9; h < 13; h++) mensagem("c_cs", { enviadaEm: ONTEM(h) });
    mensagem("c_pm");
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: true, pedidos: 1, semVerba: 1 });
    expect(pedidosDe(enviados).map((p) => p.custom_id)).toEqual([`aval_${avaliacaoDe("c_pm")!.id}`]);
    expect(avaliacaoDe("c_cs")).toMatchObject({ situacao: "falhou", erro: LIMITE });
  });

  it("dentro do mesmo tipo, quem tem mais mensagens ontem entra primeiro", async () => {
    banco.estado.config = { id: "unica", modelo: "claude-opus-5-5", limiteMensalMicroUsd: 1_000_000 };
    banco.estado.gastoMes = 970_000;
    numero("n1", "comercial");
    conversa("c1", "n1");
    conversa("c2", "n1");
    mensagem("c1");
    mensagem("c2", { enviadaEm: ONTEM(9) });
    mensagem("c2", { enviadaEm: ONTEM(11) });
    mensagem("c1", { enviadaEm: DIAS_ATRAS(3) });
    mensagem("c1", { enviadaEm: DIAS_ATRAS(4) });
    const { cliente, enviados } = clienteFalso();
    await criarLoteAvaliacoes(AGORA, cliente);
    expect(pedidosDe(enviados).map((p) => p.custom_id)).toEqual([`aval_${avaliacaoDe("c2")!.id}`]);
  });

  it("venda casada: +55 (11) 99999-8888 casa com o contato 551199998888 (sem o 9); excluída ou de 120 dias não casa", async () => {
    numero("n_com", "comercial");
    numero("n_cs", "cs");
    conversa("c_com", "n_com", {}, "551199998888");
    conversa("c_cs", "n_cs", {}, "5511977776666");
    conversa("c_sem", "n_com", {}, "5511955554444");
    for (const c of ["c_com", "c_cs", "c_sem"]) mensagem(c);
    banco.estado.vendas.push(
      { id: "v_antiga_ok", whatsappCliente: "11999998888", criadoEm: DIAS_ATRAS(30), excluidoEm: null },
      { id: "v_ok", whatsappCliente: "+55 (11) 99999-8888", criadoEm: DIAS_ATRAS(10), excluidoEm: null },
      { id: "v_excluida", whatsappCliente: "11999998888", criadoEm: DIAS_ATRAS(2), excluidoEm: new Date() },
      { id: "v_cs", whatsappCliente: "11977776666", criadoEm: DIAS_ATRAS(2), excluidoEm: null },
      { id: "v_velha", whatsappCliente: "11955554444", criadoEm: DIAS_ATRAS(120), excluidoEm: null },
    );
    const venda = vi.spyOn(banco.prisma.venda, "findMany");
    const { cliente } = clienteFalso();
    await criarLoteAvaliacoes(AGORA, cliente);
    expect(venda).toHaveBeenCalledTimes(1); // uma consulta para todas as candidatas
    venda.mockRestore();
    expect(avaliacaoDe("c_com")).toMatchObject({ vendaId: "v_ok" });
    expect(avaliacaoDe("c_cs")).toMatchObject({ vendaId: null }); // CS não casa venda
    expect(avaliacaoDe("c_sem")).toMatchObject({ vendaId: null });
  });

  it("segunda execução no mesmo dia devolve ja_existe", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1");
    const { cliente, enviados } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: true });
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "ja_existe" });
    expect(enviados).toHaveLength(1);
  });

  it("duas execuções simultâneas: o único (tipo, dia) barra a segunda", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1");
    const { cliente, enviados } = clienteFalso();
    const r = await Promise.all([criarLoteAvaliacoes(AGORA, cliente), criarLoteAvaliacoes(AGORA, cliente)]);
    expect(r.filter((x) => x.criado)).toHaveLength(1);
    expect(r.filter((x) => x.motivo === "ja_existe")).toHaveLength(1);
    expect(enviados).toHaveLength(1);
  });

  it("não usa a reserva do lote de resumos do dia", async () => {
    banco.estado.lotes.push({ id: "lr", tipo: "resumo_grupo", dia: DIA, situacao: "aberto", idExterno: "x" });
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1");
    const { cliente } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: true, pedidos: 1 });
  });

  it("recusa 4xx apaga a reserva e marca falhou; uma nova tentativa no dia pode enviar", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1", { texto: "segredo do lead" });
    const { cliente, enviados } = clienteFalso({ falhar: "recusa" });
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "falha_envio" });
    expect(banco.estado.lotes).toHaveLength(0);
    expect(avaliacaoDe("c1")).toMatchObject({ situacao: "falhou", erro: "Não foi possível enviar o lote.", loteId: null });
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "LoteRecusadoError");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("segredo");

    cliente.falhar = false;
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: true, pedidos: 1, semVerba: 0 });
    expect(enviados).toHaveLength(1);
    expect(avaliacaoDe("c1")).toMatchObject({ situacao: "pendente", erro: null, loteId: banco.estado.lotes[0].id });
  });

  it("tempo esgotado: a reserva fica sem idExterno, as avaliações ficam pendentes e nada é reenviado", async () => {
    numero("n1", "cs");
    conversa("c1", "n1");
    mensagem("c1");
    const { cliente, enviados } = clienteFalso({ falhar: "incerto" });
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toEqual({ criado: false, pedidos: 0, semVerba: 0, motivo: "envio_incerto" });
    expect(banco.estado.lotes).toEqual([expect.objectContaining({ tipo: "avaliacao", situacao: "aberto", idExterno: null })]);
    expect(avaliacaoDe("c1")).toMatchObject({ situacao: "pendente", loteId: banco.estado.lotes[0].id });

    cliente.falhar = false;
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: false, motivo: "ja_existe" });
    expect(enviados).toHaveLength(0);
  });

  it("sem verba não mexe numa avaliação pendente de outro lote", async () => {
    banco.estado.gastoMes = 80_000_000;
    numero("n1", "cs");
    conversa("c1", "n1");
    conversa("c2", "n1");
    mensagem("c1");
    mensagem("c2");
    banco.estado.avaliacoes.push(
      { id: "a0", conversaId: "c1", dia: DIA, situacao: "pendente", erro: null, loteId: "outro" },
      { id: "a1", conversaId: "c2", dia: DIA, situacao: "falhou", erro: "Erro da IA.", loteId: "velho" },
    );
    const { cliente } = clienteFalso();
    expect(await criarLoteAvaliacoes(AGORA, cliente)).toMatchObject({ criado: false, semVerba: 2, motivo: "nada_a_fazer" });
    expect(avaliacaoDe("c1")).toMatchObject({ situacao: "pendente", erro: null, loteId: "outro" });
    expect(avaliacaoDe("c2")).toMatchObject({ situacao: "falhou", erro: LIMITE, loteId: null });
  });
});
