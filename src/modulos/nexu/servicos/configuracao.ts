import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { inicioDoMesSaoPaulo } from "@/lib/ia/limites";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import type { DadosConfiguracaoIa } from "../esquemas/configuracao";

function exigirConfigurar(ator: UsuarioAtual) {
  if (!temPermissao(ator.papel, "nexu:configurar")) throw new ErroPermissao("nexu:configurar");
}

export type PainelUso = {
  gastoMesMicroUsd: number;
  limiteMensalMicroUsd: number;
  perguntasMes: number;
  porPessoa: { usuarioId: string; nome: string; perguntas: number; gastoMicroUsd: number }[];
  porDia: { dia: string; gastoMicroUsd: number }[];
};

/** Números de uso do mês (São Paulo). Lê só `UsoIa`: o conteúdo das conversas nunca passa por aqui. */
export async function obterPainelUso(ator: UsuarioAtual, agora: Date = new Date()): Promise<PainelUso> {
  exigirConfigurar(ator);
  const desde = inicioDoMesSaoPaulo(agora);
  const filtro = { criadoEm: { gte: desde } };

  const [config, grupos, linhas] = await Promise.all([
    obterConfiguracaoIa(),
    prisma.usoIa.groupBy({
      by: ["usuarioId"],
      where: filtro,
      _sum: { custoMicroUsd: true },
      _count: { _all: true },
    }),
    prisma.usoIa.findMany({ where: filtro, select: { criadoEm: true, custoMicroUsd: true } }),
  ]);

  const ids = grupos.map((g) => g.usuarioId).filter((id): id is string => id !== null);
  const usuarios = ids.length ? await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true } }) : [];
  const nomes = new Map(usuarios.map((u) => [u.id, u.nome]));

  // Perguntas = chamadas marcadas como início de pergunta; as demais são passos da mesma pergunta.
  const iniciosPorUsuario = await prisma.usoIa.groupBy({
    by: ["usuarioId"],
    where: { ...filtro, inicioPergunta: true },
    _count: { _all: true },
  });
  const perguntasDe = new Map(iniciosPorUsuario.map((g) => [g.usuarioId, g._count._all]));

  const porPessoa = grupos
    .map((g) => ({
      usuarioId: g.usuarioId ?? "",
      nome: g.usuarioId ? (nomes.get(g.usuarioId) ?? "Usuário removido") : "Sem usuário",
      perguntas: perguntasDe.get(g.usuarioId) ?? 0,
      gastoMicroUsd: g._sum.custoMicroUsd ?? 0,
    }))
    .sort((a, b) => b.gastoMicroUsd - a.gastoMicroUsd);

  const gastoPorDia = new Map<string, number>();
  for (const l of linhas) {
    const dia = diaEmSaoPaulo(l.criadoEm);
    gastoPorDia.set(dia, (gastoPorDia.get(dia) ?? 0) + l.custoMicroUsd);
  }
  const porDia = [...gastoPorDia.entries()]
    .map(([dia, gastoMicroUsd]) => ({ dia, gastoMicroUsd }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  return {
    gastoMesMicroUsd: porPessoa.reduce((s, p) => s + p.gastoMicroUsd, 0),
    limiteMensalMicroUsd: config.limiteMensalMicroUsd,
    perguntasMes: porPessoa.reduce((s, p) => s + p.perguntas, 0),
    porPessoa,
    porDia,
  };
}

/** Grava a configuração única da IA e registra o antes/depois na auditoria. */
export async function salvarConfiguracao(ator: UsuarioAtual, dados: DadosConfiguracaoIa) {
  exigirConfigurar(ator);
  const antes = await obterConfiguracaoIa();
  await prisma.configuracaoIa.upsert({
    where: { id: "unica" },
    create: { id: "unica", ...dados, atualizadoPorId: ator.id },
    update: { ...dados, atualizadoPorId: ator.id },
  });
  await registrarAuditoria({
    usuarioId: ator.id,
    acao: "nexu.configuracao_alterada",
    entidade: "ConfiguracaoIa",
    entidadeId: "unica",
    diff: { antes, depois: dados },
  });
}
