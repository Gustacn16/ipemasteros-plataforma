import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasAcademico } from "@/modulos/academico/componentes/abas-academico";

/** Área do módulo Acadêmico: título e abas acima do conteúdo. */
export default async function LayoutAcademico({ children }: { children: React.ReactNode }) {
  await exigirPermissaoPagina("academico:ver");
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Acadêmico</h1>
        <AbasAcademico />
      </div>
      {children}
    </div>
  );
}
