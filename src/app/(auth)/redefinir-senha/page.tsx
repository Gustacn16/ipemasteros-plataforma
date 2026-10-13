"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { SENHA_MIN } from "@/lib/auth-config";
import { authClient } from "@/lib/auth-client";

function FormularioRedefinir() {
  const router = useRouter();
  const parametros = useSearchParams();
  const token = parametros.get("token");
  const linkInvalido = !token || parametros.get("error") === "INVALID_TOKEN";
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function redefinir(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    const senha = String(form.get("senha") ?? "");
    if (senha !== form.get("confirmacao")) {
      setErro("As senhas não conferem.");
      return;
    }
    setErro(null);
    setEnviando(true);
    const { error } = await authClient.resetPassword({ newPassword: senha, token: token! });
    setEnviando(false);
    if (error) {
      setErro("Não foi possível redefinir. O link pode ter expirado; peça um novo.");
      return;
    }
    router.replace("/login?senha=redefinida");
  }

  if (linkInvalido) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Link inválido ou expirado. <Link href="/recuperar-senha" className="underline">Peça um novo link</Link>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={redefinir} className="grid gap-4">
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        minLength={SENHA_MIN}
        ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
        required
      />
      <Campo rotulo="Confirme a nova senha" name="confirmacao" type="password" autoComplete="new-password" required />
      <Button type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}

export default function PaginaRedefinirSenha() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
        <CardDescription>Depois de salvar, entre com a nova senha.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense>
          <FormularioRedefinir />
        </Suspense>
      </CardContent>
    </Card>
  );
}
