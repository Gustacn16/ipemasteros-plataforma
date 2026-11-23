import "server-only";
import type { UsuarioAtual } from "@/lib/sessao";
import { anoPadrao, mesDoDia } from "../regras/meses";
import { hojeSp } from "../servicos/acesso";
import { listarAnos } from "../servicos/planos";

type Busca = Record<string, string | string[] | undefined>;

/** Ano e mês da URL (`?ano=2027&mes=2027-03`), com padrões sensatos. */
export async function lerAnoMes(ator: UsuarioAtual, busca: Busca) {
  const anos = await listarAnos(ator);
  const hoje = hojeSp();
  const anoUrl = Number(busca.ano);
  const ano = Number.isInteger(anoUrl) && anoUrl >= 2020 && anoUrl <= 2100 ? anoUrl : anoPadrao(anos, hoje);
  const atual = mesDoDia(hoje);
  const padrao = atual.startsWith(`${ano}-`) ? atual : Number(atual.slice(0, 4)) > ano ? `${ano}-12` : `${ano}-01`;
  const mesUrl = typeof busca.mes === "string" ? busca.mes : "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesUrl) && mesUrl.startsWith(`${ano}-`) ? mesUrl : padrao;
  return { ano, mes, anos, temPlano: anos.includes(ano) };
}
