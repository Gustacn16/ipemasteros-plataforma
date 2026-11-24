import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o envio dos avisos usa.
const banco = vi.hoisted(() => {
  const estado = {
    avisos: [] as Linha[],
    envios: [] as Linha[],
    comandos: [] as Linha[],
    numeros: [] as Linha[],
    noGrupo: [] as Linha[],
    conversas: [] as Linha[],
    eventos: [] as Linha[],
  };
  // Filtro mínimo do Prisma: igualdade, null, in, not, lt/lte/gte, OR.
  const bate = (linha: Linha, where: Linha = {}): boolean =>
    Object.entries(where).every(([k, cond]) => {
      if (k === "OR") return (cond as Linha[]).some((w) => bate(linha, w));
      const v = linha[k] ?? null;
      if (cond === null) return v === null;
      if (typeof cond === "object" && !(cond instanceof Date)) {
        if ("in" in cond && !cond.in.includes(v)) return false;
        if ("not" in cond && (cond.not === null ? v === null : v === cond.not)) return false;
        if ("lt" in cond && !(v !== null && v < cond.lt)) return false;
        if ("lte" in cond && !(v !== null && v <= cond.lte)) return false;
        if ("gte" in cond && !(v !== null && v >= cond.gte)) return false;
        return true;
      }
      return v === cond;
    });
  const aplicar = (linha: Linha, data: Linha) => {
    const { tentativas, ...resto } = data;
    // Prisma.DbNull vira null.
    for (const [k, v] of Object.entries(resto)) linha[k] = v?.constructor?.name === "DbNull" ? null : v;
    if (tentativas) linha.tentativas += tentativas.increment;
  };
  const updateMany = (lista: () => Linha[]) => async ({ where, data }: { where: Linha; data: Linha }) => {
    const alvo = lista().filter((l) => bate(l, where));
    alvo.forEach((l) => aplicar(l, data));
    return { count: alvo.length };
  };
  let seq = 0;
  const prisma = {
    avisoGrupo: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.avisos
          .filter((a) => bate(a, where))
          .map((a) => ({ ...a, evento: estado.eventos.find((e) => e.id === a.eventoId) ?? null })),
      findUnique: async ({ where }: { where: { id: string } }) => estado.avisos.find((a) => a.id === where.id) ?? null,
      updateMany: updateMany(() => estado.avisos),
    },
    envioAvisoGrupo: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.envios
          .filter((e) => bate(e, where))
          .map((e) => ({ ...e, conversa: estado.conversas.find((c) => c.id === e.conversaId) })),
      findUnique: async ({ where }: { where: { comandoId: string } }) =>
        estado.envios.find((e) => e.comandoId === where.comandoId) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Linha }) => aplicar(estado.envios.find((e) => e.id === where.id)!, data),
      updateMany: updateMany(() => estado.envios),
      count: async ({ where }: { where: Linha }) => estado.envios.filter((e) => bate(e, where)).length,
    },
    numeroNoGrupo: {
      findMany: async ({ where }: { where: { conversaId: { in: string[] }; numero: Linha } }) =>
        estado.noGrupo
          .filter((v) => where.conversaId.in.includes(v.conversaId))
          .map((v) => ({ conversaId: v.conversaId, numero: estado.numeros.find((n) => n.id === v.numeroId)! }))
          .filter((v) => bate(v.numero, where.numero)),
    },
    comandoWhatsapp: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.comandos.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where, take }: { where: Linha; take: number }) =>
        estado.comandos
          .filter((c) => bate(c, where))
          .slice(0, take)
          .map((c) => ({ ...c, numero: { excluidoEm: null } })),
      count: async ({ where }: { where: Linha }) => estado.comandos.filter((c) => bate(c, where)).length,
      create: async ({ data }: { data: Linha }) => {
        const c = { id: `cmd${++seq}`, situacao: "pendente", tentativas: 0, iniciadoEm: null, criadoEm: new Date(), ...data };
        estado.comandos.push(c);
        return { id: c.id };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        estado.comandos = estado.comandos.filter((c) => c.id !== where.id);
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) => aplicar(estado.comandos.find((c) => c.id === where.id)!, data),
      updateMany: updateMany(() => estado.comandos),
    },
    numeroWhatsapp: { update: async () => ({}) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma, reiniciarSeq: () => (seq = 0) };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("./captura", () => ({ aplicarConversas: vi.fn(), aplicarMensagens: vi.fn() }));

