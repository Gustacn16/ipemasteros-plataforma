import "server-only";
import type { CategoriaConversaWhatsapp, TipoMensagemWhatsapp } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { janelaDeOntem } from "../regras/dia";

const ESCOPO_GRUPOS = "whatsapp:ver_grupos";
const ESCOPO_EQUIPE = "whatsapp:ver_equipe";
const ESCOPO_PROPRIO = "whatsapp:ver_proprio";

const MS_DIA = 86_400_000;

const ROTULO_TIPO: Record<TipoMensagemWhatsapp, string> = {
  texto: "",
  imagem: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  documento: "[documento]",
  figurinha: "[figurinha]",
  outro: "[mensagem]",
};

export type GrupoNaTela = {
  id: string;
  nome: string;
  monitorada: boolean;
  provisoriaAte: Date | null;
  turma: { id: string; nome: string } | null;
  numeros: string[];
  ultimaMensagemEm: Date | null;
  totalMensagens7d: number;
  /** Pendências do resumo pronto de ontem; null quando não há resumo pronto. */
  pendenciasOntem: number | null;
};

export type ResumoTela = {
  situacao: "pendente" | "pronto" | "falhou";
  erro: string | null;
  resumo: string | null;
  temas: string[];
  pendencias: { autor: string; hora: string; texto: string }[];
  destaques: string[];
  participacao: { autor: string; mensagens: number }[];
  totalMensagens: number;
};

export type ConversaNaTela = {
  id: string;
  /** Nome do contato; nunca o telefone completo. */
  nome: string;
  numeroId: string | null;
  numero: string | null;
  categoria: CategoriaConversaWhatsapp;
  ultimaMensagemEm: Date | null;
};

export type MensagemNaTela = {
  id: string;
  autor: string;
  deMim: boolean;
  tipo: TipoMensagemWhatsapp;
  texto: string;
  enviadaEm: Date;
};

type Contato = { nomeExibido: string | null; telefone: string | null } | null;

/** Nome para mostrar: o do perfil; sem ele, "…" e os 4 últimos dígitos; nunca o telefone inteiro nem o JID. */
export function nomeDoAutor(contato: Contato): string {
  if (contato?.nomeExibido) return contato.nomeExibido;
  const digitos = contato?.telefone?.replace(/\D/g, "") ?? "";
  if (digitos.length >= 4) return `…${digitos.slice(-4)}`;
  return "Contato sem nome";
}

function exigirGrupos(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, ESCOPO_GRUPOS)) throw new ErroPermissao(ESCOPO_GRUPOS);
}

/** Gestão vê todas as individuais; o vendedor só as dos próprios números. */
function escopoIndividuais(ator: UsuarioAtual): { todas: boolean } {
  if (temPermissao(ator.papel, ESCOPO_EQUIPE)) return { todas: true };
  if (temPermissao(ator.papel, ESCOPO_PROPRIO)) return { todas: false };
  throw new ErroPermissao(ESCOPO_PROPRIO);
}

async function grupoDoAtor(ator: UsuarioAtual, conversaId: string) {
  exigirGrupos(ator);
  const conversa = await prisma.conversaWhatsapp.findUnique({ where: { id: conversaId } });
  if (!conversa || conversa.tipo !== "grupo") throw new ErroNegocio("Grupo não encontrado.");
  return conversa;
}

/** Busca a conversa individual e confere se o ator pode vê-la. */
async function individualDoAtor(ator: UsuarioAtual, conversaId: string) {
  const { todas } = escopoIndividuais(ator);
  const conversa = await prisma.conversaWhatsapp.findUnique({
    where: { id: conversaId },
    include: { numero: { select: { id: true, usuarioId: true } } },
  });
  if (!conversa || conversa.tipo !== "individual") throw new ErroNegocio("Conversa não encontrada.");
  if (!todas && conversa.numero?.usuarioId !== ator.id) throw new ErroPermissao(ESCOPO_PROPRIO);
  return conversa;
}

