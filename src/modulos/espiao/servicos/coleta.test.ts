import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroMeta } from "@/lib/meta-graph";
import type { MidiaBD, PerfilBD } from "../fontes/instagram";
import { criarRepositorioMemoria } from "./__testes__/repositorio-memoria";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const { iniciarColeta, executarColeta } = await import("./coleta");
type Deps = Parameters<typeof executarColeta>[2];

const DIA = 86_400_000;
let agora = new Date("2026-11-18T07:00:00Z");
const diasAtras = (d: number) => new Date(agora.getTime() - d * DIA);

function midia(id: string, dias: number, visualizacoes: number, tipo: MidiaBD["tipo"] = "reels"): MidiaBD {
  return { idExterno: id, tipo, legenda: `leg ${id}`, permalink: `https://ig/${id}`, publicadoEm: diasAtras(dias), curtidas: 10, comentarios: 1, visualizacoes, mediaUrl: `https://a.cdninstagram.com/${id}.mp4` };
}
const base = () => [midia("b1", 20, 1000), midia("b2", 21, 1000), midia("b3", 22, 1000), midia("b4", 23, 1000), midia("b5", 24, 1000)];
const perfil = (midias: MidiaBD[], seguidores = 1000): PerfilBD => ({ usuario: "x", nome: "X", biografia: "bio", site: null, seguidores, totalPosts: 50, midias });

function criarDeps(o: { perfis?: Record<string, () => PerfilBD>; pode?: () => boolean } = {}) {
  const chamadas = { perfil: [] as string[], transcrever: 0, resumir: 0, analise: 0, gastos: 0 };
  const deps: Deps = {
    agora: () => agora,
    igUserId: async () => "178",
    businessDiscovery: () => ({
      perfil: async (_ig: string, usuario: string) => {
        chamadas.perfil.push(usuario);
        const f = o.perfis?.[usuario];
        if (!f) throw new ErroMeta("Perfil não encontrado ou não é uma conta profissional (Business ou Criador de conteúdo).", 110);
        return f();
      },
    }),
    lerPagina: async () => ({ urlFinal: "u", texto: "t".repeat(400), legivel: true, precos: [] }),
    groq: () => ({
      transcrever: async () => {
        chamadas.transcrever++;
        return { texto: "transcrição", segundos: 30 };
      },
    }),
    baixarVideo: async () => new Blob(["v"]),
    podeGastar: async () => ({ ok: o.pode ? o.pode() : true }),
    resumirReels: async () => {
      chamadas.resumir++;
      return "resumo";
    },
    tituloDaMudanca: async () => "mudou a garantia",
    escreverAnalise: async () => {
      chamadas.analise++;
      return "## O que mudou";
    },
    registrarGastoExterno: async () => {
      chamadas.gastos++;
    },
    transcricaoLigada: true,
  };
  return { deps, chamadas };
}

const tres = [
  { id: "c1", nome: "Um", instagram: "um" },
  { id: "c2", nome: "Dois", instagram: "dois" },
  { id: "c3", nome: "Três", instagram: "tres" },
];

beforeEach(() => {
  agora = new Date("2026-11-18T07:00:00Z");
});