const { conferirEventosMudados, dispararAvisosDaHora } = await import("./avisos-envio");
const { concluirComando, entregarComandos } = await import("./motor");

const AGORA = new Date("2026-11-25T13:00:00Z"); // quarta 10h em SP
const seg = (s: number) => new Date(AGORA.getTime() + s * 1000);

const numero = (id: string, extra: Linha = {}) => ({
  id, nome: id, time: "outro", situacao: "conectado", finalidade: "escola", excluidoEm: null, ...extra,
});
const aviso = (id: string, extra: Linha = {}) => ({
  id, texto: "Aviso", agendadoPara: seg(-60), situacao: "aprovado", origem: "avulso", eventoId: null, retratoEvento: null,
  alerta: null, aprovadoPorId: "u1", aprovadoEm: seg(-3600), ...extra,
});
const envio = (id: string, avisoId: string, conversaId: string, extra: Linha = {}) => ({
  id, avisoId, conversaId, numeroId: null, comandoId: null, situacao: "aguardando", erro: null, enviadoEm: null, ...extra,
});

beforeEach(() => {
  banco.reiniciarSeq();
  banco.estado.avisos = [];
  banco.estado.envios = [];
  banco.estado.comandos = [];
  banco.estado.numeros = [numero("n1")];
  banco.estado.conversas = ["g1", "g2", "g3"].map((id) => ({ id, jid: `${id}@g.us` }));
  banco.estado.noGrupo = [];
  banco.estado.eventos = [];
});

