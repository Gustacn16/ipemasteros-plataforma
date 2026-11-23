// Aviso de venda nova para o grupo do C.S, enviado ao webhook do Make no mesmo
// formato da plataforma antiga: { "value": "<JSON em texto>" }. O JSON traz um
// campo por linha da mensagem e a "Mensagem" pronta.

export type TipoProdutoAviso = "curso_livre" | "paciente_modelo" | "pos_graduacao";
export type MetodoAviso = "pix" | "cartao" | "boleto" | "transferencia";

export type VendaParaAviso = {
  produtoNome: string;
  produtoTipo: TipoProdutoAviso;
  canalNome: string | null;
  /** "AAAA-MM-DD". */
  dataEntradaLead: string | null;
  dataVenda: string;
  vendedorNome: string;
  /** Em reais, "7800.00". */
  valorTotal: string;
  entrada: string;
  numeroParcelas: number;
  valorParcela: string;
  metodoPagamento: MetodoAviso;
  nomeCliente: string;
  /** Só dígitos, sem o 55. */
  whatsappCliente: string | null;
  dataEntrega: string | null;
  observacoes: string | null;
  proximosPassos: string | null;
};

const ROTULO_METODO: Record<MetodoAviso, string> = {
  pix: "Pix",
  cartao: "Cartão de crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const formatoReais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (v: string) => formatoReais.format(Number(v)).replace(/ /g, " ");

/** "62999047439" → "+55 62 99904-7439". Fora do padrão, devolve os dígitos com +55. */
export function whatsappLegivel(digitos: string | null): string {
  if (!digitos) return "";
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : `+55 ${digitos}`;
}

export function titulo(tipo: TipoProdutoAviso): string {
  return tipo === "paciente_modelo" ? "VENDA DE PACIENTE MODELO" : "VENDA DE PÓS/CURSO";
}

/** "12x de R$ 650,00", ou "À vista" sem parcelas. */
export function mensalidades(v: Pick<VendaParaAviso, "numeroParcelas" | "valorParcela">): string {
  return v.numeroParcelas > 0 ? `${v.numeroParcelas}x de ${reais(v.valorParcela)}` : "À vista";
}

export function montarAvisoVenda(v: VendaParaAviso): { value: string } {
  const campos = {
    Tipo: titulo(v.produtoTipo),
    Curso: v.produtoNome,
    Canal: v.canalNome ?? "",
    "Data de primeiro contato": v.dataEntradaLead ?? "",
    "Data da venda": v.dataVenda,
    Vendedor: v.vendedorNome,
    Valor: reais(v.valorTotal),
    "Forma de pagamento": ROTULO_METODO[v.metodoPagamento],
    Nome: v.nomeCliente,
    Wpp: whatsappLegivel(v.whatsappCliente),
    "Iniciará em": v.dataEntrega ?? "",
    Observações: v.observacoes ?? "",
    Entrada: Number(v.entrada) > 0 ? reais(v.entrada) : "",
    Mensalidades: mensalidades(v),
    "Próximas ações": v.proximosPassos ?? "",
  };
  const linhas = [
    `${campos.Tipo} 🔔🔔🔔🔔🔔🔔`,
    "",
    `Curso: ${campos.Curso}`,
    `Canal: ${campos.Canal}`,
    `Data de primeiro contato: ${campos["Data de primeiro contato"]}`,
    "",
    `Vendedor: ${campos.Vendedor}`,
    `Valor: ${campos.Valor}`,
    `Forma de pagamento: ${campos["Forma de pagamento"]}`,
    "",
    "Informações do comprador:",
    `Nome: ${campos.Nome}`,
    `Wpp: ${campos.Wpp}`,
    `Iniciará em: ${campos["Iniciará em"]}`,
    `Observações: ${campos.Observações}`,
    ...(campos.Entrada ? [`Entrada: ${campos.Entrada}`] : []),
    `Mensalidades: ${campos.Mensalidades}`,
    "",
    `Próximas ações: ${campos["Próximas ações"]}`,
  ];
  return { value: JSON.stringify({ ...campos, Mensagem: linhas.join("\n") }) };
}

/**
 * Só aceita o webhook do Make (https://hook.<região>.make.com/...), para o
 * servidor nunca ser usado para chamar outro endereço.
 */
export function webhookValido(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && /^hook\.[a-z0-9-]+\.make\.com$/.test(u.hostname) && u.pathname.length > 1 && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** "https://hook.us2.make.com/aufq…ntx8" → "hook.us2.make.com/…ntx8", para mostrar sem expor o link. */
export function webhookMascarado(url: string): string {
  const u = new URL(url);
  return `${u.hostname}/…${u.pathname.slice(-4)}`;
}
