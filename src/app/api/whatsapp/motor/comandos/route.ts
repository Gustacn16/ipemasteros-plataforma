import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { entregarComandos } from "@/modulos/whatsapp/servicos/motor";

// O motor busca aqui os comandos pendentes (conectar, desconectar e, se declarar
// `?recursos=enviar_grupo`, os envios nos grupos).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!segredoValido(request.headers.get("authorization"), process.env.MOTOR_WHATSAPP_SEGREDO)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const recursos = (new URL(request.url).searchParams.get("recursos") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return NextResponse.json({ comandos: await entregarComandos(new Date(), { recursos }) });
}
