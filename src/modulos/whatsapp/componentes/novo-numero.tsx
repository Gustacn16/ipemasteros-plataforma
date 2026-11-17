"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/componentes/ui/dialog";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarNumeroAcao } from "../acoes/numeros";

const estiloSelect = "border-input bg-background h-9 rounded-md border px-2 text-sm";

type Vendedor = { id: string; nome: string };

function Formulario({ vendedores, aoCriar }: { vendedores: Vendedor[]; aoCriar: () => void }) {
  const router = useRouter();
  const [finalidade, setFinalidade] = useState<"escola" | "vendedor">("escola");
  const [usuarioId, setUsuarioId] = useState("");
  const [erro, setErro] = useState<{ mensagem?: string; campos?: Record<string, string[] | undefined> }>({});
  const [pendente, executar] = useTransition();

  return (
    <form
      className="grid gap-4"
      action={(formData) =>
        executar(async () => {
          const resultado = await criarNumeroAcao({
            nome: String(formData.get("nome") ?? ""),
            finalidade,
            // "" não vale: sem vendedor (ou número da escola), vai null.
            usuarioId: finalidade === "vendedor" && usuarioId ? usuarioId : null,
          });
          if (resultado.ok) {
            avisar(resultado);
            aoCriar();
            router.refresh();
          } else {
            setErro({ mensagem: resultado.mensagem, campos: resultado.erros });
          }
        })
      }
    >
      {erro.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{erro.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" name="nome" placeholder="Ex.: WhatsApp da secretaria" erros={erro.campos?.nome} required maxLength={60} />
      <div className="grid gap-1.5">
        <Label htmlFor="novo-numero-finalidade">Finalidade</Label>
        <select
          id="novo-numero-finalidade"
          className={estiloSelect}
          value={finalidade}
          onChange={(e) => setFinalidade(e.target.value as "escola" | "vendedor")}
        >
          <option value="escola">Escola</option>
          <option value="vendedor">Vendedor</option>
        </select>
      </div>
      {finalidade === "vendedor" && (
        <div className="grid gap-1.5">
          <Label htmlFor="novo-numero-dono">Vendedor dono</Label>
          <select id="novo-numero-dono" className={estiloSelect} value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Escolha…</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
          {erro.campos?.usuarioId && <p className="text-destructive text-sm">{erro.campos.usuarioId.join(" ")}</p>}
        </div>
      )}
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Criando…" : "Criar número"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NovoNumero({ vendedores }: { vendedores: Vendedor[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> Novo número
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo número</DialogTitle>
          <DialogDescription>Cria a vaga. Depois, quem for usar o número lê o QR em Conectar.</DialogDescription>
        </DialogHeader>
        {aberto && <Formulario vendedores={vendedores} aoCriar={() => setAberto(false)} />}
      </DialogContent>
    </Dialog>
  );
}
