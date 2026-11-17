import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MensagemMotor } from "../esquemas/motor";

// Banco em memória só com o que a captura usa. Únicos como no MySQL: linha com algum campo nulo não colide.
const banco = vi.hoisted(() => {
  type L = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const estado = {
    numeros: [] as L[],
    conversas: [] as L[],
    numerosNoGrupo: [] as L[],
    contatos: [] as L[],
    mensagens: [] as L[],
    alunos: [] as L[],
    usuarios: [] as L[],
  };
  let seq = 0;

  const igual = (a: unknown, b: unknown) =>
    a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

  function combina(l: L, where: L | undefined): boolean {
    for (const [k, v] of Object.entries(where ?? {})) {
      if (k === "OR") {
        if (!(v as L[]).some((w) => combina(l, w))) return false;
        continue;
      }
      if (v !== null && typeof v === "object" && !(v instanceof Date)) {
        if (k.includes("_")) {
          if (!combina(l, v)) return false; // único composto, ex.: numeroId_jid
          continue;
        }
        if ("in" in v && !v.in.includes(l[k])) return false;
        if ("endsWith" in v && !(typeof l[k] === "string" && l[k].endsWith(v.endsWith))) return false;
        if ("not" in v && igual(l[k], v.not)) return false;
        if ("lt" in v && !(l[k] != null && l[k] < v.lt)) return false;
        continue;
      }
      if (!igual(l[k], v)) return false;
    }
    return true;
  }

  function tabela(nome: keyof typeof estado, unicos: string[][], padrao: L = {}) {
    const linhas = () => estado[nome] as L[];
    const colide = (nova: L) =>
      unicos.some((campos) =>
        linhas().some((l) => campos.every((c) => nova[c] != null && igual(l[c], nova[c]))),
      );
    const inserir = (data: L) => {
      const l = { id: `${nome}-${++seq}`, criadoEm: new Date(), ...padrao, ...data };
      linhas().push(l);
      return l;
    };
    return {
      findMany: async ({ where }: { where?: L } = {}) => linhas().filter((l) => combina(l, where)).map((l) => ({ ...l })),
      findFirst: async ({ where }: { where?: L } = {}) => {
        const l = linhas().find((x) => combina(x, where));
        return l ? { ...l } : null;
      },
      findUnique: async ({ where }: { where: L }) => {
        const l = linhas().find((x) => combina(x, where));
        return l ? { ...l } : null;
      },
      create: async ({ data }: { data: L }) => {
        if (colide(data)) throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        return { ...inserir(data) };
      },
      createMany: async ({ data, skipDuplicates }: { data: L[]; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const d of data) {
          if (colide(d)) {
            if (skipDuplicates) continue;
            throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
          }
          inserir(d);
          count++;
        }
        return { count };
      },
      update: async ({ where, data }: { where: L; data: L }) => {
        const l = linhas().find((x) => combina(x, where));
        if (!l) throw new Error("Registro não encontrado");
        return { ...Object.assign(l, data) };
      },
      updateMany: async ({ where, data }: { where: L; data: L }) => {
        const alvo = linhas().filter((x) => combina(x, where));
        alvo.forEach((x) => Object.assign(x, data));
        return { count: alvo.length };
      },
    };
  }

  const prisma: L = {
    numeroWhatsapp: tabela("numeros", []),
    conversaWhatsapp: tabela("conversas", [["numeroId", "jid"], ["chaveGrupo"]], {
      chaveGrupo: null, numeroId: null, nome: null, contatoId: null, categoria: "outro", monitorada: false,
      provisoriaAte: null, ultimaMensagemEm: null,
    }),
    numeroNoGrupo: tabela("numerosNoGrupo", [["numeroId", "conversaId"]]),
    contatoWhatsapp: tabela("contatos", [["telefone"], ["lid"]], {
      telefone: null, lid: null, nomeExibido: null, alunoId: null, usuarioId: null,
    }),
    mensagemWhatsapp: tabela("mensagens", [["conversaId", "idExterno"]]),
    aluno: tabela("alunos", []),
    usuario: tabela("usuarios", []),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

const { aplicarConversas, aplicarMensagens, obterOuCriarContato } = await import("./captura");

const AGORA = new Date("2026-11-17T12:00:00Z");
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000);
const GRUPO = "120363000000000001@g.us";

const msg = (idExterno: string, extra: Partial<MensagemMotor> = {}): MensagemMotor => ({
  idExterno,
  jid: GRUPO,
  autorJid: "5562988887777@s.whatsapp.net",
  autorTelefone: "5562988887777",
  deMim: false,
  tipo: "texto",
  texto: "oi",
  enviadaEm: horasAtras(1).toISOString(),
  ...extra,
});

const grupoMonitorado = async () => {
  await aplicarConversas("n1", [{ jid: GRUPO, tipo: "grupo", nome: "Turma A" }], AGORA);
  banco.estado.conversas[0]!.monitorada = true;
};

beforeEach(() => {
  banco.estado.numeros = [
    { id: "n1", telefone: "5562911110000", excluidoEm: null },
    { id: "n2", telefone: "556298220000", excluidoEm: null },
    { id: "nx", telefone: "5562933330000", excluidoEm: horasAtras(100) },
  ];
  banco.estado.conversas = [];
  banco.estado.numerosNoGrupo = [];
  banco.estado.contatos = [];
  banco.estado.mensagens = [];
  banco.estado.alunos = [];
  banco.estado.usuarios = [];
});

describe("aplicarConversas", () => {
  it("grupo recebido por dois números fica uma conversa com os dois números", async () => {
    await aplicarConversas("n1", [{ jid: GRUPO, tipo: "grupo", nome: "Turma A" }], AGORA);
    await aplicarConversas("n2", [{ jid: GRUPO, tipo: "grupo" }], AGORA);
    expect(banco.estado.conversas).toHaveLength(1);
    expect(banco.estado.conversas[0]).toMatchObject({ jid: GRUPO, tipo: "grupo", numeroId: null, nome: "Turma A" });
    expect(banco.estado.numerosNoGrupo.map((n) => n.numeroId).sort()).toEqual(["n1", "n2"]);
  });

  it("dois números criando o mesmo grupo ao mesmo tempo não duplicam", async () => {
    await Promise.all([
      aplicarConversas("n1", [{ jid: GRUPO, tipo: "grupo" }], AGORA),
      aplicarConversas("n2", [{ jid: GRUPO, tipo: "grupo" }], AGORA),
    ]);
    expect(banco.estado.conversas).toHaveLength(1);
    expect(banco.estado.numerosNoGrupo).toHaveLength(2);
  });

  it("grupo nasce com chaveGrupo = jid; individual fica com chaveGrupo nula", async () => {
    await aplicarConversas(
      "n1",
      [{ jid: GRUPO, tipo: "grupo" }, { jid: "5562988887777@s.whatsapp.net", tipo: "individual" }, { jid: "5562977776666@s.whatsapp.net", tipo: "individual" }],
      AGORA,
    );
    expect(banco.estado.conversas.map((c) => [c.tipo, c.chaveGrupo])).toEqual([
      ["grupo", GRUPO],
      ["individual", null],
      ["individual", null],
    ]);
  });

  it("o tipo vem do jid: tipo do motor que não bate é ignorado", async () => {
    await aplicarConversas("n1", [{ jid: "5562988887777@s.whatsapp.net", tipo: "grupo" }], AGORA);
    expect(banco.estado.conversas).toHaveLength(1);
    expect(banco.estado.conversas[0]).toMatchObject({ tipo: "individual", numeroId: "n1", chaveGrupo: null });
    expect(banco.estado.numerosNoGrupo).toHaveLength(0);
  });

  it("atualiza o nome do grupo quando vem um novo", async () => {
    await aplicarConversas("n1", [{ jid: GRUPO, tipo: "grupo", nome: "Antigo" }], AGORA);
    await aplicarConversas("n1", [{ jid: GRUPO, tipo: "grupo", nome: "Novo" }], AGORA);
    expect(banco.estado.conversas[0]!.nome).toBe("Novo");
  });

  it("individual é uma por número da empresa e o contato é um só", async () => {
    const c = { jid: "5562988887777@s.whatsapp.net", tipo: "individual" as const, nome: "Ana" };
    await aplicarConversas("n1", [c], AGORA);
    await aplicarConversas("n2", [c], AGORA);
    await aplicarConversas("n1", [c], AGORA);
    expect(banco.estado.conversas.map((x) => x.numeroId).sort()).toEqual(["n1", "n2"]);
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({ telefone: "5562988887777", nomeExibido: "Ana" });
    expect(banco.estado.conversas[0]).toMatchObject({ contatoId: banco.estado.contatos[0]!.id, categoria: "lead" });
  });

  it("individual de contato que é da equipe nasce com categoria equipe", async () => {
    banco.estado.usuarios = [{ id: "u1", whatsapp: "62988887777" }];
    await aplicarConversas("n1", [{ jid: "5562988887777@s.whatsapp.net", tipo: "individual" }], AGORA);
    expect(banco.estado.contatos[0]).toMatchObject({ usuarioId: "u1", alunoId: null });
    expect(banco.estado.conversas[0]!.categoria).toBe("equipe");
  });
});

describe("contato e ligação com aluno", () => {
  it("telefone sem o 9 casa com o aluno cadastrado com o 9 e a conversa nasce como aluno", async () => {
    banco.estado.alunos = [{ id: "a1", telefone: "62981707432" }, { id: "a2", telefone: "62911117432" }];
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m1", { jid: "556281707432@s.whatsapp.net", autorJid: undefined, autorTelefone: undefined })],
      AGORA,
    );
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({ telefone: "556281707432", alunoId: "a1" });
    expect(banco.estado.conversas[0]).toMatchObject({ tipo: "individual", numeroId: "n1", categoria: "aluno", nome: null });
    expect(banco.estado.mensagens[0]).toMatchObject({ contatoId: banco.estado.contatos[0]!.id, deMim: false });
  });

  it("dois alunos com a mesma chave: não liga", async () => {
    banco.estado.alunos = [{ id: "a1", telefone: "62981707432" }, { id: "a2", telefone: "5562981707432" }];
    const id = await obterOuCriarContato({ jid: "556281707432@s.whatsapp.net" });
    expect(banco.estado.contatos.find((c) => c.id === id)).toMatchObject({ alunoId: null });
  });

  it("autor só com lid vira contato pelo lid e é completado e ligado quando chega o telefone", async () => {
    banco.estado.alunos = [{ id: "a1", telefone: "62981707432" }];
    await grupoMonitorado();
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m1", { autorJid: "123456789012345@lid", autorTelefone: undefined, autorNome: "Dra. Ana" })],
      AGORA,
    );
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({
      lid: "123456789012345@lid", telefone: null, nomeExibido: "Dra. Ana", alunoId: null,
    });

    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m2", { autorJid: "123456789012345@lid", autorTelefone: "556281707432", autorNome: "Ana" })],
      AGORA,
    );
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({
      lid: "123456789012345@lid", telefone: "556281707432", nomeExibido: "Ana", alunoId: "a1",
    });
    expect(banco.estado.mensagens.map((m) => m.contatoId)).toEqual([banco.estado.contatos[0]!.id, banco.estado.contatos[0]!.id]);
  });

  it("nome do contato só muda com mensagem ao vivo (o histórico não volta a um nome antigo)", async () => {
    await grupoMonitorado();
    await aplicarMensagens("n1", "ao_vivo", [msg("m1", { autorNome: "Ana Atual" })], AGORA);
    await aplicarMensagens("n1", "historico", [msg("m0", { autorNome: "Ana Antiga", enviadaEm: horasAtras(48).toISOString() })], AGORA);
    expect(banco.estado.contatos[0]!.nomeExibido).toBe("Ana Atual");
    await aplicarMensagens("n1", "ao_vivo", [msg("m2", { autorNome: "Ana Nova" })], AGORA);
    expect(banco.estado.contatos[0]!.nomeExibido).toBe("Ana Nova");
  });

  it("histórico dá nome a contato que ainda não tem", async () => {
    await grupoMonitorado();
    await aplicarMensagens("n1", "historico", [msg("m0", { autorNome: "Bia" })], AGORA);
    expect(banco.estado.contatos[0]!.nomeExibido).toBe("Bia");
  });

  it("acha o contato pela chave mesmo com o telefone em outro formato", async () => {
    const a = await obterOuCriarContato({ telefone: "5562981707432" });
    const b = await obterOuCriarContato({ jid: "556281707432@s.whatsapp.net", nome: "Ana" });
    expect(b).toBe(a);
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({ telefone: "5562981707432", nomeExibido: "Ana" });
  });
});

