import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: só olha se existe cookie de sessão, para redirecionar
// rápido ao login. A validação de verdade acontece no servidor (src/lib/sessao.ts).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Área logada. Rotas públicas (login, convite, presença...) ficam de fora.
  matcher: ["/inicio/:path*", "/admin/:path*", "/perfil/:path*"],
};
