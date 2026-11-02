"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirAtivoCanalAcao, salvarCanalAcao } from "../acoes/canais";

type Canal = { id: string; nome: string; ativo: boolean };

/** Lista editável de canais de venda: adicionar e ativar/desativar. */
export function CanaisVenda({ canais }: { canais: Canal[] }) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [estado, executar, salvando] = useActionState(salvarCanalAcao, {
    ok: false,
  });
  const [pendente, iniciar] = useTransition();
  useEffect(() => {
    if (estado.ok) {
      formulario.current?.reset();
      router.refresh();
    }
  }, [estado, router]);
  const erro = estado.erros?.nome?.[0] ?? (!estado.ok ? estado.mensagem : undefined);

  return (
    <div className="grid max-w-md gap-4">
      <ul className="divide-y rounded-md border">
        {canais.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">Nenhum canal cadastrado.</li>}
        {canais.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className={c.ativo ? "" : "text-muted-foreground line-through"}>{c.nome}</span>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={c.ativo}
                disabled={pendente}
                onChange={(e) =>
                  iniciar(async () => {
                    if (avisar(await definirAtivoCanalAcao(c.id, e.target.checked))) router.refresh();
                  })
                }
              />
              Ativo
            </label>
          </li>
        ))}
      </ul>
      <form ref={formulario} action={executar} className="grid gap-1.5">
        <div className="flex gap-2">
          <Input name="nome" placeholder="Novo canal (ex.: Congresso)" aria-label="Nome do novo canal" required />
          <Button type="submit" disabled={salvando}>
            Adicionar
          </Button>
        </div>
        {erro && <p className="text-destructive text-sm">{erro}</p>}
      </form>
    </div>
  );
}
