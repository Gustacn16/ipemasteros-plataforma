import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { editarMatriculaAcao } from "../acoes/academico";
import { FormularioAcao, Oculto } from "./campos";
import { Dialogo } from "./dialogo";
import { SeloSituacao, dataCurta } from "./exibicao";
import { CamposMatricula } from "./formularios";

export type LinhaMatricula = {
  id: string;
  turmaId: string;
  situacao: string;
  dataInicio: string | null;
  dataFormatura: string | null;
  vigencia: string | null;
  plano: string | null;
  observacoes: string | null;
  /** O que identifica a matrícula na linha: o aluno (na turma) ou a turma (no aluno). */
  titulo: string;
  href: string;
  subtitulo?: string;
};

/** Tabela de matrículas com edição em diálogo. */
export function TabelaMatriculas({ matriculas, podeEditar, rotuloTitulo }: { matriculas: LinhaMatricula[]; podeEditar: boolean; rotuloTitulo: string }) {
  if (matriculas.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma matrícula.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{rotuloTitulo}</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Início</TableHead>
          <TableHead>Formatura</TableHead>
          {podeEditar && <TableHead className="w-0" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {matriculas.map((m) => (
          <TableRow key={m.id}>
            <TableCell>
              <Link href={m.href} className="font-medium hover:underline">
                {m.titulo}
              </Link>
              {m.subtitulo && <span className="text-muted-foreground block text-xs">{m.subtitulo}</span>}
            </TableCell>
            <TableCell>
              <SeloSituacao situacao={m.situacao} de="matricula" />
            </TableCell>
            <TableCell>{dataCurta(m.dataInicio)}</TableCell>
            <TableCell>{dataCurta(m.dataFormatura)}</TableCell>
            {podeEditar && (
              <TableCell>
                <Dialogo rotuloBotao="Editar" titulo="Editar matrícula" descricao={m.titulo} variante="outline">
                  <FormularioAcao acao={editarMatriculaAcao} rotuloBotao="Salvar">
                    <Oculto name="id" value={m.id} />
                    <Oculto name="turmaId" value={m.turmaId} />
                    <CamposMatricula matricula={m} />
                  </FormularioAcao>
                </Dialogo>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