describe("aplicarMensagens", () => {
  it("a mesma mensagem chegando pelos dois números fica uma só", async () => {
    await grupoMonitorado();
    const r1 = await aplicarMensagens("n1", "ao_vivo", [msg("m1")], AGORA);
    const r2 = await aplicarMensagens("n2", "ao_vivo", [msg("m1")], AGORA);
    expect(r1).toEqual({ salvas: 1, descartadas: 0 });
    expect(r2).toEqual({ salvas: 0, descartadas: 0 });
    expect(banco.estado.conversas).toHaveLength(1);
    expect(banco.estado.mensagens).toHaveLength(1);
    expect(banco.estado.mensagens[0]).toMatchObject({ numeroId: "n1", idExterno: "m1", texto: "oi", tipo: "texto" });
    expect(banco.estado.numerosNoGrupo.map((n) => n.numeroId).sort()).toEqual(["n1", "n2"]);
  });

  it("reaplicar o mesmo lote não cria nada novo", async () => {
    await grupoMonitorado();
    const lote = [msg("m1"), msg("m2", { autorJid: "999@lid", autorTelefone: undefined }), msg("m3", { jid: "5562977776666@s.whatsapp.net" })];
    await aplicarMensagens("n1", "ao_vivo", lote, AGORA);
    const antes = {
      conversas: banco.estado.conversas.length,
      contatos: banco.estado.contatos.length,
      mensagens: banco.estado.mensagens.length,
      nosGrupos: banco.estado.numerosNoGrupo.length,
    };
    const r = await aplicarMensagens("n1", "ao_vivo", lote, AGORA);
    expect(r).toEqual({ salvas: 0, descartadas: 0 });
    expect({
      conversas: banco.estado.conversas.length,
      contatos: banco.estado.contatos.length,
      mensagens: banco.estado.mensagens.length,
      nosGrupos: banco.estado.numerosNoGrupo.length,
    }).toEqual(antes);
    expect(antes).toEqual({ conversas: 2, contatos: 3, mensagens: 3, nosGrupos: 1 });
  });

  it("mensagem ao vivo de grupo não monitorado é descartada (o grupo passa a existir)", async () => {
    const r = await aplicarMensagens("n1", "ao_vivo", [msg("m1")], AGORA);
    expect(r).toEqual({ salvas: 0, descartadas: 1 });
    expect(banco.estado.mensagens).toHaveLength(0);
    expect(banco.estado.conversas).toHaveLength(1);
    expect(banco.estado.conversas[0]).toMatchObject({ jid: GRUPO, tipo: "grupo", nome: null, provisoriaAte: null });
  });

  it("do histórico, grupo não monitorado fica provisório por 48 h", async () => {
    const r = await aplicarMensagens("n1", "historico", [msg("m1")], AGORA);
    expect(r).toEqual({ salvas: 1, descartadas: 0 });
    expect(banco.estado.conversas[0]!.provisoriaAte).toEqual(new Date(AGORA.getTime() + 48 * 3_600_000));
  });

  it("provisoriaAte já marcado não é empurrado para frente", async () => {
    await aplicarMensagens("n1", "historico", [msg("m1")], AGORA);
    await aplicarMensagens("n1", "historico", [msg("m2")], new Date(AGORA.getTime() + 3_600_000));
    expect(banco.estado.conversas[0]!.provisoriaAte).toEqual(new Date(AGORA.getTime() + 48 * 3_600_000));
  });

  it("histórico de 31 dias atrás é ignorado", async () => {
    await grupoMonitorado();
    const r = await aplicarMensagens("n1", "historico", [msg("m1", { enviadaEm: horasAtras(31 * 24).toISOString() })], AGORA);
    expect(r).toEqual({ salvas: 0, descartadas: 1 });
    expect(banco.estado.mensagens).toHaveLength(0);
  });

  it("autor que é outro número da empresa conta como deMim", async () => {
    await grupoMonitorado();
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [
        msg("m1", { autorJid: "5562998220000@s.whatsapp.net", autorTelefone: "5562998220000" }), // n2, com o 9
        msg("m2", { autorJid: "5562933330000@s.whatsapp.net", autorTelefone: "5562933330000" }), // nx, excluído
        msg("m3", { autorJid: undefined, autorTelefone: undefined, deMim: true }),
      ],
      AGORA,
    );
    expect(banco.estado.mensagens.map((m) => [m.idExterno, m.deMim])).toEqual([
      ["m1", true],
      ["m2", false],
      ["m3", true],
    ]);
    expect(banco.estado.mensagens[2]!.contatoId).toBeNull();
  });

  it("conversa pessoal: mensagens descartadas", async () => {
    const jid = "5562977776666@s.whatsapp.net";
    await aplicarConversas("n1", [{ jid, tipo: "individual" }], AGORA);
    banco.estado.conversas[0]!.categoria = "pessoal";
    const r = await aplicarMensagens("n1", "ao_vivo", [msg("m1", { jid }), msg("m2", { jid })], AGORA);
    expect(r).toEqual({ salvas: 0, descartadas: 2 });
    expect(banco.estado.mensagens).toHaveLength(0);
  });

  it("atualiza ultimaMensagemEm com a maior enviadaEm e não volta para trás", async () => {
    await grupoMonitorado();
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m1", { enviadaEm: horasAtras(3).toISOString() }), msg("m2", { enviadaEm: horasAtras(1).toISOString() })],
      AGORA,
    );
    expect(banco.estado.conversas[0]!.ultimaMensagemEm).toEqual(horasAtras(1));
    await aplicarMensagens("n1", "historico", [msg("m0", { enviadaEm: horasAtras(5).toISOString() })], AGORA);
    expect(banco.estado.conversas[0]!.ultimaMensagemEm).toEqual(horasAtras(1));
  });

  it("grava resposta e tipo, e corta o texto em 4000", async () => {
    await grupoMonitorado();
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m1", { tipo: "imagem", texto: "x".repeat(4000), respondeA: "m0" })],
      AGORA,
    );
    expect(banco.estado.mensagens[0]).toMatchObject({ tipo: "imagem", respondeAIdExterno: "m0", enviadaEm: horasAtras(1) });
    expect(banco.estado.mensagens[0]!.texto).toHaveLength(4000);
  });

  it("individual sem autor: o autor é o contato da conversa", async () => {
    const jid = "5562977776666@s.whatsapp.net";
    await aplicarMensagens(
      "n1",
      "ao_vivo",
      [msg("m1", { jid, autorJid: undefined, autorTelefone: undefined, autorNome: "Bia" })],
      AGORA,
    );
    expect(banco.estado.contatos).toHaveLength(1);
    expect(banco.estado.contatos[0]).toMatchObject({ telefone: "5562977776666", nomeExibido: "Bia" });
    expect(banco.estado.conversas[0]!.contatoId).toBe(banco.estado.contatos[0]!.id);
    expect(banco.estado.mensagens[0]!.contatoId).toBe(banco.estado.contatos[0]!.id);
  });
});
