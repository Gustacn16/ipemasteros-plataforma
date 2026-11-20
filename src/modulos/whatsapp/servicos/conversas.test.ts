import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Banco em memória só com o que o serviço de conversas usa.
const banco = vi.hoisted(() => {
  const estado = {
    numeros: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    conversas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    nosGrupo: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    mensagens: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    contatos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    turmas: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    resumos: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    auditorias: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    avaliacoes: [] as Record<string, any>[], // eslint-disable-line @typescript-eslint/no-explicit-any
    consultasAvaliacoes: 0,
  };
  const prisma = {
    conversaWhatsapp: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.conversas
          .filter(
            (c) =>
              c.tipo === where.tipo &&
              (where.numeroId === undefined || c.numeroId === where.numeroId) &&
              (where.categoria === undefined || c.categoria === where.categoria) &&
              (where.numero === undefined ||
                estado.numeros.find((n) => n.id === c.numeroId)?.usuarioId === where.numero.usuarioId),
          )
          .map((c) => ({
            ...c,
            numero: estado.numeros.find((n) => n.id === c.numeroId) ?? null,
            contato: estado.contatos.find((k) => k.id === c.contatoId) ?? null,
            turma: estado.turmas.find((t) => t.id === c.turmaId) ?? null,
            nosGrupo: estado.nosGrupo
              .filter((g) => g.conversaId === c.id)
              .map((g) => ({ numero: estado.numeros.find((n) => n.id === g.numeroId) })),
          })),
      findUnique: async ({ where }: { where: { id: string } }) => {
        const c = estado.conversas.find((x) => x.id === where.id);
        return c ? { ...c, numero: estado.numeros.find((n) => n.id === c.numeroId) ?? null } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Linha }) =>
        Object.assign(estado.conversas.find((c) => c.id === where.id)!, data),
    },
    mensagemWhatsapp: {
      deleteMany: async ({ where }: { where: { conversaId: string } }) => {
        const antes = estado.mensagens.length;
        estado.mensagens = estado.mensagens.filter((m) => m.conversaId !== where.conversaId);
        return { count: antes - estado.mensagens.length };
      },
      groupBy: async ({ where }: { where: { conversaId: { in: string[] }; enviadaEm: { gte: Date } } }) => {
        const contagem = new Map<string, number>();
        for (const m of estado.mensagens) {
          if (where.conversaId.in.includes(m.conversaId) && m.enviadaEm >= where.enviadaEm.gte) {
            contagem.set(m.conversaId, (contagem.get(m.conversaId) ?? 0) + 1);
          }
        }
        return [...contagem].map(([conversaId, n]) => ({ conversaId, _count: { _all: n } }));
      },
      findMany: async ({ where, take }: { where: { conversaId: string }; take: number }) =>
        estado.mensagens
          .filter((m) => m.conversaId === where.conversaId)
          .sort((a, b) => b.enviadaEm.getTime() - a.enviadaEm.getTime())
          .slice(0, take)
          .map((m) => ({ ...m, contato: estado.contatos.find((k) => k.id === m.contatoId) ?? null })),
    },
    resumoGrupo: {
      findMany: async ({ where }: { where: Linha }) =>
        estado.resumos.filter(
          (r) => where.conversaId.in.includes(r.conversaId) && r.dia.getTime() === where.dia.getTime() && r.situacao === where.situacao,
        ),
      findUnique: async ({ where }: { where: { conversaId_dia: { conversaId: string; dia: Date } } }) =>
        estado.resumos.find(
          (r) => r.conversaId === where.conversaId_dia.conversaId && r.dia.getTime() === where.conversaId_dia.dia.getTime(),
        ) ?? null,
    },
    avaliacaoConversa: {
      deleteMany: async ({ where }: { where: { conversaId: string } }) => {
        const antes = estado.avaliacoes.length;
        estado.avaliacoes = estado.avaliacoes.filter((a) => a.conversaId !== where.conversaId);
        return { count: antes - estado.avaliacoes.length };
      },
      findFirst: async ({ where }: { where: Linha }) => {
        estado.consultasAvaliacoes++;
        const achadas = estado.avaliacoes
          .filter((a) => a.conversaId === where.conversaId && a.situacao === where.situacao)
          .sort((a, b) => b.dia.getTime() - a.dia.getTime());
        return achadas[0] ? { ...achadas[0], conversa: { nome: null, contato: null }, numero: { nome: "Ana" }, venda: null } : null;
      },
    },
    turma: {
      findUnique: async ({ where }: { where: { id: string } }) => estado.turmas.find((t) => t.id === where.id) ?? null,
      findMany: async () => estado.turmas,
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

const {
  definirCategoria,
  definirMonitoramento,
  ligarTurma,
  listarConversas,
  listarGrupos,
  mensagensDaConversa,
  nomeDoAutor,
  ultimaAvaliacao,
  resumoDoGrupo,
} = await import("./conversas");

const gestor = { id: "g1", papel: "gestor" } as UsuarioAtual;
const ana = { id: "u1", papel: "comercial" } as UsuarioAtual;
const colaborador = { id: "c1", papel: "colaborador" } as UsuarioAtual;

const dias = (n: number) => new Date(Date.now() - n * 86_400_000);

beforeEach(() => {
  const e = banco.estado;
  e.numeros = [
    { id: "n1", nome: "Escola", usuarioId: null },
    { id: "n2", nome: "Ana", usuarioId: "u1" },
    { id: "n3", nome: "Beto", usuarioId: "u2" },
  ];
  e.contatos = [
    { id: "k1", nomeExibido: "Maria Souza", telefone: "5562981707432" },
    { id: "k2", nomeExibido: null, telefone: "5562981707432" },
    { id: "k3", nomeExibido: null, telefone: null },
  ];
  e.turmas = [{ id: "t1", nome: "Turma A" }];
  e.conversas = [
    {
      id: "g1", tipo: "grupo", numeroId: null, nome: "Grupo da turma", contatoId: null, turmaId: null, categoria: "outro",
      monitorada: false, provisoriaAte: dias(-1), ultimaMensagemEm: dias(1),
    },
    { id: "i1", tipo: "individual", numeroId: "n2", nome: null, contatoId: "k1", turmaId: null, categoria: "lead", monitorada: false, provisoriaAte: null, ultimaMensagemEm: dias(1) },
    { id: "i2", tipo: "individual", numeroId: "n3", nome: null, contatoId: "k1", turmaId: null, categoria: "lead", monitorada: false, provisoriaAte: null, ultimaMensagemEm: dias(2) },
    { id: "i3", tipo: "individual", numeroId: "n1", nome: null, contatoId: "k1", turmaId: null, categoria: "aluno", monitorada: false, provisoriaAte: null, ultimaMensagemEm: dias(3) },
  ];
  e.nosGrupo = [{ numeroId: "n1", conversaId: "g1" }, { numeroId: "n2", conversaId: "g1" }];
  e.mensagens = [
    { id: "m1", conversaId: "g1", contatoId: "k1", deMim: false, tipo: "texto", texto: "oi", enviadaEm: dias(1) },
    { id: "m2", conversaId: "g1", contatoId: "k1", deMim: false, tipo: "texto", texto: "velha", enviadaEm: dias(20) },
    { id: "m3", conversaId: "i1", contatoId: "k1", deMim: false, tipo: "texto", texto: "olá", enviadaEm: dias(1) },
    { id: "m4", conversaId: "i2", contatoId: "k1", deMim: true, tipo: "audio", texto: null, enviadaEm: dias(1) },
  ];
  e.resumos = [];
  e.auditorias = [];
});

describe("grupos", () => {
  it("comercial e colaborador não veem grupos", async () => {
    await expect(listarGrupos(ana)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(listarGrupos(colaborador)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(definirMonitoramento(ana, "g1", true)).rejects.toBeInstanceOf(ErroPermissao);
    await expect(ligarTurma(ana, "g1", "t1")).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("lista com números da empresa e mensagens dos últimos 7 dias", async () => {
    const [g] = await listarGrupos(gestor);
    expect(g.nome).toBe("Grupo da turma");
    expect(g.numeros.sort()).toEqual(["Ana", "Escola"]);
    expect(g.totalMensagens7d).toBe(1);
  });

  it("marcar limpa provisoriaAte e audita", async () => {
    await definirMonitoramento(gestor, "g1", true);
    const g = banco.estado.conversas[0];
    expect(g.monitorada).toBe(true);
    expect(g.provisoriaAte).toBeNull();
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "g1")).toHaveLength(2);
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.grupo_monitorado", entidadeId: "g1" });
  });

  it("desmarcar apaga as mensagens do grupo", async () => {
    await definirMonitoramento(gestor, "g1", true);
    await definirMonitoramento(gestor, "g1", false);
    expect(banco.estado.conversas[0].monitorada).toBe(false);
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "g1")).toHaveLength(0);
    expect(banco.estado.mensagens).toHaveLength(2);
  });

  it("liga e desliga turma; turma inexistente falha", async () => {
    await ligarTurma(gestor, "g1", "t1");
    expect(banco.estado.conversas[0].turmaId).toBe("t1");
    await ligarTurma(gestor, "g1", null);
    expect(banco.estado.conversas[0].turmaId).toBeNull();
    await expect(ligarTurma(gestor, "g1", "nao-existe")).rejects.toThrow();
  });
});

describe("conversas", () => {
  it("gestão vê todas as individuais; comercial só as dos próprios números", async () => {
    expect((await listarConversas(gestor, {})).map((c) => c.id).sort()).toEqual(["i1", "i2", "i3"]);
    expect((await listarConversas(ana, {})).map((c) => c.id)).toEqual(["i1"]);
    await expect(listarConversas(colaborador, {})).rejects.toBeInstanceOf(ErroPermissao);
  });

  it("filtra por número e categoria", async () => {
    expect((await listarConversas(gestor, { numeroId: "n3" })).map((c) => c.id)).toEqual(["i2"]);
    expect((await listarConversas(gestor, { categoria: "aluno" })).map((c) => c.id)).toEqual(["i3"]);
  });

  it("marcar como pessoal apaga as mensagens na hora e audita", async () => {
    await definirCategoria(gestor, "i1", "pessoal");
    expect(banco.estado.conversas.find((c) => c.id === "i1")!.categoria).toBe("pessoal");
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "i1")).toHaveLength(0);
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.categoria_alterada", entidadeId: "i1" });
  });

  it("marcar como pessoal apaga as avaliações; outra categoria não", async () => {
    banco.estado.avaliacoes = [{ conversaId: "i1", dia: dias(1), situacao: "ok" }];
    await definirCategoria(gestor, "i1", "aluno");
    expect(banco.estado.avaliacoes).toHaveLength(1);
    await definirCategoria(gestor, "i1", "pessoal");
    expect(banco.estado.avaliacoes).toHaveLength(0);
  });

  it("outra categoria mantém as mensagens", async () => {
    await definirCategoria(gestor, "i1", "aluno");
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "i1")).toHaveLength(1);
  });

  it("comercial não muda categoria de conversa de outro número", async () => {
    await expect(definirCategoria(ana, "i2", "pessoal")).rejects.toBeInstanceOf(ErroPermissao);
    expect(banco.estado.mensagens.filter((m) => m.conversaId === "i2")).toHaveLength(1);
  });

  it("categoria não se aplica a grupo", async () => {
    await expect(definirCategoria(gestor, "g1", "pessoal")).rejects.toThrow();
  });
});

