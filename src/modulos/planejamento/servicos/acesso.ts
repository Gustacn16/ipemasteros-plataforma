import "server-only";
import { ErroNegocio } from "@/lib/erros";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";

export function exigir(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

export const podeVer = (ator: UsuarioAtual) => temPermissao(ator.papel, "planejamento:ver");
export const podeEditar = (ator: UsuarioAtual) => temPermissao(ator.papel, "planejamento:editar");

/** Gestão lança qualquer indicador; os outros, só aqueles em que são responsáveis. */
export function podeLancar(ator: UsuarioAtual, responsavelId: string | null): boolean {
  if (!temPermissao(ator.papel, "planejamento:lancar")) return false;
  return podeEditar(ator) || responsavelId === ator.id;
}

export const hojeSp = () => diaEmSaoPaulo(new Date());
export const centavos = (d: { toNumber(): number }) => Math.round(d.toNumber() * 100);
export const reaisDe = (centavosValor: number) => (centavosValor / 100).toFixed(2);

export async function garantirPessoa(usuarioId: string | null) {
  if (!usuarioId) return;
  const u = await prisma.usuario.findFirst({ where: { id: usuarioId, ativo: true }, select: { id: true } });
  if (!u) throw new ErroNegocio("Pessoa não encontrada.");
}
