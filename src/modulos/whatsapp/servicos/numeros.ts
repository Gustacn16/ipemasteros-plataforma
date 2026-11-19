import "server-only";
import type { FinalidadeNumeroWhatsapp, TimeNumeroWhatsapp } from "@/generated/prisma/client";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { detalheNaTela, estadoNaTela, ROTULO_ESTADO, type EstadoTela } from "../regras/conexao";
import { esquemaNovoNumero } from "../esquemas/numero";

export type NumeroNaTela = {
  id: string;
  nome: string;
  finalidade: FinalidadeNumeroWhatsapp;
  time: TimeNumeroWhatsapp;
  dono: string | null;
  telefone: string | null;
  estado: EstadoTela;
  rotulo: string;
  /** Texto do erro gravado pelo motor; só no estado de erro. */
  detalhe: string | null;
  conectadoEm: Date | null;
  ultimoSinalEm: Date | null;
};

const ESCOPO_GESTAO = "whatsapp:gerenciar_numeros";
const ESCOPO_PROPRIO = "whatsapp:conectar_proprio";

/** Busca a vaga e confere se o ator pode mexer nela (gestão, ou o vendedor dono). */
async function vagaDoAtor(ator: UsuarioAtual, numeroId: string) {
  const numero = await prisma.numeroWhatsapp.findUnique({ where: { id: numeroId } });
  if (!numero || numero.excluidoEm) throw new ErroNegocio("Número não encontrado.");
  const gestao = temPermissao(ator.papel, ESCOPO_GESTAO);
  const dono = temPermissao(ator.papel, ESCOPO_PROPRIO) && numero.usuarioId === ator.id;
  if (!gestao && !dono) throw new ErroPermissao(ESCOPO_PROPRIO);
  return numero;
}

export async function listarNumeros(ator: UsuarioAtual): Promise<NumeroNaTela[]> {
  const gestao = temPermissao(ator.papel, ESCOPO_GESTAO);
  if (!gestao && !temPermissao(ator.papel, ESCOPO_PROPRIO)) throw new ErroPermissao(ESCOPO_PROPRIO);
  const agora = new Date();
  const numeros = await prisma.numeroWhatsapp.findMany({
    where: gestao ? { excluidoEm: null } : { excluidoEm: null, usuarioId: ator.id },
    include: { usuario: { select: { nome: true, apelido: true } } },
    orderBy: { criadoEm: "asc" },
  });
  return numeros.map((n) => {
    const estado = estadoNaTela(n, agora);
    return {
      id: n.id,
      nome: n.nome,
      finalidade: n.finalidade,
      time: n.time,
      dono: n.usuario ? (n.usuario.apelido ?? n.usuario.nome) : null,
      telefone: n.telefone,
      estado,
      rotulo: ROTULO_ESTADO[estado],
      detalhe: detalheNaTela(estado, n.erro),
      conectadoEm: n.conectadoEm,
      ultimoSinalEm: n.ultimoSinalEm,
    };
  });
}

export async function criarNumero(ator: UsuarioAtual, dados: unknown): Promise<{ id: string }> {
  if (!temPermissao(ator.papel, ESCOPO_GESTAO)) throw new ErroPermissao(ESCOPO_GESTAO);
  const v = esquemaNovoNumero.parse(dados);
  if (v.finalidade === "vendedor") {
    const dono = await prisma.usuario.findFirst({
      where: { id: v.usuarioId ?? "", ativo: true, papel: "comercial" },
      select: { id: true },
    });
    if (!dono) throw new ErroNegocio("Escolha o vendedor dono do número.");
  }
  return prisma.$transaction(async (tx) => {
    const criado = await tx.numeroWhatsapp.create({
      data: { nome: v.nome, finalidade: v.finalidade, usuarioId: v.usuarioId },
      select: { id: true },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.numero_criado",
        entidade: "NumeroWhatsapp",
        entidadeId: criado.id,
        diff: { nome: v.nome, finalidade: v.finalidade },
      },
      tx,
    );
    return { id: criado.id };
  });
}

export async function alterarTimeNumero(ator: UsuarioAtual, numeroId: string, time: TimeNumeroWhatsapp): Promise<void> {
  if (!temPermissao(ator.papel, ESCOPO_GESTAO)) throw new ErroPermissao(ESCOPO_GESTAO);
  const numero = await vagaDoAtor(ator, numeroId);
  const de = numero.time;
  if (de === time) return;
  await prisma.$transaction(async (tx) => {
    await tx.numeroWhatsapp.update({ where: { id: numero.id }, data: { time, timeDesde: new Date() } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.time_alterado",
        entidade: "NumeroWhatsapp",
        entidadeId: numero.id,
        diff: { de, para: time },
      },
      tx,
    );
  });
}

