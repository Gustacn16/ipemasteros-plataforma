"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { authClient } from "@/lib/auth-client";
import { CABECALHO_ESPERA, mensagemMuitasTentativas, segundosDoCabecalho } from "@/modulos/core/regras/mensagem-limite";

export function FormularioLogin() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    setErro(null);
    setEnviando(true);
    let espera: number | null = null;
    const { error } = await authClient.signIn.email(
      {
        email: String(form.get("email") ?? "").trim().toLowerCase(),
        password: String(form.get("senha") ?? ""),
      },
      { onError: ({ response }) => void (espera = segundosDoCabecalho(response.headers.get(CABECALHO_ESPERA))) },
    );
    setEnviando(false);
    if (error) {
      setErro(
        error.status === 429
          ? mensagemMuitasTentativas(espera)
          : "E-mail ou senha incorretos, ou acesso desativado.",
      );
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <form onSubmit={entrar} className="grid gap-4">
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
      <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
      <Link href="/recuperar-senha" className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline">
        Esqueci minha senha
      </Link>
    </form>
  );
}
