import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o serviço do motor usa.
const banco = vi.hoisted(() => {
  // Filtro mínimo do Prisma: igualdade, null, in, lt/lte, OR.
  const bate = (linha: Record<string, any>, where: Record<string, any>): boolean => // eslint-disable-line @typescript-eslint/no-explicit-any
    Object.entries(where).every(([k, cond]) => {
      if (k === "OR") return (cond as Record<string, any>[]).some((w) => bate(linha, w)); // eslint-disable-line @typescript-eslint/no-explicit-any
      const v = linha[k] ?? null;
      if (cond === null) return v === null;
      if (typeof cond === "object" && !(cond instanceof Date)) {
        if ("in" in cond && !cond.in.includes(v)) return false;
        if ("lt" in cond && !(v !== null && v < cond.lt)) return false;
        if ("lte" in cond && !(v !== null && v <= cond.lte)) return false;
        return true;
      }
      return v === cond;
    });
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    comandos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const prisma = {
    numeroWhatsapp: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.numeros.find((n) => n.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Linha }) =>
        Object.assign(estado.numeros.find((n) => n.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
        const alvo = estado.numeros.filter(
          (n) =>
            n.excluidoEm === where.excluidoEm &&
            (where.situacao === undefined || n.situacao === where.situacao) &&
            (where.id?.notIn === undefined || !where.id.notIn.includes(n.id)) &&
            (where.conectadoEm?.lt === undefined || (n.conectadoEm !== null && n.conectadoEm < where.conectadoEm.lt)),
        );
        alvo.forEach((n) => Object.assign(n, data));
        return { count: alvo.length };
      },
    },
    comandoWhatsapp: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.comandos.find((c) => c.id === where.id) ?? null,
      findMany: async ({ where, take, orderBy }: { where: Linha; take: number; orderBy: Linha | Linha[] }) => {
        const chaves = (Array.isArray(orderBy) ? orderBy : [orderBy]).map((o) => Object.keys(o)[0]!);
        const valor = (c: Linha, k: string) => (c[k] instanceof Date ? c[k].getTime() : (c[k] ?? -Infinity));
        return estado.comandos
          .filter((c) => bate(c, where))
          .sort((a, b) => {
            for (const k of chaves) {
              const va = valor(a, k);
              const vb = valor(b, k);
              if (va !== vb) return va < vb ? -1 : 1;
            }
            return 0;
          })
          .slice(0, take)
          .map((c) => ({ ...c, numero: { excluidoEm: estado.numeros.find((n) => n.id === c.numeroId)!.excluidoEm } }));
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) =>
        Object.assign(estado.comandos.find((c) => c.id === where.id)!, data),
      // Update condicional: só atinge o comando se ele ainda bate com a condição.
      updateMany: async ({ where, data }: { where: Linha; data: Linha }) => {
        const alvo = estado.comandos.filter((c) => bate(c, where));
        for (const c of alvo) {
          const { tentativas, ...resto } = data;
          Object.assign(c, resto);
          if (tentativas) c.tentativas += tentativas.increment;
        }
        return { count: alvo.length };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
const captura = vi.hoisted(() => ({
  aplicarConversas: vi.fn(async () => {}),
  aplicarMensagens: vi.fn(async () => ({ salvas: 0, descartadas: 0 })),
}));
vi.mock("./captura", () => captura);
const envio = vi.hoisted(() => ({ registrarResultadoEnvio: vi.fn(async () => {}) }));
vi.mock("./avisos-envio", async (original) => ({ ...(await original<typeof import("./avisos-envio")>()), ...envio }));

const { aplicarEventos, concluirComando, entregarComandos } = await import("./motor");

const AGORA = new Date("2026-11-17T12:00:00Z");
const minAtras = (m: number) => new Date(AGORA.getTime() - m * 60_000);

const vaga = (id: string, extra: Linha = {}) => ({
  id, telefone: null, situacao: "desconectado", qrAtual: null, qrEm: null, conectadoEm: null,
  ultimoSinalEm: null, erro: null, excluidoEm: null, ...extra,
});
const comando = (id: string, extra: Linha = {}) => ({
  id, numeroId: "n1", tipo: "conectar", situacao: "pendente", tentativas: 0, iniciadoEm: null,
  concluidoEm: null, erro: null, criadoEm: minAtras(10), ...extra,
});

beforeEach(() => {
  banco.estado.numeros = [vaga("n1"), vaga("n2"), vaga("nx", { excluidoEm: minAtras(100) })];
  banco.estado.comandos = [];
  captura.aplicarConversas.mockClear();
  captura.aplicarMensagens.mockClear();
  envio.registrarResultadoEnvio.mockClear();
});

describe("aplicarEventos", () => {
  it("qr grava o QR e a hora", async () => {
    await aplicarEventos([{ tipo: "qr", numeroId: "n1", qr: "QR1" }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ qrAtual: "QR1", qrEm: AGORA, situacao: "aguardando_qr" });
  });

  it("conectado grava o telefone e limpa o QR", async () => {
    Object.assign(banco.estado.numeros[0]!, { qrAtual: "QR1", qrEm: AGORA, erro: "x", situacao: "aguardando_qr" });
    await aplicarEventos([{ tipo: "conectado", numeroId: "n1", telefone: "5562999999999" }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({
      situacao: "conectado", telefone: "5562999999999", conectadoEm: AGORA, qrAtual: null, qrEm: null, erro: null,
    });
  });

  it("desconectado removido no celular grava o motivo em erro", async () => {
    await aplicarEventos([{ tipo: "desconectado", numeroId: "n1", motivo: "removido_no_celular" }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "desconectado", erro: "removido_no_celular" });
  });

  it("desconectado a pedido deixa erro nulo", async () => {
    banco.estado.numeros[0]!.erro = "velho";
    await aplicarEventos([{ tipo: "desconectado", numeroId: "n1", motivo: "pedido" }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "desconectado", erro: null });
  });

  it("desconectado com motivo erro põe a vaga em erro e grava o detalhe", async () => {
    Object.assign(banco.estado.numeros[0]!, { situacao: "aguardando_qr", qrAtual: "QR1", qrEm: AGORA });
    await aplicarEventos(
      [{ tipo: "desconectado", numeroId: "n1", motivo: "erro", detalhe: "Acesso recusado pelo WhatsApp." }],
      AGORA,
    );
    expect(banco.estado.numeros[0]).toMatchObject({
      situacao: "erro", erro: "Acesso recusado pelo WhatsApp.", qrAtual: null, qrEm: null,
    });
  });

  it("motivo erro sem detalhe (ou com detalhe vazio) grava um texto padrão", async () => {
    await aplicarEventos([{ tipo: "desconectado", numeroId: "n1", motivo: "erro", detalhe: "" }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "erro", erro: "Erro informado pelo motor." });
    await aplicarEventos([{ tipo: "desconectado", numeroId: "n2", motivo: "erro" }], AGORA);
    expect(banco.estado.numeros[1]).toMatchObject({ situacao: "erro", erro: "Erro informado pelo motor." });
  });

  it("vaga excluída conta como ignorada e o resto do lote é aplicado", async () => {
    const r = await aplicarEventos(
      [
        { tipo: "qr", numeroId: "nx", qr: "A" },
        { tipo: "qr", numeroId: "inexistente", qr: "B" },
        { tipo: "qr", numeroId: "n2", qr: "C" },
      ],
      AGORA,
    );
    expect(r).toEqual({ aplicados: 1, ignorados: 2 });
    expect(banco.estado.numeros[1]!.qrAtual).toBe("C");
    expect(banco.estado.numeros[2]!.qrAtual).toBeNull();
  });

  it("conversas e mensagens vão para a captura e contam como aplicados", async () => {
    const conversas = [{ jid: "1@g.us", tipo: "grupo" as const }];
    const mensagens = [
      { idExterno: "m1", jid: "1@g.us", deMim: false, tipo: "texto" as const, enviadaEm: AGORA.toISOString() },
    ];
    const r = await aplicarEventos(
      [
        { tipo: "conversas", numeroId: "n1", conversas },
        { tipo: "mensagens", numeroId: "n2", origem: "historico", mensagens },
      ],
      AGORA,
    );
    expect(r).toEqual({ aplicados: 2, ignorados: 0 });
    expect(captura.aplicarConversas).toHaveBeenCalledWith("n1", conversas, AGORA);
    expect(captura.aplicarMensagens).toHaveBeenCalledWith("n2", "historico", mensagens, AGORA, expect.any(Object));
  });

  it("os eventos de mensagens do mesmo lote compartilham o contexto (cache de contatos e números da empresa)", async () => {
    const ev = { tipo: "mensagens" as const, numeroId: "n1", origem: "ao_vivo" as const, mensagens: [] };
    await aplicarEventos([ev, { ...ev, numeroId: "n2" }], AGORA);
    const [primeira, segunda] = captura.aplicarMensagens.mock.calls as unknown as unknown[][];
    expect(primeira![4]).toBeDefined();
    expect(segunda![4]).toBe(primeira![4]);
    // Outra chamada, outro contexto.
    await aplicarEventos([ev], AGORA);
    expect((captura.aplicarMensagens.mock.calls as unknown as unknown[][])[2]![4]).not.toBe(primeira![4]);
  });

  it("erro passageiro do banco (P2034) faz o lote falhar, para o motor reenviar", async () => {
    captura.aplicarMensagens.mockRejectedValueOnce(Object.assign(new Error("deadlock"), { code: "P2034" }));
    await expect(
      aplicarEventos([{ tipo: "mensagens", numeroId: "n1", origem: "ao_vivo", mensagens: [] }], AGORA),
    ).rejects.toMatchObject({ code: "P2034" });
  });

  it("evento que falha conta como ignorado, registra só o tipo e o código, e o resto do lote segue", async () => {
    const erro = Object.assign(new Error("Duplicate entry '5562999999999' for key 'telefone'"), {
      code: "P2002",
      meta: { driverAdapterError: { cause: { kind: "mysql", originalCode: "1062" } } },
    });
    captura.aplicarMensagens.mockRejectedValueOnce(erro);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await aplicarEventos(
      [
        { tipo: "mensagens", numeroId: "n1", origem: "ao_vivo", mensagens: [] },
        { tipo: "qr", numeroId: "n1", qr: "QR1" },
      ],
      AGORA,
    );
    expect(r).toEqual({ aplicados: 1, ignorados: 1 });
    expect(banco.estado.numeros[0]!.qrAtual).toBe("QR1");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[whatsapp/motor] falha ao aplicar evento mensagens (Error P2002 mysql:1062)");
    expect(JSON.stringify(log.mock.calls)).not.toContain("5562999999999");
    log.mockRestore();
  });

  it("conversas e mensagens de vaga excluída ou inexistente são ignoradas", async () => {
    const r = await aplicarEventos(
      [
        { tipo: "conversas", numeroId: "nx", conversas: [] },
        { tipo: "mensagens", numeroId: "inexistente", origem: "ao_vivo", mensagens: [] },
      ],
      AGORA,
    );
    expect(r).toEqual({ aplicados: 0, ignorados: 2 });
    expect(captura.aplicarConversas).not.toHaveBeenCalled();
    expect(captura.aplicarMensagens).not.toHaveBeenCalled();
  });

  it("sinal atualiza ultimoSinalEm das vagas não excluídas", async () => {
    await aplicarEventos([{ tipo: "sinal", conectados: [] }], AGORA);
    expect(banco.estado.numeros[0]!.ultimoSinalEm).toEqual(AGORA);
    expect(banco.estado.numeros[1]!.ultimoSinalEm).toEqual(AGORA);
    expect(banco.estado.numeros[2]!.ultimoSinalEm).toBeNull();
  });

  it("sinal tira de 'conectado' a vaga que o motor não tem mais conectada", async () => {
    banco.estado.numeros = [
      vaga("n1", { situacao: "conectado", conectadoEm: minAtras(10) }),
      vaga("n2", { situacao: "conectado", conectadoEm: minAtras(10) }),
    ];
    await aplicarEventos([{ tipo: "sinal", conectados: ["n2"] }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "erro", erro: "O motor não está com este número conectado." });
    expect(banco.estado.numeros[1]).toMatchObject({ situacao: "conectado", erro: null });
  });

  it("sinal não mexe na vaga que acabou de conectar (o motor pode ainda não ter contado)", async () => {
    banco.estado.numeros = [vaga("n1", { situacao: "conectado", conectadoEm: minAtras(1) })];
    await aplicarEventos([{ tipo: "sinal", conectados: [] }], AGORA);
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "conectado", erro: null });
  });
});

describe("entregarComandos", () => {
  it("entrega pendente e marca em andamento", async () => {
    banco.estado.comandos = [comando("c1")];
    const r = await entregarComandos(AGORA);
    expect(r).toEqual([{ id: "c1", numeroId: "n1", tipo: "conectar" }]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "em_andamento", tentativas: 1, iniciadoEm: AGORA });
  });

  it("não reentrega em andamento de 1 min, mas reentrega o de 3 min", async () => {
    banco.estado.comandos = [
      comando("c1", { situacao: "em_andamento", tentativas: 1, iniciadoEm: minAtras(1) }),
      comando("c2", { situacao: "em_andamento", tentativas: 1, iniciadoEm: minAtras(3) }),
    ];
    const r = await entregarComandos(AGORA);
    expect(r.map((c) => c.id)).toEqual(["c2"]);
    expect(banco.estado.comandos[1]!.tentativas).toBe(2);
  });

  it("marca falhou o que já tem 3 tentativas", async () => {
    banco.estado.comandos = [comando("c1", { situacao: "em_andamento", tentativas: 3, iniciadoEm: minAtras(3) })];
    const r = await entregarComandos(AGORA);
    expect(r).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "O motor não concluiu o comando." });
  });

  it("conectar de vaga excluída falha sem ser entregue", async () => {
    banco.estado.comandos = [comando("c1", { numeroId: "nx" })];
    expect(await entregarComandos(AGORA)).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "Número excluído." });
  });

  it("desconectar de vaga excluída ainda é entregue (encerra a sessão no motor)", async () => {
    banco.estado.comandos = [comando("c1", { numeroId: "nx", tipo: "desconectar" })];
    expect(await entregarComandos(AGORA)).toEqual([{ id: "c1", numeroId: "nx", tipo: "desconectar" }]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "em_andamento", tentativas: 1 });
  });

  it("duas consultas ao mesmo tempo não entregam o mesmo comando duas vezes", async () => {
    banco.estado.comandos = [comando("c1")];
    const [a, b] = await Promise.all([entregarComandos(AGORA), entregarComandos(AGORA)]);
    expect(a.length + b.length).toBe(1);
    expect(banco.estado.comandos[0]!.tentativas).toBe(1);
  });

  it("entrega no máximo 20 por chamada", async () => {
    banco.estado.comandos = Array.from({ length: 25 }, (_, i) => comando(`c${i}`, { criadoEm: minAtras(100 - i) }));
    expect(await entregarComandos(AGORA)).toHaveLength(20);
  });
});

