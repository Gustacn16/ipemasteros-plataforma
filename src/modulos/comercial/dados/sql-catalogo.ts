// Gera o SQL da migration de dados do catálogo (spec Comercial, seção 9).
// INSERT IGNORE com ids fixos: rodar de novo não duplica nem sobrescreve.
// Imports relativos: roda via `npx tsx scripts/gerar-sql-catalogo.ts`, fora do Next.
import { CANAIS_INICIAIS, CATALOGO_PRODUTOS } from "./catalogo-produtos";

/** Literal de texto do MySQL, ou NULL. */
export function sqlTexto(valor: string | null): string {
  if (valor === null) return "NULL";
  const escapado = valor.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  return `'${escapado}'`;
}

const sqlValor = (v: string | number | boolean | null): string => {
  if (v === null) return "NULL";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return sqlTexto(v);
};

function inserir(tabela: string, linhas: Record<string, string | number | boolean | null>[]): string {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]!);
  const valores = linhas.map((l) => `  (${colunas.map((c) => sqlValor(l[c]!)).join(", ")}, CURRENT_TIMESTAMP(3))`);
  return `INSERT IGNORE INTO \`${tabela}\` (${colunas.map((c) => `\`${c}\``).join(", ")}, \`atualizado_em\`) VALUES\n${valores.join(",\n")};\n`;
}

export function gerarSqlCatalogo(): string {
  const produtos = CATALOGO_PRODUTOS.map((p) => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    area: p.area,
    sku: p.sku,
    ativo: p.ativo,
    duracao_meses: p.duracaoMeses,
    recorrente: p.recorrente,
    responsavel_pedagogico: p.responsavelPedagogico,
    corpo_docente: p.corpoDocente,
    carga_teorica_presencial: p.cargaTeoricaPresencial,
    carga_teorica_sincrona: p.cargaTeoricaSincrona,
    carga_teorica_assincrona: p.cargaTeoricaAssincrona,
    carga_pratica: p.cargaPratica,
    carga_extra: p.cargaExtra,
    comissao_tipo: p.comissaoTipo,
    comissao_base: p.comissaoBase,
    comissao_bonus: p.comissaoBonus,
    descricao: p.descricao,
    ementa: p.ementa,
    observacoes: p.observacoes,
  }));
  const ofertas = CATALOGO_PRODUTOS.flatMap((p) =>
    p.ofertas.map((o, i) => ({
      id: o.id,
      produto_id: p.id,
      nome: o.nome,
      padrao: o.padrao,
      preco_cheio: o.precoCheio,
      matricula: o.matricula,
      parcelas: o.parcelas,
      valor_parcela: o.valorParcela,
      desconto_pontualidade_pct: o.descontoPontualidadePct,
      formas_pagamento: JSON.stringify(o.formasPagamento),
      link: o.link,
      ordem: i + 1,
    })),
  );
  const links = CATALOGO_PRODUTOS.flatMap((p) =>
    p.links.map((l, i) => ({ id: l.id, produto_id: p.id, titulo: l.titulo, url: l.url, categoria: l.categoria, ordem: i + 1 })),
  );
  const canais = CANAIS_INICIAIS.map((nome, i) => ({
    id: `canal_${nome.normalize("NFKD").replace(/[^\w]/g, "").toLowerCase()}`,
    nome,
    ativo: true,
    ordem: i + 1,
  }));

  return [
    "-- Catálogo de produtos da IPEMaster e canais de venda iniciais.",
    "-- Gerado por scripts/gerar-sql-catalogo.ts a partir de src/modulos/comercial/dados/catalogo-produtos.ts. Não editar à mão.",
    "",
    inserir("produtos", produtos),
    inserir("ofertas_produto", ofertas),
    inserir("links_produto", links),
    inserir("canais_venda", canais),
  ].join("\n");
}
