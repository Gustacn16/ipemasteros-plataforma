"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import { Label } from "@/componentes/ui/label";
import { criarProdutoAcao } from "../acoes/produtos";
import { ROTULO_TIPO_PRODUTO, TIPOS_PRODUTO } from "../esquemas/produto";
import { estiloSelect } from "./exibicao";

function Formulario() {
  const router = useRouter();
  const [estado, executar, pendente] = useActionState(criarProdutoAcao, {
    ok: false,
  });
  useEffect(() => {
    if (estado.ok && estado.dados) router.push(`/comercial/produtos/${estado.dados.id}`);
  }, [estado, router]);

  return (
    <form action={executar} className="grid gap-4">
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" name="nome" placeholder="Ex.: Pós-Graduação em Dermatologia" erros={estado.erros?.nome} required />
      <div className="grid gap-1.5">
        <Label htmlFor="novo-tipo">Tipo</Label>
        <select id="novo-tipo" name="tipo" className={estiloSelect} defaultValue="curso_livre">
          {TIPOS_PRODUTO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO_PRODUTO[t]}
            </option>
          ))}
        </select>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando…" : "Criar produto"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NovoProduto() {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> Novo produto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
          <DialogDescription>Depois de criar, complete preços, comissão, ementa e links na página do produto.</DialogDescription>
        </DialogHeader>
        {aberto && <Formulario />}
      </DialogContent>
    </Dialog>
  );
}
