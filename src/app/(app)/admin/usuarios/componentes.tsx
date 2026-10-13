"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/componentes/ui/dialog";
import { Label } from "@/componentes/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/componentes/ui/select";
import { ROTULO_PAPEL, type Papel } from "@/lib/permissoes";
import {
  alterarPapelAcao,
  convidarAcao,
  definirAtivoAcao,
  revogarConviteAcao,
} from "@/modulos/core/acoes/usuarios";

type Resultado = { ok: boolean; mensagem?: string };

function avisar(resultado: Resultado) {
  if (resultado.ok) toast.success(resultado.mensagem ?? "Feito.");
  else toast.error(resultado.mensagem ?? "Não foi possível concluir.");
}

export function FormularioConvite({ papeis }: { papeis: Papel[] }) {
  const [aberto, setAberto] = useState(false);
  const [abertura, setAbertura] = useState(0);

  function alternar(novo: boolean) {
    setAberto(novo);
    // Cada abertura recria o conteúdo, limpando formulário e resultado anterior.
    if (novo) setAbertura((n) => n + 1);
  }

  return (
    <Dialog open={aberto} onOpenChange={alternar}>
      <DialogTrigger asChild>
        <Button>Convidar usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
          <DialogDescription>A pessoa recebe um link por e-mail, válido por 72 horas, para criar a senha.</DialogDescription>
        </DialogHeader>
        <ConteudoConvite key={abertura} papeis={papeis} />
      </DialogContent>
    </Dialog>
  );
}

function ConteudoConvite({ papeis }: { papeis: Papel[] }) {
  const [atual, executar, pendente] = useActionState(convidarAcao, { ok: false });

  if (atual.ok && atual.dados) {
    return (
      <div className="grid gap-4">
        <Alert>
          <AlertDescription>{atual.mensagem}</AlertDescription>
        </Alert>
        <div className="grid gap-1.5">
          <Label htmlFor="link-convite">Link do convite (caso o e-mail não chegue)</Label>
          <div className="flex gap-2">
            <input
              id="link-convite"
              readOnly
              value={atual.dados.link}
              className="bg-muted min-w-0 flex-1 rounded-md border px-2 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(atual.dados!.link).then(() => toast.success("Link copiado."))}
            >
              Copiar
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">Envie só para a pessoa convidada: o link dá acesso à criação da conta.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={executar} className="grid gap-4">
      {!atual.ok && atual.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{atual.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" name="nome" erros={atual.erros?.nome} required />
      <Campo rotulo="E-mail" name="email" type="email" erros={atual.erros?.email} required />
      <div className="grid gap-1.5">
        <Label htmlFor="papel-convite">Papel</Label>
        <Select name="papel" defaultValue={papeis.includes("colaborador") ? "colaborador" : papeis[0]}>
          <SelectTrigger id="papel-convite" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {papeis.map((p) => (
              <SelectItem key={p} value={p}>
                {ROTULO_PAPEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Enviando…" : "Enviar convite"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AcoesUsuario({
  usuarioId,
  papel,
  ativo,
  papeis,
}: {
  usuarioId: string;
  papel: Papel;
  ativo: boolean;
  papeis: Papel[];
}) {
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        value={papel}
        disabled={pendente || !ativo}
        onValueChange={(novo) => {
          if (!confirm(`Alterar o papel para ${ROTULO_PAPEL[novo as Papel]}? A pessoa será desconectada.`)) return;
          iniciar(async () => avisar(await alterarPapelAcao(usuarioId, novo)));
        }}
      >
        <SelectTrigger size="sm" aria-label="Papel" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {papeis.map((p) => (
            <SelectItem key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={ativo ? "outline" : "secondary"}
        size="sm"
        disabled={pendente}
        onClick={() => {
          const pergunta = ativo
            ? "Desativar este usuário? Ele perde o acesso na hora; o histórico é mantido."
            : "Reativar este usuário?";
          if (!confirm(pergunta)) return;
          iniciar(async () => avisar(await definirAtivoAcao(usuarioId, !ativo)));
        }}
      >
        {ativo ? "Desativar" : "Reativar"}
      </Button>
    </div>
  );
}

export function BotaoRevogarConvite({ conviteId }: { conviteId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() => {
        if (!confirm("Revogar este convite? O link deixa de funcionar.")) return;
        iniciar(async () => avisar(await revogarConviteAcao(conviteId)));
      }}
    >
      Revogar
    </Button>
  );
}
