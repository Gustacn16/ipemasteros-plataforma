import "server-only";
import { ErroPermissao, temPermissao, type Permissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";

export const MENSAGEM_NAO_ENCONTRADO = "Documento não encontrado.";

export function exigir(ator: UsuarioAtual, permissao: Permissao) {
  if (!temPermissao(ator.papel, permissao)) throw new ErroPermissao(permissao);
}

export const podeEditar = (ator: UsuarioAtual) => temPermissao(ator.papel, "processos:editar");

/** Gestão lança qualquer indicador; quem lê lança os indicadores em que é responsável. */
export function podeLancarMedicao(ator: UsuarioAtual, responsavelId: string | null): boolean {
  if (temPermissao(ator.papel, "processos:registrar_medicao")) return true;
  return temPermissao(ator.papel, "processos:ver") && responsavelId === ator.id;
}

export const paraDia = (d: string) => new Date(`${d}T00:00:00.000Z`);
export const deDia = (d: Date) => d.toISOString().slice(0, 10);
export const numeroOuNulo = (d: { toNumber(): number } | null) => (d === null ? null : d.toNumber());