describe("dispararAvisosDaHora", () => {
  it("3 grupos, um sem número no grupo: 2 comandos espaçados e 1 sem_numero", async () => {
    banco.estado.avisos = [aviso("a1")];
    banco.estado.envios = [envio("e1", "a1", "g1"), envio("e2", "a1", "g2"), envio("e3", "a1", "g3")];
    banco.estado.noGrupo = [
      { numeroId: "n1", conversaId: "g1" },
      { numeroId: "n1", conversaId: "g3" },
      // número desconectado e número de atendimento no g2 não servem
      { numeroId: "n2", conversaId: "g2" },
      { numeroId: "n3", conversaId: "g2" },
    ];
    banco.estado.numeros.push(numero("n2", { situacao: "desconectado" }), numero("n3", { finalidade: "atendimento" }));

    expect(await dispararAvisosDaHora(AGORA, () => 0)).toEqual({ avisos: 1, comandos: 2, semNumero: 1, acimaDoLimite: 0, atrasados: 0 });
    expect(banco.estado.avisos[0]!.situacao).toBe("enviando");
    expect(banco.estado.comandos.map((c) => c.executarApos)).toEqual([AGORA, seg(8)]);
    expect(banco.estado.comandos[0]).toMatchObject({
      tipo: "enviar_grupo", numeroId: "n1", dados: { jid: "g1@g.us", texto: "Aviso", envioId: "e1" },
    });
    expect(banco.estado.envios.map((e) => [e.situacao, e.comandoId])).toEqual([
      ["aguardando", "cmd1"], ["sem_numero", null], ["aguardando", "cmd2"],
    ]);
  });

  it("número com 59 envios hoje: 1 comando e 2 falhou pelo limite", async () => {
    banco.estado.comandos = Array.from({ length: 59 }, (_, i) => ({
      id: `velho${i}`, numeroId: "n1", tipo: "enviar_grupo", situacao: "concluido", criadoEm: seg(-1800),
    }));
    // de ontem (SP) não conta
    banco.estado.comandos.push({ id: "ontem", numeroId: "n1", tipo: "enviar_grupo", situacao: "concluido", criadoEm: new Date("2026-11-25T02:59:00Z") });
    banco.estado.avisos = [aviso("a1")];
    banco.estado.envios = [envio("e1", "a1", "g1"), envio("e2", "a1", "g2"), envio("e3", "a1", "g3")];
    banco.estado.noGrupo = ["g1", "g2", "g3"].map((conversaId) => ({ numeroId: "n1", conversaId }));

    expect(await dispararAvisosDaHora(AGORA, () => 0)).toEqual({ avisos: 1, comandos: 1, semNumero: 0, acimaDoLimite: 2, atrasados: 0 });
    expect(banco.estado.envios.map((e) => [e.situacao, e.erro])).toEqual([
      ["aguardando", null],
      ["falhou", "Limite de envios do dia atingido."],
      ["falhou", "Limite de envios do dia atingido."],
    ]);
  });

  it("prefere o número do time cs", async () => {
    banco.estado.numeros.push(numero("n0", { nome: "A", time: "cs" }));
    banco.estado.avisos = [aviso("a1")];
    banco.estado.envios = [envio("e1", "a1", "g1")];
    banco.estado.noGrupo = [{ numeroId: "n1", conversaId: "g1" }, { numeroId: "n0", conversaId: "g1" }];
    await dispararAvisosDaHora(AGORA, () => 0);
    expect(banco.estado.comandos[0]!.numeroId).toBe("n0");
  });

  it("aviso sem nenhum comando criado vira falhou", async () => {
    banco.estado.avisos = [aviso("a1")];
    banco.estado.envios = [envio("e1", "a1", "g1")];
    expect(await dispararAvisosDaHora(AGORA)).toEqual({ avisos: 1, comandos: 0, semNumero: 1, acimaDoLimite: 0, atrasados: 0 });
    expect(banco.estado.avisos[0]!.situacao).toBe("falhou");
  });

  it("ignora aviso do futuro, rascunho e o que já está enviando", async () => {
    banco.estado.avisos = [aviso("a1", { agendadoPara: seg(60) }), aviso("a2", { situacao: "rascunho" }), aviso("a3", { situacao: "enviando" })];
    banco.estado.envios = [envio("e1", "a1", "g1"), envio("e2", "a2", "g1"), envio("e3", "a3", "g1")];
    banco.estado.noGrupo = [{ numeroId: "n1", conversaId: "g1" }];
    expect(await dispararAvisosDaHora(AGORA)).toEqual({ avisos: 0, comandos: 0, semNumero: 0, acimaDoLimite: 0, atrasados: 0 });
    expect(banco.estado.comandos).toEqual([]);
  });

  it("31 min atrasado não sai: falhou com alerta, envios falham e nenhum comando", async () => {
    banco.estado.avisos = [aviso("a1", { agendadoPara: seg(-31 * 60) })];
    banco.estado.envios = [envio("e1", "a1", "g1"), envio("e2", "a1", "g2", { situacao: "sem_numero" })];
    banco.estado.noGrupo = [{ numeroId: "n1", conversaId: "g1" }];
    expect(await dispararAvisosDaHora(AGORA)).toEqual({ avisos: 0, comandos: 0, semNumero: 0, acimaDoLimite: 0, atrasados: 1 });
    expect(banco.estado.avisos[0]).toMatchObject({
      situacao: "falhou",
      alerta: "Não saiu no horário (o sistema ficou parado). Reagende o aviso.",
    });
    expect(banco.estado.envios.map((e) => [e.situacao, e.erro])).toEqual([["falhou", "Passou do horário."], ["sem_numero", null]]);
    expect(banco.estado.comandos).toEqual([]);
  });

  it("29 min atrasado sai normalmente", async () => {
    banco.estado.avisos = [aviso("a1", { agendadoPara: seg(-29 * 60) })];
    banco.estado.envios = [envio("e1", "a1", "g1")];
    banco.estado.noGrupo = [{ numeroId: "n1", conversaId: "g1" }];
    expect(await dispararAvisosDaHora(AGORA)).toEqual({ avisos: 1, comandos: 1, semNumero: 0, acimaDoLimite: 0, atrasados: 0 });
    expect(banco.estado.avisos[0]!.situacao).toBe("enviando");
    expect(banco.estado.comandos[0]).toMatchObject({ tipo: "enviar_grupo", executarApos: AGORA });
  });

  it("dois crons ao mesmo tempo não criam comandos duas vezes", async () => {
    banco.estado.avisos = [aviso("a1")];
    banco.estado.envios = [envio("e1", "a1", "g1"), envio("e2", "a1", "g2")];
    banco.estado.noGrupo = ["g1", "g2"].map((conversaId) => ({ numeroId: "n1", conversaId }));
    const [a, b] = await Promise.all([dispararAvisosDaHora(AGORA), dispararAvisosDaHora(AGORA)]);
    expect(a.comandos + b.comandos).toBe(2);
    expect(banco.estado.comandos).toHaveLength(2);
  });
});

