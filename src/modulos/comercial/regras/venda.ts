// Regras da venda (spec Comercial, seção 5). Dinheiro em centavos inteiros para
// não perder precisão; entra e sai como string decimal ("1234.56").
import { temPermissao, type Papel } from "@/lib/permissoes";

/** Dias que o vendedor tem para editar ou excluir a própria venda (regra 6). */
export const PRAZO_EDICAO_DIAS = 7;

const centavos = (valor: string) => Math.round(Number(valor) * 100);
const reais = (c: number) => (c / 100).toFixed(2);

/** Entrada + parcelas × valor da parcela (regra 1). */
export function valorTotal(entrada: string, numeroParcelas: number, valorParcela: string): string {
  return reais(centavos(entrada) + numeroParcelas * centavos(valorParcela));
}

type Oferta = { precoCheio: string; matricula: string; parcelas: number; valorParcela: string };

/**
 * Campos de pagamento a partir da oferta (regra 2). À vista, a entrada é o preço
 * inteiro. Sem valor de parcela na oferta, divide (preço − matrícula) pelas parcelas.
 */
export function preencherPelaOferta(o: Oferta): { entrada: string; numeroParcelas: number; valorParcela: string } {
  if (o.parcelas === 0) return { entrada: reais(centavos(o.precoCheio)), numeroParcelas: 0, valorParcela: "0.00" };
  const parcela =
    centavos(o.valorParcela) > 0 ? centavos(o.valorParcela) : Math.round((centavos(o.precoCheio) - centavos(o.matricula)) / o.parcelas);
  return { entrada: reais(centavos(o.matricula)), numeroParcelas: o.parcelas, valorParcela: reais(Math.max(parcela, 0)) };
}

type Ator = { id: string; papel: Papel };

/** Admin e gestor editam qualquer venda; o vendedor, só a própria e por até 7 dias (regra 6). */
export function podeEditarVenda(ator: Ator, venda: { vendedorId: string; criadoEm: Date }, agora: Date): boolean {
  if (temPermissao(ator.papel, "comercial:gerenciar_vendas")) return true;
  if (!temPermissao(ator.papel, "comercial:registrar_venda") || venda.vendedorId !== ator.id) return false;
  return agora.getTime() - venda.criadoEm.getTime() <= PRAZO_EDICAO_DIAS * 86_400_000;
}

/** Quem não gerencia vendas só registra vendas em seu próprio nome. */
export function vendedorPermitido(ator: Ator, vendedorId: string): boolean {
  return temPermissao(ator.papel, "comercial:gerenciar_vendas") || vendedorId === ator.id;
}
