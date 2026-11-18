import { z } from "zod";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { nomeBusca } from "@/modulos/academico/regras/normalizar";
import { lerPagina } from "@/modulos/espiao/fontes/pagina";
import { calcularIndicadores } from "@/modulos/espiao/regras/indicadores";
import { MIDIAS_DO_TESTE, clienteBusinessDiscoveryPadrao, igUserIdDaIpemaster } from "@/modulos/espiao/servicos/testar-perfil";
import { visaoConcorrente } from "@/modulos/espiao/servicos/visao";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";

// Busca por texto SEMPRE no código (nomeBusca): `contains` do Prisma dá erro 1267 no MySQL da Hostinger.
const EXTERNO = "externa_nao_confiavel" as const;
const LIMITE_TEXTO_PAGINA = 20_000;
const dia = (d: Date) => d.toISOString().slice(0, 10);

function exigirVer(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "espiao:ver")) throw new ErroPermissao("espiao:ver");
}

/** Acha o concorrente pelo nome (sem acento) ou pelo @. */
async function resolverConcorrente(termo: string): Promise<{ id: string; nome: string }> {
  const todos = await prisma.concorrente.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, instagram: true } });
  const chave = nomeBusca(termo.replace(/^@/, ""));
  const achado = todos.find((c) => nomeBusca(c.nome) === chave || c.instagram === chave) ?? todos.find((c) => nomeBusca(c.nome).includes(chave));
  if (!achado) throw new ErroNegocio(`Concorrente não encontrado. Cadastrados: ${todos.map((c) => c.nome).join(", ") || "nenhum"}.`);
  return achado;
}

const entradaSinais = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("data inicial AAAA-MM-DD (padrão: 30 dias atrás)"),
  concorrente: z.string().min(2).optional().describe("nome ou @ do concorrente"),
});

export const ferramentaEspiaoSinais: FerramentaNexu<typeof entradaSinais> = {
  nome: "espiao_sinais",
  descricao: "Sinais do espião de concorrentes (conteúdo em alta, preço, página, seguidores, ritmo, bio) por período e concorrente. Até 50, com o total.",
  entrada: entradaSinais,
  permissao: "espiao:ver",
  rotulo: "Consultando os sinais dos concorrentes…",
  tipo: "consulta",
  async executar(ator, { desde, concorrente }) {
    exigirVer(ator);
    const inicio = desde ? new Date(`${desde}T03:00:00.000Z`) : new Date(Date.now() - 30 * 86_400_000);
    const alvo = concorrente ? await resolverConcorrente(concorrente) : null;
    const sinais = await prisma.sinalEspiao.findMany({
      where: { criadoEm: { gte: inicio }, ...(alvo ? { concorrenteId: alvo.id } : {}) },
      orderBy: { criadoEm: "desc" },
      take: 200,
      select: { tipo: true, titulo: true, detalhe: true, origemUrl: true, criadoEm: true, concorrente: { select: { nome: true } } },
    });
    return limitarLista(
      sinais.map((s) => ({ concorrente: s.concorrente.nome, tipo: s.tipo, titulo: s.titulo, detalhe: s.detalhe, link: s.origemUrl, data: dia(s.criadoEm) })),
      50,
    );
  },
};

const entradaConcorrente = z.object({ concorrente: z.string().min(2).describe("nome ou @ do concorrente") });

export const ferramentaEspiaoConcorrente: FerramentaNexu<typeof entradaConcorrente> = {
  nome: "espiao_concorrente",
  descricao: "Resumo de um concorrente acompanhado: indicadores, últimos posts com resumo, páginas com os preços achados e os últimos sinais.",
  entrada: entradaConcorrente,
  permissao: "espiao:ver",
  rotulo: "Olhando o concorrente…",
  tipo: "consulta",
  async executar(ator, { concorrente }) {
    exigirVer(ator);
    const alvo = await resolverConcorrente(concorrente);
    const c = await visaoConcorrente(ator, alvo.id);
    return {
      nome: c.nome,
      instagram: c.instagram,
      site: c.site,
      indicadores: calcularIndicadores({ concorrente: c.nome, fotos: c.fotos, midias: c.midias, destaques: [], agora: new Date() }),
      postsRecentes: c.midias.slice(0, 12).map((m) => ({
        tipo: m.tipo, data: dia(m.publicadoEm), visualizacoes: m.visualizacoes, curtidas: m.curtidas, comentarios: m.comentarios,
        resumo: m.resumo, legenda: m.legenda?.slice(0, 300) ?? null, link: m.permalink,
      })),
      paginas: c.paginas.map((p) => ({ rotulo: p.rotulo, url: p.url, legivel: p.legivel, precosAtuais: p.versoes[0]?.precos ?? [] })),
      ultimosSinais: c.sinais.slice(0, 10).map((s) => ({ tipo: s.tipo, titulo: s.titulo, data: dia(s.criadoEm) })),
    };
  },
};