describe("conferirEventosMudados", () => {
  const retrato = { titulo: "Festa", dataInicio: "2026-12-07T00:00:00.000Z", horaInicio: "19:00", local: "Pátio" };
  const evento = (extra: Linha = {}) => ({
    id: "ev1", titulo: "Festa", dataInicio: new Date("2026-12-07T00:00:00.000Z"), horaInicio: "19:00", local: "Pátio", excluidoEm: null, ...extra,
  });

  it("aprovado com evento igual não muda", async () => {
    banco.estado.eventos = [evento()];
    banco.estado.avisos = [aviso("a1", { origem: "agenda", eventoId: "ev1", retratoEvento: retrato })];
    expect(await conferirEventosMudados(AGORA)).toEqual({ voltaram: 0, interrompidos: 0 });
    expect(banco.estado.avisos[0]!.situacao).toBe("aprovado");
  });

  it("aprovado com horaInicio mudada volta a rascunho com alerta", async () => {
    banco.estado.eventos = [evento({ horaInicio: "20:00" })];
    banco.estado.avisos = [aviso("a1", { origem: "agenda", eventoId: "ev1", retratoEvento: retrato })];
    expect(await conferirEventosMudados(AGORA)).toEqual({ voltaram: 1, interrompidos: 0 });
    expect(banco.estado.avisos[0]).toMatchObject({
      situacao: "rascunho",
      alerta: "O evento mudou depois da aprovação. Confira e aprove de novo.",
      aprovadoPorId: null,
      retratoEvento: null,
    });
  });

  it("aprovado com evento excluído (ou apagado) volta a rascunho com o alerta de exclusão", async () => {
    banco.estado.eventos = [evento({ excluidoEm: seg(-10) })];
    banco.estado.avisos = [
      aviso("a1", { origem: "agenda", eventoId: "ev1", retratoEvento: retrato }),
      aviso("a2", { origem: "agenda", eventoId: null, retratoEvento: retrato }),
    ];
    expect(await conferirEventosMudados(AGORA)).toEqual({ voltaram: 2, interrompidos: 0 });
    expect(banco.estado.avisos.map((a) => a.alerta)).toEqual(["O evento foi excluído.", "O evento foi excluído."]);
  });

  it("enviando com evento excluído: pendentes falham, o que o motor pegou segue", async () => {
    banco.estado.eventos = [evento({ excluidoEm: seg(-10) })];
    banco.estado.avisos = [aviso("a1", { origem: "agenda", eventoId: "ev1", retratoEvento: retrato, situacao: "enviando" })];
    banco.estado.envios = [
      envio("e1", "a1", "g1", { comandoId: "c1", numeroId: "n1", situacao: "enviado" }),
      envio("e2", "a1", "g2", { comandoId: "c2", numeroId: "n1" }),
      envio("e3", "a1", "g3", { comandoId: "c3", numeroId: "n1" }),
    ];
    banco.estado.comandos = [
      { id: "c1", tipo: "enviar_grupo", situacao: "concluido" },
      { id: "c2", tipo: "enviar_grupo", situacao: "em_andamento" },
      { id: "c3", tipo: "enviar_grupo", situacao: "pendente" },
    ];
    expect(await conferirEventosMudados(AGORA)).toEqual({ voltaram: 0, interrompidos: 1 });
    expect(banco.estado.comandos.map((c) => c.situacao)).toEqual(["concluido", "em_andamento", "falhou"]);
    expect(banco.estado.envios.map((e) => [e.situacao, e.erro])).toEqual([
      ["enviado", null], ["aguardando", null], ["falhou", "Cancelado: o evento mudou."],
    ]);
    expect(banco.estado.avisos[0]!.situacao).toBe("enviando"); // espera o c2
  });

  it("enviando sem nada em andamento fecha o aviso", async () => {
    banco.estado.eventos = [evento({ titulo: "Outra" })];
    banco.estado.avisos = [aviso("a1", { origem: "agenda", eventoId: "ev1", retratoEvento: retrato, situacao: "enviando" })];
    banco.estado.envios = [envio("e1", "a1", "g1", { comandoId: "c1", numeroId: "n1" })];
    banco.estado.comandos = [{ id: "c1", tipo: "enviar_grupo", situacao: "pendente" }];
    await conferirEventosMudados(AGORA);
    expect(banco.estado.avisos[0]!.situacao).toBe("falhou");
  });
});

