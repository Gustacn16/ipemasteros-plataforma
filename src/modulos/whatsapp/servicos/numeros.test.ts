import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o serviço de números usa.
const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    comandos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    usuarios: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    auditorias: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    seq: 0,
    chamadas: [] as string[],
  };
  const prisma = {
    numeroWhatsapp: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.numeros.find((n) => n.id === where.id) ?? null,
      findMany: async ({ where }: { where: { excluidoEm: null; usuarioId?: string } }) =>
        estado.numeros
          .filter((n) => n.excluidoEm === null && (where.usuarioId === undefined || n.usuarioId === where.usuarioId))
          .map((n) => ({ ...n, usuario: estado.usuarios.find((u) => u.id === n.usuarioId) ?? null })),
      create: async ({ data }: { data: Linha }) => {
        const n = {
          id: `n${++estado.seq}`, telefone: null, situacao: "desconectado", qrAtual: null, qrEm: null,
          conectadoEm: null, ultimoSinalEm: null, erro: null, excluidoEm: null, ...data,
        };
        estado.numeros.push(n);
        return n;
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) => {
        estado.chamadas.push("numero.update");
        return Object.assign(estado.numeros.find((n) => n.id === where.id)!, data);
      },
    },
    comandoWhatsapp: {
      findFirst: async ({ where }: { where: { numeroId: string; tipo: string; situacao: { in: string[] } } }) => {
        estado.chamadas.push("comando.findFirst");
        return estado.comandos.find(
          (c) => c.numeroId === where.numeroId && c.tipo === where.tipo && where.situacao.in.includes(c.situacao),
        ) ?? null;
      },
      create: async ({ data }: { data: Linha }) => {
        const c = { id: `c${++estado.seq}`, situacao: "pendente", tentativas: 0, ...data };
        estado.comandos.push(c);
        return c;
      },
    },
    usuario: {
      findFirst: async ({ where }: { where: { id: string; ativo: boolean; papel: string } }) =>
        estado.usuarios.find((u) => u.id === where.id && u.ativo === where.ativo && u.papel === where.papel) ?? null,
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return { estado, prisma };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));
vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: async (dados: Linha) => {
    banco.estado.auditorias.push(dados);
  },
}));

const { alterarTimeNumero, criarNumero, excluirNumero, listarNumeros, situacaoParaTela, solicitarConexao, solicitarDesconexao } =
  await import("./numeros");

const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const ana = { id: "u1", papel: "comercial" } as UsuarioAtual;
const beto = { id: "u2", papel: "comercial" } as UsuarioAtual;

const agora = () => new Date();

beforeEach(() => {
  const e = banco.estado;
  e.seq = 0;
  e.comandos = [];
  e.chamadas = [];
  e.auditorias = [];
  e.usuarios = [
    { id: "u1", nome: "Ana Souza", apelido: "Aninha", papel: "comercial", ativo: true },
    { id: "u2", nome: "Beto", apelido: null, papel: "comercial", ativo: true },
    { id: "u3", nome: "Caio", apelido: null, papel: "comercial", ativo: false },
    { id: "u4", nome: "Dora", apelido: null, papel: "gestor", ativo: true },
  ];
  const base = { telefone: null, qrAtual: null, qrEm: null, conectadoEm: null, erro: null, excluidoEm: null, time: "outro", timeDesde: null };
  e.numeros = [
    { id: "esc", nome: "Escola", finalidade: "escola", usuarioId: null, situacao: "desconectado", ultimoSinalEm: agora(), ...base },
    { id: "va", nome: "Ana", finalidade: "vendedor", usuarioId: "u1", situacao: "desconectado", ultimoSinalEm: agora(), ...base },
    { id: "vb", nome: "Beto", finalidade: "vendedor", usuarioId: "u2", situacao: "desconectado", ultimoSinalEm: agora(), ...base },
  ];
});

