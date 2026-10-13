"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { authClient } from "@/lib/auth-client";

export default function PaginaRecuperarSenha() {
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const email = String(new FormData(evento.currentTarget).get("email") ?? "").trim().toLowerCase();
    setEnviando(true);
    // A resposta é a mesma exista ou não o e-mail, para não revelar quem tem conta.
    await authClient.requestPasswordReset({ email, redirectTo: "/redefinir-senha" });
    setEnviando(false);
    setEnviado(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Enviaremos um link para criar uma nova senha.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {enviado ? (
          <Alert>
            <AlertDescription>
              Se este e-mail tiver acesso ao sistema, você vai receber um link em instantes. O link vale por 1 hora.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={enviar} className="grid gap-4">
            <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" required />
            <Button type="submit" disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        )}
        <Link href="/login" className="text-muted-foreground text-center text-sm underline-offset-4 hover:underline">
          Voltar ao login
        </Link>
      </CardContent>
    </Card>
  );
}