describe("conclusão dos envios", () => {
  it("concluirComando do último envio deixa o aviso concluido", async () => {
    banco.estado.avisos = [aviso("a1", { situacao: "enviando" })];
    banco.estado.envios = [
      envio("e1", "a1", "g1", { comandoId: "c1", numeroId: "n1", situacao: "falhou", erro: "x" }),
      envio("e2", "a1", "g2", { comandoId: "c2", numeroId: "n1" }),
    ];
    banco.estado.comandos = [{ id: "c2", numeroId: "n1", tipo: "enviar_grupo", situacao: "em_andamento" }];
    expect(await concluirComando("c2", { situacao: "concluido" })).toBe(true);
    expect(banco.estado.envios[1]).toMatchObject({ situacao: "enviado", enviadoEm: expect.any(Date) });
    expect(banco.estado.avisos[0]!.situacao).toBe("concluido");
  });

  it("enquanto sobra envio aguardando o aviso segue enviando; tudo falhou vira falhou", async () => {
    banco.estado.avisos = [aviso("a1", { situacao: "enviando" })];
    banco.estado.envios = [envio("e1", "a1", "g1", { comandoId: "c1" }), envio("e2", "a1", "g2", { comandoId: "c2" })];
    banco.estado.comandos = [
      { id: "c1", numeroId: "n1", tipo: "enviar_grupo", situacao: "em_andamento" },
      { id: "c2", numeroId: "n1", tipo: "enviar_grupo", situacao: "em_andamento" },
    ];
    await concluirComando("c1", { situacao: "falhou", erro: "sem rede" });
    expect(banco.estado.avisos[0]!.situacao).toBe("enviando");
    expect(banco.estado.envios[0]).toMatchObject({ situacao: "falhou", erro: "sem rede" });
    await concluirComando("c2", { situacao: "falhou" });
    expect(banco.estado.avisos[0]!.situacao).toBe("falhou");
  });

  it("enviar_grupo preso falha o envio e fecha o aviso", async () => {
    banco.estado.avisos = [aviso("a1", { situacao: "enviando" })];
    banco.estado.envios = [envio("e1", "a1", "g1", { comandoId: "c1" })];
    banco.estado.comandos = [
      { id: "c1", numeroId: "n1", tipo: "enviar_grupo", situacao: "em_andamento", tentativas: 1, iniciadoEm: seg(-180), criadoEm: seg(-200) },
    ];
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.envios[0]).toMatchObject({ situacao: "falhou", erro: "O motor não confirmou o envio." });
    expect(banco.estado.avisos[0]!.situacao).toBe("falhou");
  });
});
