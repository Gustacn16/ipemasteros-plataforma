"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import { apagarDadosTelefoneAcao } from "../acoes/numeros";

const soDigitos = (v: string) => v.replace(/\D/g, "");

function Formulario() {
  const [telefone, setTelefone] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem?: string } | null>(null);
  const [pendente, executar] = useTransition();
  const igual = soDigitos(telefone).length >= 10 && soDigitos(telefone) === soDigitos(confirmacao);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!igual) return;
        executar(async () => {
          const r = await apagarDadosTelefoneAcao({ telefone });
          setResultado({ ok: r.ok, mensagem: r.mensagem });
          if (r.ok) {
            setTelefone("");
            setConfirmacao("");
          }
        });
      }}
    >
      {resultado?.mensagem && (
        <Alert variant={resultado.ok ? "default" : "destructive"}>
          <AlertDescription>{resultado.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Telefone" name="telefone" inputMode="tel" placeholder="(62) 98170-7432" value={telefone} onChange={(e) => setTelefone(e.target.value)} required />
      <Campo
        rotulo="Digite o telefone de novo para confirmar"
        name="confirmacao"
        inputMode="tel"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        required
      />
      <DialogFooter>
        <Button type="submit" variant="destructive" disabled={pendente || !igual}>
          {pendente ? "Apagando…" : "Apagar dados"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ApagarDadosTelefone() {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Trash2Icon /> Apagar dados de um telefone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apagar dados de um telefone</DialogTitle>
          <DialogDescription>Apaga o contato, as conversas e todas as mensagens deste telefone. Não dá para desfazer.</DialogDescription>
        </DialogHeader>
        {aberto && <Formulario />}
      </DialogContent>
    </Dialog>
  );
}
