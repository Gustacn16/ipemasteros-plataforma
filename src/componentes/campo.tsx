import type { ComponentProps } from "react";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";

type Props = ComponentProps<typeof Input> & {
  rotulo: string;
  name: string;
  erros?: string[];
  ajuda?: string;
};

/** Campo de formulário com rótulo, ajuda e mensagens de erro acessíveis. */
export function Campo({ rotulo, name, erros, ajuda, id, ...props }: Props) {
  const idCampo = id ?? name;
  const idDescricao = `${idCampo}-descricao`;
  const temErro = Boolean(erros?.length);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={idCampo}>{rotulo}</Label>
      <Input
        id={idCampo}
        name={name}
        aria-invalid={temErro || undefined}
        aria-describedby={temErro || ajuda ? idDescricao : undefined}
        {...props}
      />
      {temErro ? (
        <p id={idDescricao} className="text-destructive text-sm">
          {erros!.join(" ")}
        </p>
      ) : ajuda ? (
        <p id={idDescricao} className="text-muted-foreground text-sm">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}
