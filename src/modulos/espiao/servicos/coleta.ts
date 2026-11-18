import "server-only";
import { descreverErro } from "@/modulos/nexu/servicos/descrever-erro";
import type { ClienteBusinessDiscovery, MidiaBD, TipoMidiaBD } from "../fontes/instagram";
import type { ClienteGroq, baixarVideo as BaixarVideo } from "../fontes/groq";
import type { lerPagina as LerPagina } from "../fontes/pagina";
import { calcularIndicadores } from "../regras/indicadores";
import { type SinalNovo, type TipoSinal, sinalDeBio, sinalDeRitmo, sinalDeSeguidores, sinaisDeConteudo, sinaisDePagina } from "../regras/sinais";
import { hashTexto } from "../regras/texto";
import { custoGroqMicroUsd } from "../fontes/groq";
import type { escreverAnalise as EscreverAnalise, resumirReels as ResumirReels, tituloDaMudanca as TituloDaMudanca } from "./ia";
import type { registrarGastoExterno as RegistrarGasto } from "./gastos";

// ---------------------------------------------------------------- tipos

export type OrigemColeta = "agendada" | "manual";
export type StatusColeta = "rodando" | "concluida" | "parcial" | "falhou" | "sem_saldo";
export type SituacaoTranscricao = "pendente" | "feita" | "sem_video" | "longa_demais" | "falhou" | "nao_se_aplica";

type PassosConcorrente = { instagram?: true; paginas?: true; transcricoes?: true; resumos?: true; sinais?: true };
export type Passos = { concorrentes: Record<string, PassosConcorrente>; analise?: true };
export type ErroColeta = { concorrenteId: string; passo: string; tipo: string };
export type ColetaR = { id: string; origem: OrigemColeta; status: StatusColeta; iniciadaEm: Date; progressoEm: Date; passos: Passos; erros: ErroColeta[] };
export type FotoR = { coletaId: string | null; seguidores: number; totalPosts: number; biografia: string | null; site: string | null; capturadaEm: Date };
export type MidiaR = {
  id: string;
  idExterno: string;
  tipo: TipoMidiaBD;
  legenda: string | null;
  permalink: string;
  publicadoEm: Date;
  curtidas: number | null;
  comentarios: number | null;
  visualizacoes: number | null;
  transcricao: string | null;
  resumo: string | null;
  situacaoTranscricao: SituacaoTranscricao;
};
export type PaginaR = { id: string; url: string; rotulo: string; legivel: boolean; ultimoHash: string | null; ultimaCapturaEm: Date | null };
export type SinalComChave = SinalNovo & { chave: string };
export type SinalGravado = SinalComChave & { coletaId: string; concorrenteId: string };

/** Leituras e escritas da coleta (Prisma em `repositorio.ts`, memória nos testes). */
export type RepositorioEspiao = {
  coletaRodando(): Promise<ColetaR | null>;
  ultimaFinalizada(): Promise<{ iniciadaEm: Date } | null>;
  criarColeta(origem: OrigemColeta, agora: Date): Promise<ColetaR>;
  obterColeta(id: string): Promise<ColetaR>;
  salvarProgresso(id: string, d: { passos: Passos; erros: ErroColeta[] }, agora: Date): Promise<void>;
  finalizarColeta(id: string, status: StatusColeta, agora: Date): Promise<void>;
  concorrentesAtivos(): Promise<{ id: string; nome: string; instagram: string | null }[]>;
  /** Mais recente primeiro. */
  fotos(concorrenteId: string): Promise<FotoR[]>;
  salvarFoto(concorrenteId: string, coletaId: string, d: Omit<FotoR, "coletaId" | "capturadaEm">, agora: Date): Promise<void>;
  midias(concorrenteId: string): Promise<MidiaR[]>;
  salvarMidia(concorrenteId: string, m: MidiaBD, situacaoSeNova: SituacaoTranscricao, agora: Date): Promise<void>;
  atualizarMidia(id: string, d: Partial<Pick<MidiaR, "transcricao" | "resumo" | "situacaoTranscricao">>): Promise<void>;
  paginas(concorrenteId: string): Promise<PaginaR[]>;
  ultimaVersao(paginaId: string): Promise<{ texto: string; precos: string[] } | null>;
  salvarCaptura(paginaId: string, d: { legivel: boolean; hash: string; texto: string; precos: string[]; novaVersao: boolean }, agora: Date): Promise<void>;
  chavesExistentes(chaves: string[]): Promise<Set<string>>;
  criarSinais(coletaId: string, concorrenteId: string, sinais: SinalComChave[], agora: Date): Promise<void>;
  sinaisDaColeta(coletaId: string): Promise<{ concorrente: string; tipo: TipoSinal; titulo: string; detalhe: Record<string, unknown> }[]>;
  salvarRelatorio(coletaId: string, analise: string): Promise<void>;
};

