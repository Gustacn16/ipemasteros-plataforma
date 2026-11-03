import { UploadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/componentes/ui/button";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { criarAlunoAcao } from "@/modulos/academico/acoes/academico";
import { FormularioAcao } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { CamposAluno } from "@/modulos/academico/componentes/formularios";
import { ListaAlunos } from "@/modulos/academico/componentes/lista-alunos";
import { listarAlunos } from "@/modulos/academico/servicos/alunos";

export const metadata: Metadata = { title: "Alunos — IPEMaster OS" };

export default async function PaginaAlunos() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const alunos = await listarAlunos(usuario);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        {temPermissao(usuario.papel, "academico:gerenciar") && (
          <Dialogo rotuloBotao="Novo aluno" titulo="Novo aluno">
            <FormularioAcao acao={criarAlunoAcao} rotuloBotao="Cadastrar" irPara="/academico/alunos/">
              <CamposAluno />
            </FormularioAcao>
          </Dialogo>
        )}
        {temPermissao(usuario.papel, "academico:importar_alunos") && (
          <Button variant="outline" asChild>
            <Link href="/academico/alunos/importar">
              <UploadIcon /> Importar planilha
            </Link>
          </Button>
        )}
      </div>
      <ListaAlunos alunos={alunos} />
    </div>
  );
}
