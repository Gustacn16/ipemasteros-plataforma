import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { importarMetaAds } from "@/modulos/comercial/servicos/importacao-meta";
import { atualizarInstagram } from "@/modulos/conteudo/servicos/atualizacao-instagram";
import { recalcularMetricas } from "@/modulos/whatsapp/servicos/metricas";
import { limparWhatsapp } from "@/modulos/whatsapp/servicos/limpeza";
import { coletarLotes, criarLoteDoDia } from "@/modulos/whatsapp/servicos/lote-ia";
import { limparConversasAntigas } from "@/modulos/nexu/servicos/limpeza";
import { iniciarColeta } from "@/modulos/espiao/servicos/coleta";
import { limparEspiaoAntigo } from "@/modulos/espiao/servicos/limpeza";

// Jobs agendados (docs/02-arquitetura.md): o cron da Hostinger chama
// GET /api/cron/<tarefa> com "Authorization: Bearer $CRON_SECRET".
export const dynamic = "force-dynamic";

/** Retenção de 90 dias das conversas do Nexu. Nunca lança: falhar aqui não muda o resultado da importação. */
async function limparConversasNexu(): Promise<void> {
  try {
    const apagadas = await limparConversasAntigas();
    console.info("[nexu] conversas antigas apagadas:", apagadas);
  } catch (e) {
    console.error("[nexu] falha na limpeza de conversas:", e instanceof Error ? e.name : "desconhecido");
  }
}

const TAREFAS: Record<string, () => Promise<Record<string, unknown>>> = {
  "importar-meta-ads": async () => {
    try {
      const r = await importarMetaAds({ origem: "agendada" });
      // A mensagem de erro fica na tela da integração, não na resposta.
      return { ok: r.status === "concluida", status: r.status, registros: r.registros };
    } finally {
      // Roda mesmo se a importação lançar: a limpeza pega carona neste cron diário.
      await limparConversasNexu();
    }
  },
  "importar-instagram": async () => {
    const r = await atualizarInstagram({ tipo: "completa", origem: "agendada" });
    return { ok: r.status === "concluida", status: r.status, registros: r.registros };
  },
  "limpar-whatsapp": async () => {
    // Só contagens na resposta: nada de mensagem, telefone ou nome.
    const r = await limparWhatsapp();
    return {
      ok: true,
      provisorias: r.provisorias,
      antigas: r.antigas,
      metricasAntigas: r.metricasAntigas,
      religados: r.religados,
      conversasVazias: r.conversasVazias,
      contatosVazios: r.contatosVazios,
    };
  },
  espiao: async () => {
    try {
      // Só inicia: a coleta roda em segundo plano no processo Node (spec do espião, D10).
      const r = await iniciarColeta({ origem: "agendada", usuarioId: null });
      return { ok: true, iniciou: r.iniciou, motivo: r.motivo ?? null };
    } finally {
      // Retenção de 18 meses; nunca lança.
      await limparEspiaoAntigo()
        .then((r) => console.info("[espiao] limpeza:", r))
        .catch((e) => console.error("[espiao] falha na limpeza:", e instanceof Error ? e.name : "desconhecido"));
    }
  },
  // Só contagens na resposta.
  "metricas-whatsapp": async () => ({ ok: true, ...(await recalcularMetricas()) }),
  "ia-whatsapp": async () => ({ ok: true, ...(await criarLoteDoDia()) }),
  "coletar-ia-whatsapp": async () => ({ ok: true, ...(await coletarLotes()) }),
  "importar-stories-instagram": async () => {
    const r = await atualizarInstagram({ tipo: "stories", origem: "agendada" });
    return { ok: r.status === "concluida", status: r.status, registros: r.registros };
  },
};

export async function GET(request: Request, { params }: RouteContext<"/api/cron/[tarefa]">) {
  if (!segredoValido(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { tarefa } = await params;
  const executar = TAREFAS[tarefa];
  if (!executar) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(await executar());
}
