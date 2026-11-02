"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { SENHA_MIN } from "@/lib/auth-config";
import { CampoFoto } from "./campo-foto";

type Estado = { ok: boolean; mensagem?: string; erros?: Record<string, string[] | undefined> };

type Props = {
  acao: (estado: Estado, formData: FormData) => Promise<Estado>;
  rotuloBotao: string;
  nomeInicial?: string;
  /** Convite: pede também a senha. */
  comSenha?: boolean;
  camposOcultos?: Record<string, string>;
};

/** Cadastro obrigatório: dados básicos + foto (e a senha, quando vem do convite). */
export function FormularioCadastro({ acao, rotuloBotao, nomeInicial, comSenha, camposOcultos }: Props) {
  const [estado, executar, pendente] = useActionState(acao, { ok: false });
  const [, iniciar] = useTransition();
  const [foto, setFoto] = useState<File | null>(null);
  const [semFoto, setSemFoto] = useState(false);
  const erros = estado.erros ?? {};

  // Envio manual (sem o reset automático do <form action>), para não perder o que já foi digitado nem a foto se algo falhar.
  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!foto) return setSemFoto(true);
    const dados = new FormData(e.currentTarget);
    dados.set("foto", foto);
    iniciar(() => executar(dados));
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      {estado.mensagem && (
        <Alert variant={estado.ok ? "default" : "destructive"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      {Object.entries(camposOcultos ?? {}).map(([nome, valor]) => (
        <input key={nome} type="hidden" name={nome} value={valor} />
      ))}

      <CampoFoto
        foto={foto}
        aoMudar={(f) => {
          setFoto(f);
          setSemFoto(false);
        }}
        erro={semFoto ? "Adicione uma foto para continuar." : undefined}
      />
      <Campo rotulo="Nome completo" name="nome" defaultValue={nomeInicial} autoComplete="name" erros={erros.nome} required maxLength={150} />
      <Campo
        rotulo="Como prefere ser chamado(a)"
        name="apelido"
        autoComplete="nickname"
        placeholder="Ex.: Ana"
        ajuda="Aparece no menu e nas tarefas."
        erros={erros.apelido}
        required
        maxLength={40}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          rotulo="WhatsApp"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(61) 99999-0000"
          erros={erros.whatsapp}
          required
          maxLength={20}
        />
        <Campo rotulo="Data de nascimento" name="dataNascimento" type="date" autoComplete="bday" erros={erros.dataNascimento} required />
      </div>
      <Campo rotulo="Cargo ou função" name="cargo" autoComplete="organization-title" placeholder="Ex.: Social media" erros={erros.cargo} required maxLength={80} />

      {comSenha && (
        <>
          <Campo
            rotulo="Senha"
            name="senha"
            type="password"
            autoComplete="new-password"
            minLength={SENHA_MIN}
            ajuda={`Mínimo de ${SENHA_MIN} caracteres.`}
            erros={erros.senha}
            required
          />
          <Campo rotulo="Confirme a senha" name="confirmacao" type="password" autoComplete="new-password" erros={erros.confirmacao} required />
        </>
      )}

      <p className="text-muted-foreground text-xs">
        Seus dados ficam visíveis só para a equipe dentro do sistema. A data de nascimento não aparece para outros colaboradores.
      </p>
      <Button type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : rotuloBotao}
      </Button>
    </form>
  );
}