export async function excluirNumero(ator: UsuarioAtual, numeroId: string): Promise<void> {
  if (!temPermissao(ator.papel, ESCOPO_GESTAO)) throw new ErroPermissao(ESCOPO_GESTAO);
  const numero = await vagaDoAtor(ator, numeroId);
  // Vaga presa aguardando QR ou em erro também pode sair; só a conectada exige desconectar antes.
  if (numero.situacao === "conectado") throw new ErroNegocio("Desconecte o número antes de excluir.");
  await prisma.$transaction(async (tx) => {
    // O motor pode ter uma sessão aberta ou salva (QR em leitura, erro que guardou a sessão):
    // o desconectar encerra e apaga; é entregue mesmo com a vaga já excluída.
    await enfileirar(tx, numero.id, "desconectar");
    await tx.numeroWhatsapp.update({ where: { id: numero.id }, data: { excluidoEm: new Date() } });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.numero_excluido",
        entidade: "NumeroWhatsapp",
        entidadeId: numero.id,
        diff: { nome: numero.nome, finalidade: numero.finalidade },
      },
      tx,
    );
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Cria o comando, a menos que já exista um igual na fila. Devolve se criou.
 * MySQL não tem índice único parcial, então a vaga é travada antes da checagem: o update
 * segura o lock da linha (InnoDB) até o fim da transação e cliques simultâneos na mesma
 * vaga passam um de cada vez, o segundo já enxerga o comando criado pelo primeiro.
 */
async function enfileirar(tx: Tx, numeroId: string, tipo: "conectar" | "desconectar"): Promise<boolean> {
  await tx.numeroWhatsapp.update({ where: { id: numeroId }, data: { atualizadoEm: new Date() } });
  const existente = await tx.comandoWhatsapp.findFirst({
    where: { numeroId, tipo, situacao: { in: ["pendente", "em_andamento"] } },
    select: { id: true },
  });
  if (existente) return false;
  await tx.comandoWhatsapp.create({ data: { numeroId, tipo } });
  return true;
}

export async function solicitarConexao(ator: UsuarioAtual, numeroId: string): Promise<void> {
  const numero = await vagaDoAtor(ator, numeroId);
  await prisma.$transaction(async (tx) => {
    // Segundo clique com o pedido ainda na fila: não zera o QR que o motor já gravou.
    if (!(await enfileirar(tx, numero.id, "conectar"))) return;
    await tx.numeroWhatsapp.update({
      where: { id: numero.id },
      data: { situacao: "aguardando_qr", qrAtual: null, qrEm: null, erro: null },
    });
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.conexao_solicitada",
        entidade: "NumeroWhatsapp",
        entidadeId: numero.id,
        diff: { nome: numero.nome },
      },
      tx,
    );
  });
}

export async function solicitarDesconexao(ator: UsuarioAtual, numeroId: string): Promise<void> {
  const numero = await vagaDoAtor(ator, numeroId);
  await prisma.$transaction(async (tx) => {
    if (!(await enfileirar(tx, numero.id, "desconectar"))) return;
    await registrarAuditoria(
      {
        usuarioId: ator.id,
        acao: "whatsapp.desconexao_solicitada",
        entidade: "NumeroWhatsapp",
        entidadeId: numero.id,
        diff: { nome: numero.nome },
      },
      tx,
    );
  });
}

/** Estado para a tela de conexão. O QR só sai enquanto a vaga espera leitura e ele ainda vale. */
export async function situacaoParaTela(
  ator: UsuarioAtual,
  numeroId: string,
): Promise<{ estado: EstadoTela; rotulo: string; detalhe: string | null; qr: string | null }> {
  const numero = await vagaDoAtor(ator, numeroId);
  const estado = estadoNaTela(numero, new Date());
  return {
    estado,
    rotulo: ROTULO_ESTADO[estado],
    detalhe: detalheNaTela(estado, numero.erro),
    qr: estado === "aguardando_qr" ? numero.qrAtual : null,
  };
}

/** Vendedores (papel comercial, ativos) que podem ser donos de um número. Só para quem gerencia números. */
export async function listarVendedoresAtivos(ator: UsuarioAtual): Promise<{ id: string; nome: string }[]> {
  if (!temPermissao(ator.papel, ESCOPO_GESTAO)) throw new ErroPermissao(ESCOPO_GESTAO);
  const usuarios = await prisma.usuario.findMany({
    where: { ativo: true, papel: "comercial" },
    select: { id: true, nome: true, apelido: true },
    orderBy: { nome: "asc" },
  });
  return usuarios.map((u) => ({ id: u.id, nome: u.apelido ?? u.nome }));
}
