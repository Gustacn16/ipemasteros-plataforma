import { gerarIcs } from "@/modulos/agenda/regras/ics";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { usuarioDoToken } from "@/modulos/agenda/servicos/assinatura";
import { eventosDoFeed } from "@/modulos/agenda/servicos/feed";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";

export const dynamic = "force-dynamic";

const NAO_ENCONTRADO = () => new Response(null, { status: 404 });

/**
 * Feed .ics do calendário institucional (spec da Agenda, regra 7).
 * A autenticação é o token na URL: não há sessão e nada disso vai para log.
 */
export async function GET(_: Request, { params }: RouteContext<"/api/agenda/assinatura/[arquivo]">) {
  const { arquivo } = await params;
  if (!arquivo.endsWith(".ics")) return NAO_ENCONTRADO();
  const usuario = await usuarioDoToken(arquivo.slice(0, -".ics".length));
  if (!usuario || !podeVerInstitucional(usuario.papel)) return NAO_ENCONTRADO();

  const agora = new Date();
  const hoje = diaEmSaoPaulo(agora);
  const eventos = await eventosDoFeed(usuario.papel, somarDias(hoje, -90), somarDias(hoje, 365));
  return new Response(gerarIcs(eventos, agora), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
