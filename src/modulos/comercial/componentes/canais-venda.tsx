"use client";

import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import type { EstadoAcao } from "@/lib/acoes";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirAtivoCanalAcao, salvarCanalAcao } from "../acoes/canais";

type Canal = { id: string; nome: string; ativo: boolean };

/** Nome do canal que vira campo de edição ao clicar no lápis. */
function NomeCanal({ canal }: { canal: Canal }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [estado, executar, salvando] = useActionState(
    async (anterior: EstadoAcao, formData: FormData) => {
      const resultado = await salvarCanalAcao(anterior, formData);
      if (resultado.ok) {
        setEditando(false);
        router.refresh();
      }
      return resultado;
    },
    { ok: false },
  );

  if (!editando) {
    return (
      <span className="flex items-center gap-1">
        <span className={canal.ativo ? "" : "text-muted-foreground line-through"}>{canal.nome}</span>
        <button
          type="button"
          aria-label={`Renomear ${canal.nome}`}
          className="text-muted-foreground hover:text-foreground rounded p-1"
          onClick={() => setEditando(true)}
        >
          <PencilIcon className="size-3.5" />
        </button>
      </span>
    );
  }
  const erro = estado.erros?.nome?.[0] ?? (!estado.ok ? estado.mensagem : undefined);
  return (
    <form action={executar} className="grid flex-1 gap-1">
      <input type="hidden" name="id" value={canal.id} />
      <div className="flex gap-1.5">
        <Input name="nome" defaultValue={canal.nome} aria-label="Novo nome do canal" autoFocus required className="h-8" />
        <Button type="submit" size="sm" disabled={salvando}>
          Salvar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
          Cancelar
        </Button>
      </div>
      {erro && <p className="text-destructive text-sm">{erro}</p>}
    </form>
  );
}

/** Lista editável de canais de venda: adicionar, renomear e ativar/desativar. */
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
          <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <NomeCanal canal={c} />
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