export type DepsColeta = {
  agora: () => Date;
  igUserId: () => Promise<string>;
  businessDiscovery: () => Pick<ClienteBusinessDiscovery, "perfil">;
  lerPagina: typeof LerPagina;
  groq: () => Pick<ClienteGroq, "transcrever"> | null;
  baixarVideo: typeof BaixarVideo;
  podeGastar: () => Promise<{ ok: boolean }>;
  resumirReels: typeof ResumirReels;
  tituloDaMudanca: typeof TituloDaMudanca;
  escreverAnalise: typeof EscreverAnalise;
  registrarGastoExterno: typeof RegistrarGasto;
  transcricaoLigada: boolean;
};

const MIDIAS_POR_COLETA = 30;
const DIA_MS = 86_400_000;
const PARADA_MS = 2 * 3_600_000;
const INTERVALO_AGENDADA_MS = 6 * DIA_MS;

class SemSaldo extends Error {
  constructor() {
    super("sem saldo");
    this.name = "SemSaldo";
  }
}

// ---------------------------------------------------------------- início

/**
 * Cria (ou retoma) a coleta e roda em segundo plano, sem esperar.
 * Agendada só coleta se a última concluída/parcial tiver mais de 6 dias.
 * Uma coleta "rodando" parada há mais de 2 h é retomada do ponto em que parou.
 */
export async function iniciarColeta(o: {
  origem: OrigemColeta;
  usuarioId: string | null;
  repo?: RepositorioEspiao;
  deps?: DepsColeta;
}): Promise<{ coletaId: string | null; iniciou: boolean; motivo?: "em_andamento" | "recente" | "sem_concorrentes"; execucao?: Promise<StatusColeta> }> {
  const repo = o.repo ?? (await import("./repositorio")).repositorioPrisma;
  const deps = o.deps ?? (await import("./deps-padrao")).depsPadrao();
  const agora = deps.agora();

  const rodando = await repo.coletaRodando();
  if (rodando) {
    if (agora.getTime() - rodando.progressoEm.getTime() <= PARADA_MS) return { coletaId: rodando.id, iniciou: false, motivo: "em_andamento" };
    return { coletaId: rodando.id, iniciou: true, execucao: disparar(rodando.id, repo, deps) };
  }
  if (o.origem === "agendada") {
    const ultima = await repo.ultimaFinalizada();
    if (ultima && agora.getTime() - ultima.iniciadaEm.getTime() <= INTERVALO_AGENDADA_MS) return { coletaId: null, iniciou: false, motivo: "recente" };
  }
  if ((await repo.concorrentesAtivos()).length === 0) return { coletaId: null, iniciou: false, motivo: "sem_concorrentes" };
  const coleta = await repo.criarColeta(o.origem, agora);
  return { coletaId: coleta.id, iniciou: true, execucao: disparar(coleta.id, repo, deps) };
}

function disparar(coletaId: string, repo: RepositorioEspiao, deps: DepsColeta): Promise<StatusColeta> {
  const execucao = executarColeta(coletaId, repo, deps).catch(async (erro) => {
    console.error("[espiao] coleta falhou", { coletaId, erro: descreverErro(erro) });
    await repo.finalizarColeta(coletaId, "falhou", deps.agora()).catch(() => undefined);
    return "falhou" as const;
  });
  // Segundo plano: quem chamou não espera; o processo Node continua depois da resposta.
  void execucao;
  return execucao;
}

// ---------------------------------------------------------------- execução

