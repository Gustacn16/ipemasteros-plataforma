import { NextResponse } from "next/server";
import { segredoValido } from "@/lib/cron";
import { esquemaResultadoComando } from "@/modulos/whatsapp/esquemas/motor";
import { concluirComando } from "@/modulos/whatsapp/servicos/motor";

// O motor informa aqui se o comando deu certo ou falhou.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/whatsapp/motor/comandos/[id]">,
) {
  if (!segredoValido(request.headers.get("authorization"), process.env.MOTOR_WHATSAPP_SEGREDO)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const resultado = esquemaResultadoComando.safeParse(corpo);
  if (!resultado.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { id } = await params;
  const existe = await concluirComando(id, resultado.data);
  if (!existe) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true });
}
