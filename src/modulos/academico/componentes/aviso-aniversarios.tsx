import "server-only";
import { temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { proximosAniversarios } from "../regras/aniversarios";
import { listarPessoasComNascimento } from "../servicos/aniversarios";
import { CartaoAniversariantes } from "./aniversariantes";

/** Dias à frente: dá tempo de comprar o presente. */
export const DIAS_AVISO_ANIVERSARIO = 7;

/** Cartão do Início e de Minhas tarefas; some para quem não vê o Acadêmico ou se ninguém faz aniversário. */
export async function AvisoAniversarios({ usuario }: { usuario: UsuarioAtual }) {
  if (!temPermissao(usuario.papel, "academico:ver")) return null;
  const itens = proximosAniversarios(await listarPessoasComNascimento(usuario), diaEmSaoPaulo(new Date()), DIAS_AVISO_ANIVERSARIO);
  return <CartaoAniversariantes titulo={`Aniversários dos próximos ${DIAS_AVISO_ANIVERSARIO} dias`} itens={itens} />;
}