describe("executarColeta", () => {
  it("erro num concorrente não para os outros e a coleta fica parcial, sem mensagem original", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: tres });
    const { deps } = criarDeps({ perfis: { um: () => perfil(base()), tres: () => perfil(base()) } });
    const c = await mem.repo.criarColeta("manual", agora);
    expect(await executarColeta(c.id, mem.repo, deps)).toBe("parcial");
    expect(mem.fotos.map((f) => f.concorrenteId).sort()).toEqual(["c1", "c3"]);
    const { erros } = await mem.repo.obterColeta(c.id);
    expect(erros).toEqual([{ concorrenteId: "c2", passo: "instagram", tipo: "ErroMeta" }]);
  });

  it("primeira coleta é só linha de base: nenhum sinal", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    const { deps } = criarDeps({ perfis: { um: () => perfil([...base(), midia("c", 2, 9000)]) } });
    const c = await mem.repo.criarColeta("manual", agora);
    expect(await executarColeta(c.id, mem.repo, deps)).toBe("concluida");
    expect(mem.sinais).toEqual([]);
  });

  it("segunda coleta acha o Reels 4× a média uma vez só", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    const { deps } = criarDeps({ perfis: { um: () => perfil(base()) } });
    await executarColeta((await mem.repo.criarColeta("agendada", agora)).id, mem.repo, deps);
    agora = new Date(agora.getTime() + 7 * DIA);
    const com = criarDeps({ perfis: { um: () => perfil([...base(), midia("novo", 1, 4000)]) } });
    await executarColeta((await mem.repo.criarColeta("agendada", agora)).id, mem.repo, com.deps);
    expect(mem.sinais.filter((s) => s.tipo === "conteudo_destaque").map((s) => s.chave)).toEqual(["conteudo_destaque:novo"]);
    agora = new Date(agora.getTime() + 7 * DIA);
    await executarColeta((await mem.repo.criarColeta("agendada", agora)).id, mem.repo, com.deps);
    expect(mem.sinais.filter((s) => s.tipo === "conteudo_destaque")).toHaveLength(1);
    expect(mem.relatorios.size).toBe(3);
  });

  it("salto de seguidores e ritmo não se repetem em outra coleta da mesma semana", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    agora = new Date("2026-11-09T07:00:00Z");
    await executarColeta((await mem.repo.criarColeta("agendada", agora)).id, mem.repo, criarDeps({ perfis: { um: () => perfil(base(), 1000) } }).deps);
    const subiu = criarDeps({ perfis: { um: () => perfil(base(), 1100) } }).deps;
    agora = new Date("2026-11-16T07:00:00Z");
    await executarColeta((await mem.repo.criarColeta("agendada", agora)).id, mem.repo, subiu);
    agora = new Date("2026-11-18T10:00:00Z");
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, subiu);
    expect(mem.sinais.filter((s) => s.tipo === "seguidores_salto")).toHaveLength(1);
  });

  it("Reels novo é transcrito, resumido e gera gasto do Groq", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    const { deps, chamadas } = criarDeps({ perfis: { um: () => perfil([midia("r1", 1, 10)]) } });
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps);
    expect(mem.midias[0]).toMatchObject({ situacaoTranscricao: "feita", transcricao: "transcrição", resumo: "resumo" });
    expect(chamadas.gastos).toBe(1);
  });

  it("vídeo grande demais fica longa_demais sem chamar o Groq", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    const { deps, chamadas } = criarDeps({ perfis: { um: () => perfil([midia("r1", 1, 10)]) } });
    deps.baixarVideo = async () => "grande_demais";
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps);
    expect(mem.midias[0].situacaoTranscricao).toBe("longa_demais");
    expect(chamadas.transcrever).toBe(0);
  });

  it("sem saldo depois da 1ª transcrição: a 2ª não é pedida e a coleta fica sem_saldo", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [tres[0]] });
    let usos = 0;
    const { deps, chamadas } = criarDeps({ perfis: { um: () => perfil([midia("r1", 1, 10), midia("r2", 2, 10)]) }, pode: () => usos++ < 1 });
    expect(await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps)).toBe("sem_saldo");
    expect(chamadas.transcrever).toBe(1);
    expect(chamadas.analise).toBe(0);
  });

  it("retoma do ponto em que parou, sem repetir concorrente, sinal nem gasto", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: tres.slice(0, 2) });
    const { deps } = criarDeps({ perfis: { um: () => perfil([midia("r1", 1, 10)]), dois: () => perfil([midia("r2", 1, 10)]) } });
    const c = await mem.repo.criarColeta("agendada", agora);
    // Simula uma queda depois do 1º concorrente inteiro.
    await executarColeta(c.id, mem.repo, { ...deps, businessDiscovery: () => ({ perfil: async (ig, u) => (u === "um" ? perfil([midia("r1", 1, 10)]) : Promise.reject(new Error("queda"))) }) }).catch(() => undefined);
    const antes = await mem.repo.obterColeta(c.id);
    antes.passos.concorrentes.c2 = {};
    antes.erros = [];
    await mem.repo.salvarProgresso(c.id, antes, new Date(agora.getTime() - 3 * 3_600_000));
    mem.coletas[0].status = "rodando";
    const retomada = criarDeps({ perfis: { um: () => perfil([midia("r1", 1, 10)]), dois: () => perfil([midia("r2", 1, 10)]) } });
    const r = await iniciarColeta({ origem: "agendada", usuarioId: null, repo: mem.repo, deps: retomada.deps });
    expect(r).toMatchObject({ coletaId: c.id, iniciou: true });
    expect(await r.execucao).toBe("concluida");
    expect(retomada.chamadas.perfil).toEqual(["dois"]);
    expect(mem.midias.filter((m) => m.idExterno === "r1")).toHaveLength(1);
    expect(retomada.chamadas.gastos).toBe(1);
  });

  it("página sem mudança de texto não cria versão nova", async () => {
    const pagina = { id: "p1", concorrenteId: "c1", url: "https://x.com/pos", rotulo: "Pós", legivel: false, ultimoHash: null, ultimaCapturaEm: null };
    const mem = criarRepositorioMemoria({ concorrentes: [{ id: "c1", nome: "Um", instagram: null }], paginas: [pagina] });
    const { deps } = criarDeps();
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps);
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps);
    expect(mem.versoes).toHaveLength(1);
    expect(mem.sinais).toEqual([]);
  });
});

