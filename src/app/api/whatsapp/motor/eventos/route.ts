import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { esquemaLoteEventos } from "@/modulos/whatsapp/esquemas/motor";
import { aplicarEventos } from "@/modulos/whatsapp/servicos/motor";

// O motor do WhatsApp manda QR, conexão, queda e sinal de vida para cá.
// Protegida por "Authorization: Bearer $MOTOR_WHATSAPP_SEGREDO".
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!segredoValido(request.headers.get("authorization"), process.env.MOTOR_WHATSAPP_SEGREDO)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const lote = esquemaLoteEventos.safeParse(corpo);
  if (!lote.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { aplicados, ignorados } = await aplicarEventos(lote.data.eventos);
  return NextResponse.json({ ok: true, aplicados, ignorados });
}
