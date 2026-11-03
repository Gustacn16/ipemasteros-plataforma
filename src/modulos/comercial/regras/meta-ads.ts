// Regras da importação do Meta Ads (spec Meta Ads, seção 5). Sem rede nem banco.
import { somarDias } from "@/modulos/tarefas/regras/prazo";

/** Tipos de `actions` da Meta que contam como lead (spec 5.2). O agregado "lead" fica de fora para não contar em dobro. */
export const ACOES_LEAD = {
  formulario: "onsite_conversion.lead_grouped",
  site: "offsite_conversion.fb_pixel_lead",
  conversas: "onsite_conversion.messaging_conversation_started_7d",
} as const;

type Acao = { action_type: string; value: string };

export function lerLeads(actions: Acao[] | undefined): {
  leadsFormulario: number;
  leadsSite: number;
  conversasIniciadas: number;
  ignorados: string[];
} {
  const valor = (tipo: string) => (actions ?? []).filter((a) => a.action_type === tipo).reduce((s, a) => s + (Number(a.value) || 0), 0);
  const conhecidos = new Set<string>(Object.values(ACOES_LEAD));
  return {
    leadsFormulario: valor(ACOES_LEAD.formulario),
    leadsSite: valor(ACOES_LEAD.site),
    conversasIniciadas: valor(ACOES_LEAD.conversas),
    ignorados: [...new Set((actions ?? []).map((a) => a.action_type).filter((t) => !conhecidos.has(t)))],
  };
}

/** `spend` da Meta ("123.45") em centavos. */
export function centavosDoGasto(spend: string | undefined): number {
  return Math.round(Number(spend ?? 0) * 100) || 0;
}

/** Início do histórico importado na primeira carga. */
export const INICIO_HISTORICO = "2026-01-01";
const DIAS_POR_BLOCO = 30;
const DIAS_REFEITOS = 7;

/**
 * Períodos a importar até ontem: com dados, refaz os últimos 7 dias (a Meta ajusta
 * números retroativamente); sem dados, todo o histórico em blocos de até 30 dias.
 */
export function periodosImportacao(o: { temDados: boolean; hoje: string }): { desde: string; ate: string }[] {
  const ontem = somarDias(o.hoje, -1);
  if (o.temDados) return [{ desde: somarDias(o.hoje, -DIAS_REFEITOS), ate: ontem }];
  const blocos: { desde: string; ate: string }[] = [];
  for (let desde = INICIO_HISTORICO; desde <= ontem; desde = somarDias(desde, DIAS_POR_BLOCO)) {
    const fim = somarDias(desde, DIAS_POR_BLOCO - 1);
    blocos.push({ desde, ate: fim < ontem ? fim : ontem });
  }
  return blocos;
}

/** Erro da Graph API em português (spec 5.6). */
export function mensagemErroMeta(codigo: number | undefined, mensagem: string): string {
  if (codigo === 190) return "A chave de acesso da Meta é inválida ou foi revogada.";
  if (codigo === 10 || codigo === 200) return "A chave não tem permissão para ler esta conta.";
  if (codigo === 4 || codigo === 17 || codigo === 613 || codigo === 80004)
    return "A Meta limitou as consultas. Tente de novo em alguns minutos.";
  return `Erro da Meta: ${mensagem}`;
}

const LIMITE_EM_ANDAMENTO_MS = 30 * 60_000;

/** Uma importação por vez; a que está "em andamento" há mais de 30 minutos é considerada interrompida (spec 5.5). */
export function podeIniciarImportacao(emAndamento: { iniciadoEm: Date } | null, agora: Date): { pode: boolean; expirada: boolean } {
  if (!emAndamento) return { pode: true, expirada: false };
  const expirada = agora.getTime() - emAndamento.iniciadoEm.getTime() > LIMITE_EM_ANDAMENTO_MS;
  return { pode: expirada, expirada };
}

/** Se há uma importação rodando agora, para a tela se atualizar sozinha (some depois de 30 minutos). */
export function importacaoRodando(importacoes: { status: string; iniciadoEm: string }[], agora: Date): boolean {
  return importacoes.some((i) => i.status === "em_andamento" && agora.getTime() - Date.parse(i.iniciadoEm) < LIMITE_EM_ANDAMENTO_MS);
}