describe("alterarTimeNumero", () => {
  it("grava time, timeDesde e auditoria", async () => {
    const antes = Date.now();
    await alterarTimeNumero(gestor, "va", "cs");
    const n = banco.estado.numeros[1]!;
    expect(n.time).toBe("cs");
    expect(n.timeDesde.getTime()).toBeGreaterThanOrEqual(antes);
    expect(banco.estado.auditorias).toHaveLength(1);
    expect(banco.estado.auditorias[0]).toMatchObject({
      acao: "whatsapp.time_alterado",
      entidadeId: "va",
      diff: { de: "outro", para: "cs" },
    });
  });

  it("mesmo time não grava nem audita", async () => {
    await alterarTimeNumero(gestor, "va", "outro");
    expect(banco.estado.numeros[1]!.timeDesde).toBeNull();
    expect(banco.estado.chamadas).not.toContain("numero.update");
    expect(banco.estado.auditorias).toHaveLength(0);
  });

  it("comercial não altera (ErroPermissao)", async () => {
    await expect(alterarTimeNumero(ana, "va", "cs")).rejects.toBeInstanceOf(ErroPermissao);
    expect(banco.estado.numeros[1]!.time).toBe("outro");
  });

  it("número excluído lança Número não encontrado", async () => {
    banco.estado.numeros[1]!.excluidoEm = new Date();
    await expect(alterarTimeNumero(gestor, "va", "cs")).rejects.toThrow("Número não encontrado.");
  });
});

describe("solicitarConexao", () => {
  it("comercial dono conecta a própria vaga", async () => {
    await solicitarConexao(ana, "va");
    expect(banco.estado.comandos).toHaveLength(1);
    expect(banco.estado.numeros[1]!.situacao).toBe("aguardando_qr");
    expect(banco.estado.auditorias[0]!.acao).toBe("whatsapp.conexao_solicitada");
  });

  it("comercial que não é dono recebe ErroPermissao", async () => {
    await expect(solicitarConexao(beto, "va")).rejects.toBeInstanceOf(ErroPermissao);
    expect(banco.estado.comandos).toHaveLength(0);
  });

  it("dois pedidos seguidos deixam um comando pendente", async () => {
    await solicitarConexao(ana, "va");
    await solicitarConexao(ana, "va");
    expect(banco.estado.comandos.filter((c) => c.tipo === "conectar" && c.situacao === "pendente")).toHaveLength(1);
  });

  it("segundo clique com o pedido na fila mantém o QR já gravado pelo motor", async () => {
    await solicitarConexao(ana, "va");
    Object.assign(banco.estado.numeros[1]!, { qrAtual: "QR", qrEm: agora() });
    await solicitarConexao(ana, "va");
    expect(banco.estado.numeros[1]!.qrAtual).toBe("QR");
    expect(banco.estado.auditorias).toHaveLength(1);
  });

  it("trava a vaga antes de checar se já há comando na fila", async () => {
    await solicitarConexao(ana, "va");
    expect(banco.estado.chamadas.slice(0, 2)).toEqual(["numero.update", "comando.findFirst"]);
  });

  it("limpa QR e erro anteriores", async () => {
    Object.assign(banco.estado.numeros[1]!, { qrAtual: "velho", qrEm: agora(), erro: "x" });
    await solicitarConexao(gestor, "va");
    expect(banco.estado.numeros[1]).toMatchObject({ qrAtual: null, qrEm: null, erro: null });
  });

  it("vaga excluída não é encontrada", async () => {
    banco.estado.numeros[1]!.excluidoEm = agora();
    await expect(solicitarConexao(gestor, "va")).rejects.toThrow("Número não encontrado.");
  });
});

describe("solicitarDesconexao", () => {
  it("cria um só comando desconectar e audita", async () => {
    await solicitarDesconexao(ana, "va");
    await solicitarDesconexao(ana, "va");
    expect(banco.estado.comandos.filter((c) => c.tipo === "desconectar")).toHaveLength(1);
    expect(banco.estado.auditorias[0]!.acao).toBe("whatsapp.desconexao_solicitada");
  });
});

