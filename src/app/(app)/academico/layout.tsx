import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasAcademico } from "@/modulos/academico/componentes/abas-academico";

/** Área do módulo Acadêmico: título e abas acima do conteúdo. */
export default async function LayoutAcademico({ children }: { children: React.ReactNode }) {
  await exigirPermissaoPagina("academico:ver");
  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <CabecalhoPagina titulo="Acadêmico" descricao="Alunos, turmas e professores por produto." />
        <AbasAcademico />
      </div>
      {children}
    </div>
  );
}
