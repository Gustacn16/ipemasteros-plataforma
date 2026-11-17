import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { importarMetaAds } from "@/modulos/comercial/servicos/importacao-meta";
import { atualizarInstagram } from "@/modulos/conteudo/servicos/atualizacao-instagram";
import { limparConversasAntigas } from "@/modulos/nexu/servicos/limpeza";

// Jobs agendados (docs/02-arquitetura.md): o cron da Hostinger chama
// GET /api/cron/<tarefa> com "Authorization: Bearer $CRON_SECRET".
export const dynamic = "force-dynamic";

const TAREFAS: Record<string, () => Promise<Record<string, unknown>>> = {
  "importar-meta-ads": async () => {
    const r = await importarMetaAds({ origem: "agendada" });
    // Retenção de 90 dias das conversas do Nexu. Falhar aqui não muda o resultado da importação.
    try {
      const apagadas = await limparConversasAntigas();
      console.error("[nexu] conversas antigas apagadas:", apagadas);
    } catch (e) {
      console.error("[nexu] falha na limpeza de conversas:", e instanceof Error ? e.name : "desconhecido");
    }
    // A mensagem de erro fica na tela da integração, não na resposta.
    return { ok: r.status === "concluida", status: r.status, registros: r.registros };
  },
  "importar-instagram": async () => {
    const r = await atualizarInstagram({ tipo: "completa", origem: "agendada" });
    return { ok: r.status === "concluida", status: r.status, registros: r.registros };
  },
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