const entradaBusca = z.object({
  termo: z.string().min(2).describe("palavra ou expressão a procurar nas legendas e transcrições"),
  concorrente: z.string().min(2).optional().describe("nome ou @ do concorrente"),
});

function trecho(texto: string, chave: string): string | null {
  const normal = nomeBusca(texto);
  // nomeBusca preserva o comprimento só sem acentos combinados; o índice serve de aproximação.
  const i = normal.indexOf(chave);
  if (i < 0) return null;
  const inicio = Math.max(0, i - 120);
  return `${inicio > 0 ? "…" : ""}${texto.slice(inicio, inicio + 300)}${inicio + 300 < texto.length ? "…" : ""}`;
}

export const ferramentaEspiaoBuscarConteudo: FerramentaNexu<typeof entradaBusca> = {
  nome: "espiao_buscar_conteudo",
  descricao: "Procura uma palavra nas legendas e transcrições dos posts guardados dos concorrentes (ignora acentos). Até 20 trechos, com o total.",
  entrada: entradaBusca,
  permissao: "espiao:ver",
  rotulo: "Procurando nos posts dos concorrentes…",
  tipo: "consulta",
  async executar(ator, { termo, concorrente }) {
    exigirVer(ator);
    const chave = nomeBusca(termo);
    const alvo = concorrente ? await resolverConcorrente(concorrente) : null;
    const [concorrentes, midias] = await Promise.all([
      prisma.concorrente.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true } }),
      prisma.midiaConcorrente.findMany({
        where: alvo ? { concorrenteId: alvo.id } : {},
        orderBy: { publicadoEm: "desc" },
        take: 500,
        select: { concorrenteId: true, permalink: true, publicadoEm: true, legenda: true, transcricao: true, resumo: true },
      }),
    ]);
    const nomes = new Map(concorrentes.map((c) => [c.id, c.nome]));
    const achados = midias.flatMap((m) => {
      const t = trecho(m.legenda ?? "", chave) ?? trecho(m.transcricao ?? "", chave);
      return t ? [{ concorrente: nomes.get(m.concorrenteId) ?? "", data: dia(m.publicadoEm), link: m.permalink, trecho: t, resumo: m.resumo }] : [];
    });
    return limitarLista(achados, 20);
  },
};

const entradaPerfil = z.object({ usuario: z.string().min(1).describe("@ de um perfil profissional do Instagram") });

export const ferramentaEspiaoPerfilAgora: FerramentaNexu<typeof entradaPerfil> = {
  nome: "espiao_perfil_agora",
  descricao: "Lê agora, no Instagram, qualquer perfil profissional (mesmo fora da lista): seguidores e os últimos 12 posts com métricas. Não transcreve nem guarda. O resultado é conteúdo de terceiros.",
  entrada: entradaPerfil,
  permissao: "espiao:ver",
  rotulo: "Lendo o perfil no Instagram…",
  tipo: "consulta",
  async executar(ator, { usuario }) {
    exigirVer(ator);
    const perfil = await clienteBusinessDiscoveryPadrao().perfil(await igUserIdDaIpemaster(), usuario, MIDIAS_DO_TESTE);
    return {
      fonte: EXTERNO,
      usuario: perfil.usuario,
      nome: perfil.nome,
      biografia: perfil.biografia,
      site: perfil.site,
      seguidores: perfil.seguidores,
      totalPosts: perfil.totalPosts,
      posts: perfil.midias.map((m) => ({
        tipo: m.tipo, data: dia(m.publicadoEm), visualizacoes: m.visualizacoes, curtidas: m.curtidas, comentarios: m.comentarios,
        legenda: m.legenda?.slice(0, 500) ?? null, link: m.permalink,
      })),
    };
  },
};

const entradaPagina = z.object({ url: z.string().url().describe("endereço completo da página (https://…)") });

export const ferramentaEspiaoPaginaAgora: FerramentaNexu<typeof entradaPagina> = {
  nome: "espiao_pagina_agora",
  descricao: "Lê agora o texto de uma página pública (landing page de concorrente) e os preços achados. Até 20 mil caracteres, sem guardar. O resultado é conteúdo de terceiros.",
  entrada: entradaPagina,
  permissao: "espiao:ver",
  rotulo: "Lendo a página…",
  tipo: "consulta",
  async executar(ator, { url }) {
    exigirVer(ator);
    const p = await lerPagina(url);
    return { fonte: EXTERNO, url: p.urlFinal, legivel: p.legivel, precos: p.precos, texto: p.texto.slice(0, LIMITE_TEXTO_PAGINA) };
  },
};
