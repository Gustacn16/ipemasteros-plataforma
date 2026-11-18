import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { UsuarioAtual } from "@/lib/sessao";
import { lerExportacao } from "../importacao-lovable/ler";
import { PREFIXO, chaveMeta, planejarImportacao, type Plano } from "../importacao-lovable/planejar";
import { precoDoProduto } from "../regras/meta";
import { exigirPermissaoComercial } from "./acesso";

// Importação do histórico comercial da plataforma antiga (Lovable). Lê o
// `dados-comerciais.json` da exportação. A tela só recebe contagens e nomes
// de vendedores (equipe), nunca nome ou WhatsApp de cliente.

const PERMISSAO = "comercial:importar_historico" as const;
const paraData = (dia: string) => new Date(`${dia}T00:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);

function lerArquivo(texto: string) {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new ErroNegocio("O arquivo não é um JSON válido.");
  }
  const lido = lerExportacao(json);
  if (!lido.ok) throw new ErroNegocio(lido.erro);
  return lido.dados;
}

type Cliente = Pick<typeof prisma, "produto" | "usuario" | "canalVenda" | "venda" | "metaVenda">;

async function contexto(db: Cliente) {
  const [produtos, usuarios, canais, vendas, metas] = await Promise.all([
    db.produto.findMany({
      select: { id: true, nome: true, excluidoEm: true, ofertas: { select: { padrao: true, ordem: true, precoCheio: true } } },
    }),
    db.usuario.findMany({ select: { id: true, nome: true, apelido: true } }),
    db.canalVenda.findMany({ select: { id: true, nome: true } }),
    // Inclui as excluídas: venda importada e depois excluída na tela não volta.
    db.venda.findMany({ select: { id: true, produtoId: true, dataVenda: true, nomeCliente: true, excluidoEm: true } }),
    db.metaVenda.findMany({ select: { id: true, mes: true, produtoId: true, vendedorId: true } }),
  ]);
  return {
    produtos: produtos.map(({ id, nome, excluidoEm }) => ({ id, nome, excluido: excluidoEm !== null })),
    usuarios,
    canais,
    idsVendasImportadas: new Set(vendas.filter((v) => v.id.startsWith(PREFIXO)).map((v) => v.id)),
    vendasDoSistema: vendas
      .filter((v) => !v.id.startsWith(PREFIXO) && !v.excluidoEm)
      .map((v) => ({ produtoId: v.produtoId, dataVenda: paraDia(v.dataVenda), nomeCliente: v.nomeCliente })),
    chavesMetas: new Set(metas.map((m) => chaveMeta(paraDia(m.mes), m.produtoId, m.vendedorId))),
    idsMetasImportadas: new Set(metas.filter((m) => m.id.startsWith(PREFIXO)).map((m) => m.id)),
    precoPorProduto: Object.fromEntries(
      produtos.map((p) => [p.id, precoDoProduto(p.ofertas.map((o) => ({ ...o, precoCheio: o.precoCheio.toFixed(2) })))]),
    ),
  };
}

export type ResumoImportacao = {
  erros: string[];
  avisos: string[];
  contagens: Plano["contagens"];
  vendasNovas: number;
  valorNovo: string;
  metasNovas: number;
  canaisNovos: string[];
  produtosRestaurados: string[];
  vendedores: { nomeAntigo: string; nomeNovo: string; novo: boolean }[];
  porMes: { mes: string; vendas: number; valor: string }[];
};

function resumir(plano: Plano): ResumoImportacao {
  const porMes = new Map<string, { vendas: number; centavos: number }>();
  let total = 0;
  for (const v of plano.vendas) {
    const c = Math.round(Number(v.valorTotal) * 100);
    total += c;
    const mes = v.dataVenda.slice(0, 7);
    const atual = porMes.get(mes) ?? { vendas: 0, centavos: 0 };
    porMes.set(mes, { vendas: atual.vendas + 1, centavos: atual.centavos + c });
  }
  return {
    erros: plano.erros,
    avisos: plano.avisos,
    contagens: plano.contagens,
    vendasNovas: plano.vendas.length,
    valorNovo: (total / 100).toFixed(2),
    metasNovas: plano.metas.length,
    canaisNovos: plano.canaisNovos.map((c) => c.nome),
    produtosRestaurados: plano.produtosRestaurar.map((p) => p.nome),
    vendedores: plano.vendedores.map(({ nomeAntigo, nomeNovo, novo }) => ({ nomeAntigo, nomeNovo, novo })),
    porMes: [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, x]) => ({ mes, vendas: x.vendas, valor: (x.centavos / 100).toFixed(2) })),
  };
}

/** Prévia: nada é gravado. */
export async function analisarHistorico(ator: UsuarioAtual, texto: string): Promise<ResumoImportacao> {
  exigirPermissaoComercial(ator, PERMISSAO);
  const dados = lerArquivo(texto);
  return resumir(planejarImportacao(dados, await contexto(prisma)));
}

/** Grava tudo numa transação, ou nada. Rodar de novo só cria o que ainda falta. */
export async function importarHistorico(ator: UsuarioAtual, texto: string): Promise<ResumoImportacao> {
  exigirPermissaoComercial(ator, PERMISSAO);
  const dados = lerArquivo(texto);
  return prisma.$transaction(
    async (tx) => {
      const plano = planejarImportacao(dados, await contexto(tx));
      if (plano.erros.length > 0) throw new ErroNegocio(`Nada foi importado: ${plano.erros[0]}`);

      if (plano.produtosRestaurar.length > 0) {
        // Produto com venda não pode ficar excluído (regra 3): volta inativo, fora dos campos de escolha.
        await tx.produto.updateMany({
          where: { id: { in: plano.produtosRestaurar.map((p) => p.id) } },
          data: { excluidoEm: null, ativo: false },
        });
      }
      const novos = plano.vendedores.filter((v) => v.novo);
      if (novos.length > 0) {
        // Vendedor que só existia na plataforma antiga: fica inativo, sem senha e sem acesso.
        await tx.usuario.createMany({
          data: novos.map((v) => ({
            id: v.id,
            nome: v.nomeNovo.slice(0, 150),
            email: `${v.id}@historico.invalid`,
            papel: "comercial" as const,
            ativo: false,
            cargo: "Vendedor (plataforma antiga)",
          })),
          skipDuplicates: true,
        });
      }
      if (plano.canaisNovos.length > 0) {
        const ultima = await tx.canalVenda.aggregate({ _max: { ordem: true } });
        await tx.canalVenda.createMany({
          data: plano.canaisNovos.map((c, i) => ({ id: c.id, nome: c.nome, ordem: (ultima._max.ordem ?? 0) + i + 1 })),
          skipDuplicates: true,
        });
      }
      if (plano.vendas.length > 0) {
        await tx.venda.createMany({
          data: plano.vendas.map((v) => ({
            ...v,
            dataVenda: paraData(v.dataVenda),
            dataEntradaLead: v.dataEntradaLead ? paraData(v.dataEntradaLead) : null,
            dataEntrega: v.dataEntrega ? paraData(v.dataEntrega) : null,
            primeiroVencimento: v.primeiroVencimento ? paraData(v.primeiroVencimento) : null,
          })),
          skipDuplicates: true,
        });
      }
      if (plano.metas.length > 0) {
        await tx.metaVenda.createMany({ data: plano.metas.map((m) => ({ ...m, mes: paraData(m.mes) })), skipDuplicates: true });
      }

      const resumo = resumir(plano);
      await registrarAuditoria(
        {
          usuarioId: ator.id,
          acao: "vendas.importadas",
          entidade: "Venda",
          diff: {
            origem: "lovable",
            vendas: resumo.vendasNovas,
            valorTotal: resumo.valorNovo,
            metas: resumo.metasNovas,
            vendedoresNovos: novos.length,
            canaisNovos: plano.canaisNovos.length,
            produtosRestaurados: plano.produtosRestaurar.length,
          },
        },
        tx,
      );
      return resumo;
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}
