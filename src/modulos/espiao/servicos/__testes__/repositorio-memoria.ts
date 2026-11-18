// Repositório em memória para os testes da coleta (só teste).
import type { ColetaR, FotoR, MidiaR, PaginaR, RepositorioEspiao, SinalGravado } from "../coleta";

let seq = 0;
const id = (p: string) => `${p}${++seq}`;

export function criarRepositorioMemoria(inicial: { concorrentes: { id: string; nome: string; instagram: string | null }[]; paginas?: (PaginaR & { concorrenteId: string })[] }) {
  const coletas: ColetaR[] = [];
  const fotos: (FotoR & { concorrenteId: string })[] = [];
  const midias: (MidiaR & { concorrenteId: string })[] = [];
  const paginas = [...(inicial.paginas ?? [])];
  const versoes: { paginaId: string; texto: string; precos: string[]; hash: string }[] = [];
  const sinais: SinalGravado[] = [];
  const relatorios = new Map<string, string>();

  const repo: RepositorioEspiao = {
    async coletaRodando() {
      return coletas.find((c) => c.status === "rodando") ?? null;
    },
    async ultimaFinalizada() {
      const f = coletas.filter((c) => c.status === "concluida" || c.status === "parcial").sort((a, b) => b.iniciadaEm.getTime() - a.iniciadaEm.getTime());
      return f[0] ?? null;
    },
    async criarColeta(origem, agora) {
      const c: ColetaR = { id: id("col"), origem, status: "rodando", iniciadaEm: agora, progressoEm: agora, passos: { concorrentes: {} }, erros: [] };
      coletas.push(c);
      return c;
    },
    async obterColeta(cid) {
      const c = coletas.find((x) => x.id === cid);
      if (!c) throw new Error("coleta inexistente");
      return structuredClone(c);
    },
    async salvarProgresso(cid, d, agora) {
      const c = coletas.find((x) => x.id === cid)!;
      c.passos = structuredClone(d.passos);
      c.erros = structuredClone(d.erros);
      c.progressoEm = agora;
    },
    async finalizarColeta(cid, status) {
      coletas.find((x) => x.id === cid)!.status = status;
    },
    async concorrentesAtivos() {
      return inicial.concorrentes;
    },
    async fotos(concorrenteId) {
      return fotos.filter((f) => f.concorrenteId === concorrenteId).sort((a, b) => b.capturadaEm.getTime() - a.capturadaEm.getTime());
    },
    async salvarFoto(concorrenteId, coletaId, d, agora) {
      fotos.push({ concorrenteId, coletaId, ...d, capturadaEm: agora });
    },
    async midias(concorrenteId) {
      return midias.filter((m) => m.concorrenteId === concorrenteId).map((m) => ({ ...m }));
    },
    async salvarMidia(concorrenteId, m, situacaoSeNova) {
      const existente = midias.find((x) => x.idExterno === m.idExterno);
      if (existente) Object.assign(existente, { curtidas: m.curtidas, comentarios: m.comentarios, visualizacoes: m.visualizacoes, legenda: m.legenda });
      else
        midias.push({
          id: id("mid"), concorrenteId, idExterno: m.idExterno, tipo: m.tipo, legenda: m.legenda, permalink: m.permalink, publicadoEm: m.publicadoEm,
          curtidas: m.curtidas, comentarios: m.comentarios, visualizacoes: m.visualizacoes, transcricao: null, resumo: null, situacaoTranscricao: situacaoSeNova,
        });
    },
    async atualizarMidia(mid, d) {
      Object.assign(midias.find((m) => m.id === mid)!, d);
    },
    async paginas(concorrenteId) {
      return paginas.filter((p) => p.concorrenteId === concorrenteId).map((p) => ({ ...p }));
    },
    async ultimaVersao(paginaId) {
      const v = versoes.filter((x) => x.paginaId === paginaId).at(-1);
      return v ? { texto: v.texto, precos: v.precos } : null;
    },
    async salvarCaptura(paginaId, d, agora) {
      const p = paginas.find((x) => x.id === paginaId)!;
      p.legivel = d.legivel;
      p.ultimaCapturaEm = agora;
      if (d.novaVersao) {
        p.ultimoHash = d.hash;
        versoes.push({ paginaId, texto: d.texto, precos: d.precos, hash: d.hash });
      }
    },
    async chavesExistentes(chaves) {
      return new Set(sinais.map((s) => s.chave).filter((c) => chaves.includes(c)));
    },
    async criarSinais(coletaId, concorrenteId, novos) {
      for (const s of novos) if (!sinais.some((x) => x.chave === s.chave)) sinais.push({ ...s, coletaId, concorrenteId });
    },
    async sinaisDaColeta(coletaId) {
      return sinais.filter((s) => s.coletaId === coletaId).map((s) => ({ concorrente: inicial.concorrentes.find((c) => c.id === s.concorrenteId)?.nome ?? "", tipo: s.tipo, titulo: s.titulo, detalhe: s.detalhe }));
    },
    async salvarRelatorio(coletaId, analise) {
      relatorios.set(coletaId, analise);
    },
  };
  return { repo, coletas, fotos, midias, paginas, versoes, sinais, relatorios };
}
