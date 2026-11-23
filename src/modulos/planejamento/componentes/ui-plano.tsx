"use client";

import { useRouter } from "next/navigation";
import { useActionState, type ComponentProps, type ReactNode } from "react";
import { Label } from "@/componentes/ui/label";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import type { Estado } from "../acoes/planejamento";

/** useActionState que mostra o resultado num toast e recarrega a tela quando dá certo. */
export function useAcao(acao: (e: Estado, f: FormData) => Promise<Estado>, aoConcluir?: () => void) {
  const router = useRouter();
  return useActionState(
    async (anterior: Estado, formData: FormData) => {
      const r = await acao(anterior, formData);
      if (r.ok || r.mensagem) avisar(r);
      if (r.ok) {
        aoConcluir?.();
        router.refresh();
      }
      return r;
    },
    { ok: false } as Estado,
  );
}

export const classeCampo =
  "border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 disabled:opacity-60";

export function CampoSimples({ rotulo, erros, ajuda, className, ...props }: ComponentProps<"input"> & { rotulo: string; erros?: string[]; ajuda?: string }) {
  return (
    <div className={cn("grid gap-1", className)}>
      <Label htmlFor={props.id ?? props.name}>{rotulo}</Label>
      <input id={props.id ?? props.name} aria-invalid={erros?.length ? true : undefined} className={classeCampo} {...props} />
      {erros?.length ? <p className="text-destructive text-xs">{erros.join(" ")}</p> : ajuda ? <p className="text-muted-foreground text-xs">{ajuda}</p> : null}
    </div>
  );
}

export function Escolha({ rotulo, erros, children, className, ...props }: ComponentProps<"select"> & { rotulo: string; erros?: string[]; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1", className)}>
      <Label htmlFor={props.id ?? props.name}>{rotulo}</Label>
      <select id={props.id ?? props.name} className={classeCampo} {...props}>
        {children}
      </select>
      {erros?.length ? <p className="text-destructive text-xs">{erros.join(" ")}</p> : null}
    </div>
  );
}

export function AvisoMesesFechados() {
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Mudanças valem do mês atual em diante. Meses fechados ficam como estavam.
    </p>
  );
}

/** Número em formato brasileiro para preencher campos ("75000.00" → "75.000,00"). */
export const paraCampo = (v: string | number | null | undefined, casas = 2) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pctCampo = (fracao: number) => (fracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
