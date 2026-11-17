import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { entregarComandos } from "@/modulos/whatsapp/servicos/motor";

// O motor busca aqui os comandos pendentes (conectar, desconectar).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!segredoValido(request.headers.get("authorization"), process.env.MOTOR_WHATSAPP_SEGREDO)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ comandos: await entregarComandos() });
}
