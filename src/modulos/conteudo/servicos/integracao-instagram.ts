import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroMeta } from "@/lib/meta-graph";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { permissoesFaltando } from "../regras/instagram";
import { type ClienteInstagram, criarClienteInstagram } from "./instagram-graph";
import { MENSAGEM_NAO_ENCONTRADO } from "./contas";

function exigirIntegracao(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "conteudo:gerenciar_integracao_instagram"))
    throw new ErroPermissao("conteudo:gerenciar_integracao_instagram");
}

export type Situacao = "conectada" | "falta_permissao" | "nao_configurada" | "chave_invalida" | "erro";

/** Situação da chave (regra 5.16), contas encontradas, canais do Instagram e últimas atualizações. */
export async function situacaoIntegracao(ator: UsuarioAtual, cliente?: ClienteInstagram) {
  exigirIntegracao(ator);
  const token = process.env.META_ACCESS_TOKEN;
  let situacao: Situacao = "nao_configurada";
  let faltando: string[] = [];
  let mensagem: string | null = null;
  if (cliente || token) {
    try {
      faltando = permissoesFaltando(await (cliente ?? criarClienteInstagram(token!)).permissoes());
      situacao = faltando.length ? "falta_permissao" : "conectada";
    } catch (erro) {
      situacao = erro instanceof ErroMeta && erro.codigo === 190 ? "chave_invalida" : "erro";
      mensagem = erro instanceof ErroMeta ? erro.message : "Não foi possível conferir a chave.";
    }
  }

  const [contas, canais, atualizacoes] = await Promise.all([
    prisma.contaInstagram.findMany({
      orderBy: { usuario: "asc" },
      select: { id: true, usuario: true, nome: true, fotoUrl: true, ativa: true, canalId: true },
    }),
    prisma.canal.findMany({
      where: { plataforma: "instagram", ativo: true, excluidoEm: null, marca: { excluidoEm: null } },
      orderBy: [{ marca: { ordem: "asc" } }, { ordem: "asc" }],
      select: { id: true, identificador: true, marca: { select: { nome: true } } },
    }),
    prisma.atualizacaoInstagram.findMany({ orderBy: { iniciadoEm: "desc" }, take: 10 }),
  ]);
  return {
    situacao,
    faltando,
    mensagem,
    contas,
    canais: canais.map((c) => ({ id: c.id, rotulo: `${c.marca.nome}${c.identificador ? ` · ${c.identificador}` : ""}` })),
    atualizacoes: atualizacoes.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      origem: a.origem,
      status: a.status,
      iniciadoEm: a.iniciadoEm.toISOString(),
      registros: a.registros,
      erro: a.erro,
    })),
  };
}
export type SituacaoIntegracaoInstagram = Awaited<ReturnType<typeof situacaoIntegracao>>;

/** Liga a conta a um canal ativo do Instagram, que não pode estar ligado a outra conta (regra 5.2). `null` desliga. */
export async function ligarContaCanal(ator: UsuarioAtual, contaId: string, canalId: string | null) {
  exigirIntegracao(ator);
  const conta = await prisma.contaInstagram.findUnique({ where: { id: contaId } });
  if (!conta) throw new ErroNegocio(MENSAGEM_NAO_ENCONTRADO);
  if (canalId) {
    const canal = await prisma.canal.findFirst({ where: { id: canalId } });
    if (!canal || canal.plataforma !== "instagram" || !canal.ativo || canal.excluidoEm)
      throw new ErroNegocio("Escolha um canal ativo do Instagram.");
    const outra = await prisma.contaInstagram.findFirst({ where: { canalId, id: { not: contaId } } });
    if (outra) throw new ErroNegocio("Este canal já está ligado a outra conta.");
  }
  await prisma.contaInstagram.update({ where: { id: contaId }, data: { canalId } });
}

export async function definirContaAtiva(ator: UsuarioAtual, contaId: string, ativa: boolean) {
  exigirIntegracao(ator);
  await prisma.contaInstagram.update({ where: { id: contaId }, data: { ativa } });
}
