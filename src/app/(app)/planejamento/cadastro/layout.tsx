import { Suspense } from "react";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { SubabasCadastro } from "@/modulos/planejamento/componentes/abas-planejamento";
import { AvisoMesesFechados } from "@/modulos/planejamento/componentes/ui-plano";

export default async function LayoutCadastro({ children }: { children: React.ReactNode }) {
  await exigirPermissaoPagina("planejamento:editar");
  return (
    <div className="grid gap-4">
      <Suspense>
        <SubabasCadastro />
      </Suspense>
      <AvisoMesesFechados />
      {children}
    </div>
  );
}