export async function listarGrupos(ator: UsuarioAtual, agora: Date = new Date()): Promise<GrupoNaTela[]> {
  exigirGrupos(ator);
  const grupos = await prisma.conversaWhatsapp.findMany({
    where: { tipo: "grupo" },
    include: {
      turma: { select: { id: true, nome: true } },
      nosGrupo: { include: { numero: { select: { nome: true } } } },
    },
    orderBy: [{ ultimaMensagemEm: "desc" }, { criadoEm: "desc" }],
  });
  const contagens =
    grupos.length === 0
      ? []
      : await prisma.mensagemWhatsapp.groupBy({
          by: ["conversaId"],
          where: { conversaId: { in: grupos.map((g) => g.id) }, enviadaEm: { gte: new Date(Date.now() - 7 * MS_DIA) } },
          _count: { _all: true },
        });
  const porGrupo = new Map(contagens.map((c) => [c.conversaId, c._count._all]));
  const resumos =
    grupos.length === 0
      ? []
      : await prisma.resumoGrupo.findMany({
          where: { conversaId: { in: grupos.map((g) => g.id) }, dia: janelaDeOntem(agora).dia, situacao: "pronto" },
          select: { conversaId: true, pendencias: true },
        });
  const pendenciasPorGrupo = new Map(resumos.map((r) => [r.conversaId, listaJson(r.pendencias).length]));
  return grupos.map((g) => ({
    id: g.id,
    nome: g.nome ?? "Grupo sem nome",
    monitorada: g.monitorada,
    provisoriaAte: g.provisoriaAte,
    turma: g.turma,
    numeros: g.nosGrupo.map((n) => n.numero.nome),
    ultimaMensagemEm: g.ultimaMensagemEm,
    totalMensagens7d: porGrupo.get(g.id) ?? 0,
    pendenciasOntem: pendenciasPorGrupo.get(g.id) ?? null,
  }));
}

function listaJson(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

/** Resumo do grupo no dia (`dia` é a meia-noite UTC da data de São Paulo); null quando não existe. A permissão é conferida pela tela. */
export async function resumoDoGrupo(conversaId: string, dia: Date): Promise<ResumoTela | null> {
  const r = await prisma.resumoGrupo.findUnique({ where: { conversaId_dia: { conversaId, dia } } });
  if (!r) return null;
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    situacao: r.situacao,
    erro: r.erro,
    resumo: r.resumo,
    temas: listaJson(r.temas).map(texto).filter(Boolean),
    pendencias: listaJson(r.pendencias).map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return { autor: texto(o.autor), hora: texto(o.hora), texto: texto(o.texto) };
    }),
    destaques: listaJson(r.destaques).map(texto).filter(Boolean),
    participacao: listaJson(r.participacao).map((p) => {
      const o = (p ?? {}) as Record<string, unknown>;
      return { autor: texto(o.autor), mensagens: typeof o.mensagens === "number" ? o.mensagens : 0 };
    }),
    totalMensagens: r.totalMensagens,
  };
}

/** Turmas para o seletor da tela de grupos. Lê direto do banco: módulos não importam serviços uns dos outros. */
export async function listarTurmasParaGrupo(ator: UsuarioAtual): Promise<{ id: string; nome: string }[]> {
  exigirGrupos(ator);
  return prisma.turma.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } });
}

export async function definirMonitoramento(ator: UsuarioAtual, conversaId: string, monitorada: boolean): Promise<void> {
  const grupo = await grupoDoAtor(ator, conversaId);
  await prisma.$transaction(async (tx) => {
    if (monitorada) {
      // Passa a ser definitivo: o que já estava guardado deixa de expirar.
      await tx.conversaWhatsapp.update({ where: { id: grupo.id }, data: { monitorada: true, provisoriaAte: null } });
    } else {
      await tx.conversaWhatsapp.update({ where: { id: grupo.id }, data: { monitorada: false, provisoriaAte: null } });
      await tx.mensagemWhatsapp.deleteMany({ where: { conversaId: grupo.id } });
    }
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.grupo_monitorado",
        entidade: "ConversaWhatsapp",
        entidadeId: grupo.id,
        diff: { monitorada },
      },
      tx,
    );
  });
}

