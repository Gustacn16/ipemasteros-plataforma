"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { SENHA_MIN } from "@/lib/auth-config";

type Estado = { ok: boolean; mensagem?: string; erros?: Record<string, string[] | undefined> };

type Props = {
  acao: (estado: Estado, formData: FormData) => Promise<Estado>;
  rotuloBotao: string;
  nomeInicial?: string;
  /** Primeiro acesso: pede também o token e o e-mail do admin. */
  comTokenEEmail?: boolean;
  camposOcultos?: Record<string, string>;
};

/** Formulário de nome + senha usado no aceite de convite e no primeiro acesso. */
export function FormularioSenhaNova({ acao, rotuloBotao, nomeInicial, comTokenEEmail, camposOcultos }: Props) {
  const [estado, executar, pendente] = useActionState(acao, { ok: false });

  return (
    <form action={executar} className="grid gap-4">
      {estado.mensagem && (
        <Alert variant={estado.ok ? "default" : "destructive"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      {Object.entries(camposOcultos ?? {}).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}
      {comTokenEEmail && (
        <>
          <Campo
            rotulo="Token de primeiro acesso"
            name="token"
            autoComplete="off"
            ajuda="Valor de TOKEN_PRIMEIRO_ACESSO configurado no servidor."
            erros={estado.erros?.token}
            required
          />
          <Campo rotulo="E-mail" name="email" type="email" autoComplete="email" erros={estado.erros?.email} required />
        </>
      )}
      <Campo rotulo="Nome completo" name="nome" defaultValue={nomeInicial} autoComplete="name" erros={estado.erros?.nome} required />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        minLength={SENHA_MIN}
        ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
        erros={estado.erros?.senha}
        required
      />
      <Campo
        rotulo="Confirme a senha"
        name="confirmacao"
        type="password"
        autoComplete="new-password"
        erros={estado.erros?.confirmacao}
        required
      />
      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : rotuloBotao}
      </Button>
    </form>
  );
}