describe("excluirNumero", () => {
  it("recusa vaga conectada", async () => {
    banco.estado.numeros[0]!.situacao = "conectado";
    await expect(excluirNumero(gestor, "esc")).rejects.toThrow("Desconecte o número antes de excluir.");
    expect(banco.estado.numeros[0]!.excluidoEm).toBeNull();
  });

  it("exclui vaga desconectada, audita e pede ao motor para encerrar a sessão", async () => {
    await excluirNumero(gestor, "esc");
    expect(banco.estado.numeros[0]!.excluidoEm).toBeInstanceOf(Date);
    expect(banco.estado.auditorias[0]!.acao).toBe("whatsapp.numero_excluido");
    expect(banco.estado.comandos).toMatchObject([{ numeroId: "esc", tipo: "desconectar", situacao: "pendente" }]);
  });

  it("exclui vaga presa aguardando QR ou em erro", async () => {
    banco.estado.numeros[0]!.situacao = "aguardando_qr";
    banco.estado.numeros[1]!.situacao = "erro";
    await excluirNumero(gestor, "esc");
    await excluirNumero(gestor, "va");
    expect(banco.estado.numeros[0]!.excluidoEm).toBeInstanceOf(Date);
    expect(banco.estado.numeros[1]!.excluidoEm).toBeInstanceOf(Date);
  });

  it("comercial não exclui", async () => {
    await expect(excluirNumero(ana, "va")).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe("listarNumeros", () => {
  it("comercial só vê as suas vagas", async () => {
    const lista = await listarNumeros(ana);
    expect(lista.map((n) => n.id)).toEqual(["va"]);
    expect(lista[0]!.dono).toBe("Aninha");
  });

  it("linha em erro traz o detalhe", async () => {
    Object.assign(banco.estado.numeros[1]!, { situacao: "erro", erro: "Sessão aberta em outro lugar." });
    const lista = await listarNumeros(ana);
    expect(lista[0]).toMatchObject({ estado: "erro", detalhe: "Sessão aberta em outro lugar." });
  });

  it("gestão vê todas, com dono pelo nome quando não há apelido", async () => {
    const lista = await listarNumeros(gestor);
    expect(lista.map((n) => [n.id, n.dono])).toEqual([["esc", null], ["va", "Aninha"], ["vb", "Beto"]]);
  });
});

describe("criarNumero", () => {
  it("gestão cria vaga da escola e audita só nome e finalidade", async () => {
    const { id } = await criarNumero(gestor, { nome: "Nova", finalidade: "escola" });
    expect(banco.estado.numeros.some((n) => n.id === id)).toBe(true);
    expect(banco.estado.auditorias[0]).toMatchObject({
      acao: "whatsapp.numero_criado",
      diff: { nome: "Nova", finalidade: "escola" },
    });
  });

  it("vendedor exige usuário comercial ativo", async () => {
    await expect(criarNumero(gestor, { nome: "X", finalidade: "vendedor", usuarioId: "u3" })).rejects.toThrow(
      "Escolha o vendedor dono do número.",
    );
    await expect(criarNumero(gestor, { nome: "X", finalidade: "vendedor", usuarioId: "u4" })).rejects.toThrow(
      "Escolha o vendedor dono do número.",
    );
    await expect(criarNumero(gestor, { nome: "X", finalidade: "vendedor", usuarioId: "u1" })).resolves.toHaveProperty("id");
  });

  it("comercial não cria", async () => {
    await expect(criarNumero(ana, { nome: "X", finalidade: "escola" })).rejects.toBeInstanceOf(ErroPermissao);
  });
});

describe("situacaoParaTela", () => {
  it("devolve o QR enquanto aguarda leitura", async () => {
    Object.assign(banco.estado.numeros[1]!, { situacao: "aguardando_qr", qrAtual: "QR", qrEm: agora() });
    const r = await situacaoParaTela(ana, "va");
    expect(r).toMatchObject({ estado: "aguardando_qr", qr: "QR" });
  });

  it("em erro devolve o detalhe gravado pelo motor", async () => {
    Object.assign(banco.estado.numeros[1]!, { situacao: "erro", erro: "Acesso recusado pelo WhatsApp." });
    const r = await situacaoParaTela(ana, "va");
    expect(r).toMatchObject({ estado: "erro", detalhe: "Acesso recusado pelo WhatsApp.", qr: null });
  });

  it("fora do estado de erro não devolve detalhe", async () => {
    Object.assign(banco.estado.numeros[1]!, { situacao: "desconectado", erro: "removido_no_celular" });
    const r = await situacaoParaTela(ana, "va");
    expect(r).toMatchObject({ estado: "removido_no_celular", detalhe: null });
  });

  it("não devolve o QR quando ele expirou", async () => {
    Object.assign(banco.estado.numeros[1]!, {
      situacao: "aguardando_qr",
      qrAtual: "QR",
      qrEm: new Date(Date.now() - 120_000),
    });
    const r = await situacaoParaTela(ana, "va");
    expect(r.estado).toBe("qr_expirado");
    expect(r.qr).toBeNull();
  });
});
