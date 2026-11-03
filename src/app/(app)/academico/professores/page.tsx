import { PresentationIcon } from "lucide-react";
import type { Metadata } from "next";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { criarProfessorAcao } from "@/modulos/academico/acoes/academico";
import { FormularioAcao } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { CamposProfessor } from "@/modulos/academico/componentes/formularios";
import { listarProfessores } from "@/modulos/academico/servicos/professores";

export const metadata: Metadata = { title: "Professores — IPEMaster OS" };

export default async function PaginaProfessores() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const professores = await listarProfessores(usuario);

  return (
    <div className="grid gap-6">
      {temPermissao(usuario.papel, "academico:gerenciar") && (
        <div>
          <Dialogo rotuloBotao="Novo professor" titulo="Novo professor">
            <FormularioAcao acao={criarProfessorAcao} rotuloBotao="Cadastrar" irPara="/academico/professores/">
              <CamposProfessor />
            </FormularioAcao>
          </Dialogo>
        </div>
      )}
      {professores.length === 0 ? (
        <EstadoVazio icone={PresentationIcon} titulo="Nenhum professor ainda" descricao="Cadastre os professores no botão “Novo professor”." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Professor</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {professores.map((p) => (
              <TableRow key={p.id} className={p.ativo ? undefined : "opacity-60"}>
                <TableCell>
                  <Link href={`/academico/professores/${p.id}`} className="font-medium hover:underline">
                    {p.nome}
                  </Link>
                </TableCell>
                <TableCell>{p.especialidade ?? "—"}</TableCell>
                <TableCell>
                  <ChipSituacao tom={p.ativo ? "sucesso" : "neutro"} tamanho="sm">
                    {p.ativo ? "Ativo" : "Inativo"}
                  </ChipSituacao>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