describe("mensagens da conversa", () => {
  it("gestor abrindo conversa de número de outro dono grava auditoria sem texto", async () => {
    const { mensagens: msgs } = await mensagensDaConversa(gestor, "i1");
    expect(msgs).toHaveLength(1);
    expect(banco.estado.auditorias).toHaveLength(1);
    expect(banco.estado.auditorias[0]).toMatchObject({ acao: "whatsapp.conversa_aberta", entidadeId: "i1" });
    expect(JSON.stringify(banco.estado.auditorias[0])).not.toContain("olá");
  });

  it("dono abrindo a própria conversa não grava auditoria", async () => {
    await mensagensDaConversa(ana, "i1");
    expect(banco.estado.auditorias).toHaveLength(0);
  });

  it("comercial não abre conversa de outro número nem grupo", async () => {
    await expect(mensagensDaConversa(ana, "i2")).rejects.toBeInstanceOf(ErroPermissao);
    await expect(mensagensDaConversa(ana, "g1")).rejects.toBeInstanceOf(ErroPermissao);
    expect(banco.estado.auditorias).toHaveLength(0);
  });

  it("grupo aberto pela gestão não audita", async () => {
    await mensagensDaConversa(gestor, "g1");
    expect(banco.estado.auditorias).toHaveLength(0);
  });

  it("mostra [áudio], Você nas minhas e o autor pelo nome, em ordem cronológica", async () => {
    const { mensagens: msgs } = await mensagensDaConversa(gestor, "i2");
    expect(msgs[0]).toMatchObject({ autor: "Você", deMim: true, tipo: "audio", texto: "[áudio]" });
    expect((await mensagensDaConversa(gestor, "i1")).mensagens[0].autor).toBe("Maria Souza");
    const grupo = await mensagensDaConversa(gestor, "g1");
    expect(grupo.mensagens.map((m) => m.texto)).toEqual(["velha", "oi"]);
  });

  it("devolve o tipo da conversa (a tela volta para grupos ou conversas)", async () => {
    expect((await mensagensDaConversa(gestor, "g1")).tipo).toBe("grupo");
    expect((await mensagensDaConversa(gestor, "i1")).tipo).toBe("individual");
  });
});