export async function ligarTurma(ator: UsuarioAtual, conversaId: string, turmaId: string | null): Promise<void> {
  const grupo = await grupoDoAtor(ator, conversaId);
  if (turmaId !== null) {
    const turma = await prisma.turma.findUnique({ where: { id: turmaId }, select: { id: true } });
    if (!turma) throw new ErroNegocio("Turma não encontrada.");
  }
  await prisma.conversaWhatsapp.update({ where: { id: grupo.id }, data: { turmaId } });
}

export async function listarConversas(
  ator: UsuarioAtual,
  filtro: { numeroId?: string; categoria?: CategoriaConversaWhatsapp },
): Promise<ConversaNaTela[]> {
  const { todas } = escopoIndividuais(ator);
  const conversas = await prisma.conversaWhatsapp.findMany({
    where: {
      tipo: "individual",
      ...(todas ? {} : { numero: { usuarioId: ator.id } }),
      ...(filtro.numeroId ? { numeroId: filtro.numeroId } : {}),
      ...(filtro.categoria ? { categoria: filtro.categoria } : {}),
    },
    include: {
      numero: { select: { nome: true } },
      contato: { select: { nomeExibido: true, telefone: true } },
    },
    orderBy: [{ ultimaMensagemEm: "desc" }, { criadoEm: "desc" }],
    take: 500,
  });
  return conversas.map((c) => ({
    id: c.id,
    nome: nomeDoAutor(c.contato),
    numeroId: c.numeroId,
    numero: c.numero?.nome ?? null,
    categoria: c.categoria,
    ultimaMensagemEm: c.ultimaMensagemEm,
  }));
}

export async function definirCategoria(
  ator: UsuarioAtual,
  conversaId: string,
  categoria: CategoriaConversaWhatsapp,
): Promise<void> {
  const conversa = await individualDoAtor(ator, conversaId);
  await prisma.$transaction(async (tx) => {
    await tx.conversaWhatsapp.update({ where: { id: conversa.id }, data: { categoria } });
    // Pessoal não fica guardada: o que já existia some junto, na mesma transação.
    if (categoria === "pessoal") await tx.mensagemWhatsapp.deleteMany({ where: { conversaId: conversa.id } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.categoria_alterada",
        entidade: "ConversaWhatsapp",
        entidadeId: conversa.id,
        diff: { de: conversa.categoria, para: categoria },
      },
      tx,
    );
  });
}

/** Últimas mensagens, da mais antiga para a mais nova. Abrir conversa de número de outro dono fica na auditoria (só ids). */
export async function mensagensDaConversa(
  ator: UsuarioAtual,
  conversaId: string,
  limite = 200,
): Promise<{ tipo: "grupo" | "individual"; mensagens: MensagemNaTela[] }> {
  const base = await prisma.conversaWhatsapp.findUnique({ where: { id: conversaId }, select: { tipo: true } });
  if (!base) throw new ErroNegocio("Conversa não encontrada.");
  let auditar = false;
  if (base.tipo === "grupo") {
    exigirGrupos(ator);
  } else {
    const conversa = await individualDoAtor(ator, conversaId);
    auditar = conversa.numero?.usuarioId !== ator.id;
  }
  return prisma.$transaction(async (tx) => {
    if (auditar) {
      await registrarAuditoria(
        { usuarioId: ator.id, acao: "whatsapp.conversa_aberta", entidade: "ConversaWhatsapp", entidadeId: conversaId },
        tx,
      );
    }
    const mensagens = await tx.mensagemWhatsapp.findMany({
      where: { conversaId },
      include: { contato: { select: { nomeExibido: true, telefone: true } } },
      orderBy: { enviadaEm: "desc" },
      take: limite,
    });
    const naTela = mensagens.reverse().map((m) => ({
      id: m.id,
      autor: m.deMim ? "Você" : nomeDoAutor(m.contato),
      deMim: m.deMim,
      tipo: m.tipo,
      texto: [ROTULO_TIPO[m.tipo], m.texto].filter(Boolean).join(" "),
      enviadaEm: m.enviadaEm,
    }));
    return { tipo: base.tipo, mensagens: naTela };
  });
}
