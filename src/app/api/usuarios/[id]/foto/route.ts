import { obterUsuarioAtual } from "@/lib/sessao";
import { obterFoto } from "@/modulos/core/servicos/perfil";

/** Foto de perfil. Só para quem está logado: é dado pessoal e não fica pública. */
export async function GET(_: Request, { params }: RouteContext<"/api/usuarios/[id]/foto">) {
  if (!(await obterUsuarioAtual())) return new Response(null, { status: 401 });
  const { id } = await params;
  const foto = await obterFoto(id);
  if (!foto) return new Response(null, { status: 404 });
  return new Response(foto.dados, {
    headers: {
      "Content-Type": foto.tipo,
      // A URL muda (?v=) a cada nova foto, então o navegador pode guardar por bastante tempo.
      "Cache-Control": "private, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