describe("páginas entre coletas", () => {
  const pagina = () => ({ id: "p1", concorrenteId: "c1", url: "https://x.com/pos", rotulo: "Pós", legivel: false, ultimoHash: null, ultimaCapturaEm: null });
  const texto = (preco: string) => `${"Conteúdo completo da pós em dermatologia. ".repeat(12)} Por ${preco}.`;
  async function rodar(mem: ReturnType<typeof criarRepositorioMemoria>, lida: { texto: string; legivel: boolean; precos: string[] }) {
    const { deps } = criarDeps();
    deps.lerPagina = async () => ({ urlFinal: "u", ...lida });
    await executarColeta((await mem.repo.criarColeta("manual", agora)).id, mem.repo, deps);
    agora = new Date(agora.getTime() + 7 * DIA);
  }

  it("página que ficou ilegível uma semana e voltou igual não vira pagina_nova", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [{ id: "c1", nome: "Um", instagram: null }], paginas: [pagina()] });
    await rodar(mem, { texto: texto("R$ 10"), legivel: true, precos: ["R$ 10,00"] });
    await rodar(mem, { texto: "verificando…", legivel: false, precos: [] });
    await rodar(mem, { texto: texto("R$ 10"), legivel: true, precos: ["R$ 10,00"] });
    expect(mem.sinais).toEqual([]);
  });

  it("preço que vai e volta gera um sinal a cada mudança", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: [{ id: "c1", nome: "Um", instagram: null }], paginas: [pagina()] });
    for (const p of ["R$ 10", "R$ 8", "R$ 10", "R$ 8"]) await rodar(mem, { texto: texto(p), legivel: true, precos: [`${p},00`] });
    expect(mem.sinais.filter((s) => s.tipo === "preco_mudou")).toHaveLength(3);
  });
});

describe("iniciarColeta", () => {
  it("coleta rodando há 1 h: em andamento, nada roda", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: tres });
    await mem.repo.criarColeta("manual", new Date(agora.getTime() - 3_600_000));
    const { deps, chamadas } = criarDeps();
    expect(await iniciarColeta({ origem: "agendada", usuarioId: null, repo: mem.repo, deps })).toMatchObject({ iniciou: false, motivo: "em_andamento" });
    expect(chamadas.perfil).toEqual([]);
  });

  it("agendada com a última concluída há 5 dias: recente", async () => {
    const mem = criarRepositorioMemoria({ concorrentes: tres });
    const c = await mem.repo.criarColeta("agendada", diasAtras(5));
    await mem.repo.finalizarColeta(c.id, "concluida", diasAtras(5));
    const { deps } = criarDeps();
    expect(await iniciarColeta({ origem: "agendada", usuarioId: null, repo: mem.repo, deps })).toMatchObject({ iniciou: false, motivo: "recente" });
  });

  it("manual ignora a coleta recente; sem concorrentes não inicia", async () => {
    const vazio = criarRepositorioMemoria({ concorrentes: [] });
    const { deps } = criarDeps();
    expect(await iniciarColeta({ origem: "manual", usuarioId: "u1", repo: vazio.repo, deps })).toMatchObject({ iniciou: false, motivo: "sem_concorrentes" });
  });
});
