"use client";

import { useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useEffect, type ReactNode } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { ContextoDialogo } from "./dialogo";

// Kit de formulário do Acadêmico: o FormularioAcao roda a Server Action e
// passa os erros por contexto, para que os campos mostrem os seus.

type Estado = { ok: boolean; mensagem?: string; erros?: Record<string, string[] | undefined>; dados?: { id: string } };

const ContextoErros = createContext<Record<string, string[] | undefined> | undefined>(undefined);
const useErros = (name: string) => useContext(ContextoErros)?.[name];

export const estiloCampo = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";
const estiloSelect = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

export function FormularioAcao<S extends Estado>({
  acao,
  rotuloBotao,
  irPara,
  children,
  className = "grid gap-4 sm:grid-cols-2",
}: {
  acao: (estado: S, formData: FormData) => Promise<S>;
  rotuloBotao: string;
  /** Depois de criar, abre `${irPara}${id}`. Sem ele, só atualiza a tela. */
  irPara?: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const fechar = useContext(ContextoDialogo);
  const [estado, executar, pendente] = useActionState(acao as unknown as (estado: Estado, formData: FormData) => Promise<Estado>, { ok: false });
  useEffect(() => {
    if (!estado.ok) return;
    avisar(estado);
    fechar?.();
    if (irPara && estado.dados?.id) router.push(`${irPara}${estado.dados.id}`);
    else router.refresh();
  }, [estado, irPara, router, fechar]);

  return (
    <form action={executar} className="grid gap-4">
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <ContextoErros.Provider value={estado.erros}>
        <div className={className}>{children}</div>
      </ContextoErros.Provider>
      <div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : rotuloBotao}
        </Button>
      </div>
    </form>
  );
}

type PropsTexto = { rotulo: string; name: string; defaultValue?: string | null; type?: string; required?: boolean; placeholder?: string; largo?: boolean };

export function CampoTexto({ rotulo, name, defaultValue, largo, ...props }: PropsTexto) {
  const erros = useErros(name);
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <Campo rotulo={rotulo} name={name} id={`f-${name}`} defaultValue={defaultValue ?? ""} erros={erros} {...props} />
    </div>
  );
}

export function CampoSelecao({
  rotulo,
  name,
  opcoes,
  defaultValue,
  vazio,
  largo,
}: {
  rotulo: string;
  name: string;
  opcoes: readonly { valor: string; rotulo: string }[];
  defaultValue?: string | null;
  /** Texto da opção vazia, quando o campo pode ficar sem escolha. */
  vazio?: string;
  largo?: boolean;
}) {
  const erros = useErros(name);
  return (
    <div className={`grid gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`f-${name}`}>{rotulo}</Label>
      <select id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} className={estiloSelect} aria-invalid={erros ? true : undefined}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      {erros && <p className="text-destructive text-sm">{erros.join(" ")}</p>}
    </div>
  );
}

export function CampoAreaTexto({ rotulo, name, defaultValue }: { rotulo: string; name: string; defaultValue?: string | null }) {
  const erros = useErros(name);
  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <Label htmlFor={`f-${name}`}>{rotulo}</Label>
      <textarea id={`f-${name}`} name={name} rows={3} defaultValue={defaultValue ?? ""} className={estiloCampo} />
      {erros && <p className="text-destructive text-sm">{erros.join(" ")}</p>}
    </div>
  );
}

export function CampoCaixa({ rotulo, name, defaultChecked, ajuda }: { rotulo: string; name: string; defaultChecked?: boolean; ajuda?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm sm:col-span-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        {rotulo}
        {ajuda && <span className="text-muted-foreground block text-xs">{ajuda}</span>}
      </span>
    </label>
  );
}

/** Campo oculto (id do registro, turma fixa etc.). */
export function Oculto({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

/** Botão que chama uma ação sem formulário (excluir, ativar), com confirmação opcional. */
export function BotaoAcao({
  acao,
  rotulo,
  confirmar,
  irPara,
  variante = "outline",
}: {
  acao: () => Promise<{ ok: boolean; mensagem?: string }>;
  rotulo: string;
  confirmar?: string;
  irPara?: string;
  variante?: "outline" | "destructive";
}) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant={variante}
      onClick={async () => {
        if (confirmar && !window.confirm(confirmar)) return;
        const resultado = await acao();
        if (!avisar(resultado)) return;
        if (irPara) router.push(irPara);
        else router.refresh();
      }}
    >
      {rotulo}
    </Button>
  );
}