describe("entregarComandos: enviar_grupo", () => {
  const dados = (envioId: string) => ({ jid: "1203@g.us", texto: "Oi", envioId });
  const envioGrupo = (id: string, extra: Linha = {}) =>
    comando(id, { tipo: "enviar_grupo", dados: dados(`e-${id}`), executarApos: minAtras(1), ...extra });

  it("sem recursos não entrega enviar_grupo e o deixa pendente (o motor antigo o trataria como desconectar)", async () => {
    banco.estado.comandos = [envioGrupo("g1"), comando("c1", { criadoEm: minAtras(5) })];
    expect(await entregarComandos(AGORA)).toEqual([{ id: "c1", numeroId: "n1", tipo: "conectar" }]);
    expect(await entregarComandos(AGORA, { recursos: ["outro"] })).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "pendente", tentativas: 0 });
  });

  it("motor antigo (sem recursos): pendente vencido há 31 min falha, fecha o envio e nada é entregue", async () => {
    banco.estado.comandos = [envioGrupo("g1", { executarApos: minAtras(31) })];
    expect(await entregarComandos(AGORA)).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "Passou do horário (o motor ficou parado).", tentativas: 0 });
    expect(envio.registrarResultadoEnvio).toHaveBeenCalledWith(
      expect.anything(), "g1", { situacao: "falhou", erro: "Passou do horário (o motor ficou parado)." }, AGORA,
    );
  });

  it("com recursos entrega no máximo 1 por número, com os dados", async () => {
    banco.estado.comandos = [
      envioGrupo("g1", { executarApos: minAtras(3) }),
      envioGrupo("g2", { executarApos: minAtras(2) }),
      envioGrupo("g3", { executarApos: minAtras(1) }),
      envioGrupo("h1", { numeroId: "n2" }),
    ];
    const r = await entregarComandos(AGORA, { recursos: ["enviar_grupo"] });
    expect(r).toEqual([
      { id: "g1", numeroId: "n1", tipo: "enviar_grupo", dados: dados("e-g1") },
      { id: "h1", numeroId: "n2", tipo: "enviar_grupo", dados: dados("e-h1") },
    ]);
    expect(banco.estado.comandos.map((c) => c.situacao)).toEqual(["em_andamento", "pendente", "pendente", "em_andamento"]);
  });

  it("executarApos no futuro não é entregue", async () => {
    banco.estado.comandos = [envioGrupo("g1", { executarApos: new Date(AGORA.getTime() + 1000) })];
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.comandos[0]!.situacao).toBe("pendente");
  });

  it("preso há 3 min vira falhou e nunca volta na lista (com ou sem recursos)", async () => {
    banco.estado.comandos = [envioGrupo("g1", { situacao: "em_andamento", tentativas: 1, iniciadoEm: minAtras(3) })];
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "O motor não confirmou o envio.", tentativas: 1 });
    expect(envio.registrarResultadoEnvio).toHaveBeenCalledWith(
      expect.anything(), "g1", { situacao: "falhou", erro: "O motor não confirmou o envio." }, AGORA,
    );
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.comandos[0]!.tentativas).toBe(1);
  });

  it("vencido há mais de 30 min (motor parado) não sai: falha o comando e o envio", async () => {
    banco.estado.comandos = [envioGrupo("g1", { executarApos: minAtras(31) }), envioGrupo("g2", { executarApos: minAtras(29) })];
    const r = await entregarComandos(AGORA, { recursos: ["enviar_grupo"] });
    expect(r.map((c) => c.id)).toEqual(["g2"]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "Passou do horário (o motor ficou parado).", tentativas: 0 });
    expect(envio.registrarResultadoEnvio).toHaveBeenCalledWith(
      expect.anything(), "g1", { situacao: "falhou", erro: "Passou do horário (o motor ficou parado)." }, AGORA,
    );
  });

  it("em andamento há 1 min não é reentregue", async () => {
    banco.estado.comandos = [envioGrupo("g1", { situacao: "em_andamento", tentativas: 1, iniciadoEm: minAtras(1) })];
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.comandos[0]!.situacao).toBe("em_andamento");
  });

  it("duas consultas ao mesmo tempo não entregam o mesmo envio duas vezes", async () => {
    banco.estado.comandos = [envioGrupo("g1")];
    const op = { recursos: ["enviar_grupo"] };
    const [a, b] = await Promise.all([entregarComandos(AGORA, op), entregarComandos(AGORA, op)]);
    expect(a.length + b.length).toBe(1);
    expect(banco.estado.comandos[0]!.tentativas).toBe(1);
  });

  it("dados inválidos: falha sem entregar", async () => {
    banco.estado.comandos = [envioGrupo("g1", { dados: { jid: "x" } })];
    expect(await entregarComandos(AGORA, { recursos: ["enviar_grupo"] })).toEqual([]);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "Dados do envio inválidos." });
  });
});

