import { beforeEach, describe, expect, it, vi } from "vitest";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o serviço do motor usa.
const banco = vi.hoisted(() => {
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
      findMany: async ({ where, take }: { where: { OR: Linha[] }; take: number }) => {
        const [pendente, preso] = where.OR as [{ situacao: string }, { situacao: string; iniciadoEm: { lt: Date } }];
        return estado.comandos
          .filter(
            (c) =>
              c.situacao === pendente.situacao ||
              (c.situacao === preso.situacao && c.iniciadoEm && c.iniciadoEm < preso.iniciadoEm.lt),
          )
          .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
          .slice(0, take)
          .map((c) => ({ ...c, numero: { excluidoEm: estado.numeros.find((n) => n.id === c.numeroId)!.excluidoEm } }));
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) =>
        Object.assign(estado.comandos.find((c) => c.id === where.id)!, data),
      // Update condicional: só atinge o comando se ele ainda está pendente ou preso.
      updateMany: async ({ where, data }: { where: { id: string; OR: Linha[] }; data: Linha }) => {
        const [pendente, preso] = where.OR as [{ situacao: string }, { situacao: string; iniciadoEm: { lt: Date } }];
        const c = estado.comandos.find(
          (x) =>
            x.id === where.id &&
            (x.situacao === pendente.situacao || (x.situacao === preso.situacao && x.iniciadoEm && x.iniciadoEm < preso.iniciadoEm.lt)),
        );
        if (!c) return { count: 0 };
        const { tentativas, ...resto } = data;
        Object.assign(c, resto);
        if (tentativas) c.tentativas += tentativas.increment;
        return { count: 1 };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

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

describe("concluirComando", () => {
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