/** Roda os passos que faltam da coleta, concorrente por concorrente, e depois a análise. */
export async function executarColeta(coletaId: string, repo: RepositorioEspiao, deps: DepsColeta): Promise<StatusColeta> {
  const coleta = await repo.obterColeta(coletaId);
  const estado = { passos: coleta.passos, erros: coleta.erros };
  const marcar = async (concorrenteId: string, passo: keyof PassosConcorrente) => {
    estado.passos.concorrentes[concorrenteId] = { ...estado.passos.concorrentes[concorrenteId], [passo]: true };
    await repo.salvarProgresso(coletaId, estado, deps.agora());
  };
  const exigirSaldo = async () => {
    if (!(await deps.podeGastar()).ok) throw new SemSaldo();
  };

  let igUserId: string | null = null;
  const urlsDeVideo = new Map<string, string>();

  try {
    for (const c of await repo.concorrentesAtivos()) {
      const feitos = estado.passos.concorrentes[c.id] ?? {};
      const fotosAntes = await repo.fotos(c.id);
      const ehLinhaDeBase = fotosAntes.filter((f) => f.coletaId !== coletaId).length === 0;

      const passo = async (nome: keyof PassosConcorrente, fn: () => Promise<void>) => {
        if (feitos[nome]) return;
        try {
          await fn();
        } catch (erro) {
          if (erro instanceof SemSaldo) throw erro;
          estado.erros.push({ concorrenteId: c.id, passo: nome, tipo: descreverErro(erro) });
        }
        await marcar(c.id, nome);
      };

      const perfilAoVivo = async () => {
        igUserId ??= await deps.igUserId();
        const perfil = await deps.businessDiscovery().perfil(igUserId, c.instagram!, MIDIAS_POR_COLETA);
        for (const m of perfil.midias) if (m.mediaUrl) urlsDeVideo.set(m.idExterno, m.mediaUrl);
        return perfil;
      };

      await passo("instagram", async () => {
        if (!c.instagram) return;
        const perfil = await perfilAoVivo();
        await repo.salvarFoto(c.id, coletaId, { seguidores: perfil.seguidores, totalPosts: perfil.totalPosts, biografia: perfil.biografia, site: perfil.site }, deps.agora());
        for (const m of perfil.midias) {
          const situacao: SituacaoTranscricao = m.tipo !== "reels" ? "nao_se_aplica" : !deps.transcricaoLigada || !m.mediaUrl ? "sem_video" : "pendente";
          await repo.salvarMidia(c.id, m, situacao, deps.agora());
        }
      });

      await passo("paginas", async () => {
        for (const p of await repo.paginas(c.id)) {
          try {
            await capturarPagina(coletaId, c.id, p, repo, deps, exigirSaldo);
          } catch (erro) {
            if (erro instanceof SemSaldo) throw erro;
            estado.erros.push({ concorrenteId: c.id, passo: "paginas", tipo: descreverErro(erro) });
          }
        }
      });

      await passo("transcricoes", async () => {
        const pendentes = (await repo.midias(c.id)).filter((m) => m.situacaoTranscricao === "pendente");
        if (pendentes.length === 0) return;
        const groq = deps.groq();
        if (!groq) return; // sem chave: ficam pendentes para a próxima coleta
        if (c.instagram && pendentes.some((m) => !urlsDeVideo.has(m.idExterno))) await perfilAoVivo().catch(() => undefined);
        for (const m of pendentes) {
          const url = urlsDeVideo.get(m.idExterno);
          if (!url) {
            await repo.atualizarMidia(m.id, { situacaoTranscricao: "sem_video" });
            continue;
          }
          await exigirSaldo();
          try {
            const video = await deps.baixarVideo(url);
            if (video === "grande_demais") {
              await repo.atualizarMidia(m.id, { situacaoTranscricao: "longa_demais" });
              continue;
            }
            const { texto, segundos } = await groq.transcrever(video, `${m.idExterno}.mp4`);
            await deps.registrarGastoExterno({ servico: "groq", quantidade: Math.ceil(segundos), custoMicroUsd: custoGroqMicroUsd(segundos), coletaId, usuarioId: null });
            await repo.atualizarMidia(m.id, { transcricao: texto, situacaoTranscricao: "feita" });
          } catch (erro) {
            estado.erros.push({ concorrenteId: c.id, passo: "transcricoes", tipo: descreverErro(erro) });
            await repo.atualizarMidia(m.id, { situacaoTranscricao: "falhou" });
          }
        }
      });

      await passo("resumos", async () => {
        const agora = deps.agora();
        const semResumo = (await repo.midias(c.id)).filter(
          (m) => m.tipo === "reels" && !m.resumo && m.situacaoTranscricao !== "pendente" && agora.getTime() - m.publicadoEm.getTime() < 30 * DIA_MS,
        );
        for (const m of semResumo) {
          await exigirSaldo();
          const resumo = await deps.resumirReels({ legenda: m.legenda, transcricao: m.transcricao });
          if (resumo) await repo.atualizarMidia(m.id, { resumo });
        }
      });

      await passo("sinais", async () => {
        if (!c.instagram || ehLinhaDeBase) return;
        const agora = deps.agora();
        const fotos = await repo.fotos(c.id);
        const atual = fotos.find((f) => f.coletaId === coletaId);
        if (!atual) return;
        const anterior = fotos.find((f) => f.coletaId !== coletaId) ?? null;
        const comIdade = fotos.find((f) => atual.capturadaEm.getTime() - f.capturadaEm.getTime() >= 5 * DIA_MS) ?? null;
        const midias = await repo.midias(c.id);
        const jaSinalizadas = await repo.chavesExistentes(midias.map((m) => `conteudo_destaque:${m.idExterno}`));
        const sinais: SinalComChave[] = sinaisDeConteudo(
          midias.map((m) => ({ ...m, jaSinalizada: jaSinalizadas.has(`conteudo_destaque:${m.idExterno}`) })),
          agora,
        ).map((s) => ({ ...s, chave: s.chave! }));
        const porColeta = (s: SinalNovo | null, tipo: string) => (s ? [{ ...s, chave: `${tipo}:${c.id}:${coletaId}` }] : []);
        sinais.push(
          ...porColeta(sinalDeRitmo(midias.map((m) => m.publicadoEm), agora), "ritmo"),
          ...porColeta(sinalDeSeguidores(atual.seguidores, comIdade, atual.capturadaEm), "seguidores"),
          ...porColeta(sinalDeBio(atual, anterior), "bio"),
        );
        if (sinais.length) await repo.criarSinais(coletaId, c.id, sinais, agora);
      });
    }

    if (!estado.passos.analise) {
      await exigirSaldo();
      await escreverRelatorio(coletaId, repo, deps);
      estado.passos.analise = true;
      await repo.salvarProgresso(coletaId, estado, deps.agora());
    }
    const status: StatusColeta = estado.erros.length ? "parcial" : "concluida";
    await repo.finalizarColeta(coletaId, status, deps.agora());
    return status;
  } catch (erro) {
    if (!(erro instanceof SemSaldo)) throw erro;
    await repo.salvarProgresso(coletaId, estado, deps.agora());
    await repo.finalizarColeta(coletaId, "sem_saldo", deps.agora());
    return "sem_saldo";
  }
}