describe("concluirComando", () => {
  it("enviar_grupo repassa o resultado ao envio", async () => {
    banco.estado.comandos = [comando("g1", { tipo: "enviar_grupo", situacao: "em_andamento" })];
    await concluirComando("g1", { situacao: "concluido" });
    expect(envio.registrarResultadoEnvio).toHaveBeenCalledWith(expect.anything(), "g1", { situacao: "concluido", erro: null }, expect.any(Date));
    expect(banco.estado.numeros[0]!.situacao).toBe("desconectado");
  });

  it("conectar que falhou põe a vaga em erro", async () => {
    banco.estado.comandos = [comando("c1", { situacao: "em_andamento", tentativas: 1 })];
    expect(await concluirComando("c1", { situacao: "falhou", erro: "sem rede" })).toBe(true);
    expect(banco.estado.comandos[0]).toMatchObject({ situacao: "falhou", erro: "sem rede" });
    expect(banco.estado.numeros[0]).toMatchObject({ situacao: "erro", erro: "sem rede" });
  });

  it("concluído não mexe na vaga", async () => {
    banco.estado.comandos = [comando("c1", { situacao: "em_andamento" })];
    await concluirComando("c1", { situacao: "concluido" });
    expect(banco.estado.comandos[0]!.situacao).toBe("concluido");
    expect(banco.estado.numeros[0]!.situacao).toBe("desconectado");
  });

  it("id desconhecido devolve false", async () => {
    expect(await concluirComando("nada", { situacao: "concluido" })).toBe(false);
  });
});
