import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { definirAtivoProfessorAcao, editarProfessorAcao } from "@/modulos/academico/acoes/academico";
import { BotaoAcao, FormularioAcao, Oculto } from "@/modulos/academico/componentes/campos";
import { ou404 } from "@/modulos/academico/componentes/exibicao";
import { CamposProfessor } from "@/modulos/academico/componentes/formularios";
import { obterProfessor } from "@/modulos/academico/servicos/professores";

export const metadata: Metadata = { title: "Professor — IPEMaster OS" };

function Item({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{rotulo}</dt>
      <dd className="text-sm whitespace-pre-line">{valor || "—"}</dd>
    </div>
  );
}

export default async function PaginaProfessor({ params }: PageProps<"/academico/professores/[id]">) {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const { id } = await params;
  const professor = await ou404(obterProfessor(usuario, id));
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");

  return (
    <div className="grid gap-6">
      <Link href="/academico/professores" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeftIcon className="size-4" /> Professores
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {professor.nome} {!professor.ativo && <span className="text-muted-foreground text-sm font-normal">(inativo)</span>}
        </h2>
        {podeEditar && (
          <BotaoAcao
            acao={definirAtivoProfessorAcao.bind(null, professor.id, !professor.ativo)}
            rotulo={professor.ativo ? "Desativar" : "Ativar"}
          />
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dados do professor</CardTitle>
        </CardHeader>
        <CardContent>
          {podeEditar ? (
            <FormularioAcao acao={editarProfessorAcao} rotuloBotao="Salvar">
              <Oculto name="id" value={professor.id} />
              <CamposProfessor professor={professor} />
            </FormularioAcao>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Item rotulo="E-mail" valor={professor.email} />
              <Item rotulo="Telefone" valor={professor.telefone} />
              <Item rotulo="CRM" valor={[professor.crm, professor.crmUf].filter(Boolean).join(" / ")} />
              <Item rotulo="Especialidade" valor={professor.especialidade} />
              <Item rotulo="Minicurrículo" valor={professor.miniCurriculo} />
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