async function capturarPagina(
  coletaId: string,
  concorrenteId: string,
  p: PaginaR,
  repo: RepositorioEspiao,
  deps: DepsColeta,
  exigirSaldo: () => Promise<void>,
): Promise<void> {
  const agora = deps.agora();
  const lida = await deps.lerPagina(p.url);
  const hash = hashTexto(lida.texto);
  const ehLinhaDeBase = p.ultimaCapturaEm === null;
  const mudou = lida.legivel && hash !== p.ultimoHash;
  // Compara sempre com a última versão legível: uma semana "não legível" no meio não vira página nova.
  const anterior = lida.legivel && !ehLinhaDeBase ? await repo.ultimaVersao(p.id) : null;
  const sinais =
    lida.legivel && (mudou || !anterior)
      ? sinaisDePagina({ url: p.url, rotulo: p.rotulo, versaoAnterior: anterior, atual: { texto: lida.texto, precos: lida.precos, legivel: true }, ehLinhaDeBase })
      : [];
  for (const s of sinais) {
    if (s.tipo !== "pagina_mudou" || !anterior) continue;
    await exigirSaldo();
    const titulo = await deps.tituloDaMudanca({ rotulo: p.rotulo, antes: anterior.texto, depois: lida.texto });
    if (titulo) s.titulo = `${p.rotulo}: ${titulo}`.slice(0, 300);
  }
  // Chave por página e coleta: retomar a mesma coleta não repete; um preço que volta numa coleta futura gera sinal de novo.
  if (sinais.length) await repo.criarSinais(coletaId, concorrenteId, sinais.map((s) => ({ ...s, chave: `${s.tipo}:${p.id}:${coletaId}` })), agora);
  await repo.salvarCaptura(p.id, { legivel: lida.legivel, hash, texto: lida.texto, precos: lida.precos, novaVersao: mudou }, agora);
}

async function escreverRelatorio(coletaId: string, repo: RepositorioEspiao, deps: DepsColeta): Promise<void> {
  const agora = deps.agora();
  const sinais = await repo.sinaisDaColeta(coletaId);
  const indicadores = await Promise.all(
    (await repo.concorrentesAtivos()).map(async (c) =>
      calcularIndicadores({
        concorrente: c.nome,
        fotos: await repo.fotos(c.id),
        midias: await repo.midias(c.id),
        destaques: sinais.filter((s) => s.concorrente === c.nome && s.tipo === "conteudo_destaque").map((s) => s.titulo),
        agora,
      }),
    ),
  );
  const analise = await deps.escreverAnalise({ sinais, indicadores });
  if (analise) await repo.salvarRelatorio(coletaId, analise);
}