describe("nome do autor", () => {
  it("usa o nome, depois os 4 últimos dígitos, depois o texto padrão", () => {
    expect(nomeDoAutor({ nomeExibido: "Maria", telefone: "5562981707432" })).toBe("Maria");
    expect(nomeDoAutor({ nomeExibido: null, telefone: "5562981707432" })).toBe("…7432");
    expect(nomeDoAutor({ nomeExibido: null, telefone: null })).toBe("Contato sem nome");
    expect(nomeDoAutor(null)).toBe("Contato sem nome");
  });

  it("nunca devolve o telefone completo", async () => {
    const { mensagens: msgs } = await mensagensDaConversa(gestor, "i1");
    banco.estado.contatos[0].nomeExibido = null;
    const { mensagens: semNome } = await mensagensDaConversa(gestor, "i1");
    expect(msgs.length).toBe(1);
    expect(semNome[0].autor).toBe("…7432");
    expect(JSON.stringify(semNome)).not.toContain("5562981707432");
  });
});

describe("resumo do grupo", () => {
  const ontem = new Date("2026-11-17T00:00:00.000Z");
  const base = { conversaId: "g1", dia: ontem, erro: null, resumo: null, temas: null, pendencias: null, destaques: null, participacao: [], totalMensagens: 0 };

  it("resumoDoGrupo devolve pronto com pendências; falhou devolve situacao e erro", async () => {
    banco.estado.resumos = [
      {
        ...base,
        situacao: "pronto",
        resumo: "Falaram da prova.",
        temas: ["prova"],
        pendencias: [{ autor: "Maria", hora: "10:30", texto: "Quando é a prova?" }],
        destaques: ["Prova na sexta"],
        participacao: [{ autor: "Maria", mensagens: 3 }],
        totalMensagens: 7,
      },
    ];
    const pronto = await resumoDoGrupo("g1", ontem);
    expect(pronto).toMatchObject({
      situacao: "pronto",
      resumo: "Falaram da prova.",
      temas: ["prova"],
      pendencias: [{ autor: "Maria", hora: "10:30", texto: "Quando é a prova?" }],
      participacao: [{ autor: "Maria", mensagens: 3 }],
      totalMensagens: 7,
    });
    banco.estado.resumos = [{ ...base, situacao: "falhou", erro: "Falha ao gerar." }];
    expect(await resumoDoGrupo("g1", ontem)).toMatchObject({ situacao: "falhou", erro: "Falha ao gerar." });
    expect(await resumoDoGrupo("g1", new Date("2026-11-16T00:00:00.000Z"))).toBeNull();
  });

  it("listarGrupos traz pendenciasOntem do resumo pronto de ontem, null sem resumo", async () => {
    const agora = new Date("2026-11-18T15:00:00Z");
    banco.estado.resumos = [
      { ...base, situacao: "pronto", pendencias: [{ autor: "A", hora: "09:00", texto: "x" }, { autor: "B", hora: "10:00", texto: "y" }] },
    ];
    expect((await listarGrupos(gestor, agora))[0].pendenciasOntem).toBe(2);
    banco.estado.resumos = [{ ...base, situacao: "falhou" }];
    expect((await listarGrupos(gestor, agora))[0].pendenciasOntem).toBeNull();
    banco.estado.resumos = [{ ...base, dia: new Date("2026-11-16T00:00:00.000Z"), situacao: "pronto", pendencias: [] }];
    expect((await listarGrupos(gestor, agora))[0].pendenciasOntem).toBeNull();
  });
});

describe("última avaliação da conversa", () => {
  beforeEach(() => {
    banco.estado.consultasAvaliacoes = 0;
    banco.estado.avaliacoes = [
      { id: "a1", conversaId: "i1", situacao: "pronto", dia: new Date("2026-11-10T00:00:00Z"), time: "comercial", notaGeralDecimos: 40, criterios: [] },
      { id: "a2", conversaId: "i1", situacao: "pronto", dia: new Date("2026-11-12T00:00:00Z"), time: "comercial", notaGeralDecimos: 80, criterios: [] },
    ];
  });

  it("devolve a mais recente para a gestão", async () => {
    const item = await ultimaAvaliacao(gestor, "i1");
    expect(item?.avaliacaoId).toBe("a2");
    expect(item?.notaGeralDecimos).toBe(80);
  });

  it("devolve null sem consultar para quem não é gestão", async () => {
    expect(await ultimaAvaliacao(ana, "i1")).toBeNull();
    expect(banco.estado.consultasAvaliacoes).toBe(0);
  });

  it("devolve null quando não há avaliação pronta", async () => {
    expect(await ultimaAvaliacao(gestor, "i2")).toBeNull();
  });
});
