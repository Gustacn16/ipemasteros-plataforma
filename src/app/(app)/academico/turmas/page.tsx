import { LayersIcon } from "lucide-react";
import type { Metadata } from "next";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { temPermissao } from "@/lib/permissoes";
import { criarTurmaAcao } from "@/modulos/academico/acoes/academico";
import { FormularioAcao } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { SeloSituacao, dataCurta } from "@/modulos/academico/componentes/exibicao";
import { CamposTurma } from "@/modulos/academico/componentes/formularios";
import { CartaoTurma, LinhaTurma, SeletorSituacaoTurma } from "@/modulos/academico/componentes/turma-na-lista";
import { listarTurmas, type TurmaLista } from "@/modulos/academico/servicos/turmas";
import { listarProdutosAtivos } from "@/modulos/comercial/servicos/produtos";

export const metadata: Metadata = { title: "Turmas — IPEMaster OS" };

export default async function PaginaTurmas() {
  const usuario = await exigirPermissaoPagina("academico:ver");
  const [turmas, produtos] = await Promise.all([listarTurmas(usuario), listarProdutosAtivos()]);
  const podeEditar = temPermissao(usuario.papel, "academico:gerenciar");
  const porProduto = new Map<string, { nome: string; turmas: TurmaLista[] }>();
  for (const t of turmas) {
    const grupo = porProduto.get(t.produto.id) ?? { nome: t.produto.nome, turmas: [] };
    grupo.turmas.push(t);
    porProduto.set(t.produto.id, grupo);
  }

  const situacao = (t: TurmaLista) =>
    podeEditar ? <SeletorSituacaoTurma id={t.id} situacao={t.situacao} rotulo={t.nome} /> : <SeloSituacao situacao={t.situacao} de="turma" />;

  return (
    <div className="grid gap-6">
      {podeEditar && (
        <div>
          <Dialogo rotuloBotao="Nova turma" titulo="Nova turma">
            <FormularioAcao acao={criarTurmaAcao} rotuloBotao="Criar turma" irPara="/academico/turmas/">
              <CamposTurma produtos={produtos.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
            </FormularioAcao>
          </Dialogo>
        </div>
      )}

      {porProduto.size === 0 && (
        <EstadoVazio icone={LayersIcon} titulo="Nenhuma turma ainda" descricao="Crie a primeira turma de um produto no botão “Nova turma”." />
      )}

      {[...porProduto].map(([id, grupo]) => (
        <section key={id} aria-labelledby={`produto-${id}`} className="grid gap-2">
          <h2 id={`produto-${id}`} className="font-semibold">
            {grupo.nome} <span className="text-muted-foreground font-normal">{grupo.turmas.length}</span>
          </h2>
          <Table className="hidden md:table">
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {grupo.turmas.map((t) => (
                <LinhaTurma key={t.id} href={`/academico/turmas/${t.id}`}>
                  <TableCell className="font-medium">{t.nome}</TableCell>
                  <TableCell>{situacao(t)}</TableCell>
                  <TableCell>{t.ciclica ? "Contínua" : dataCurta(t.dataInicio)}</TableCell>
                  <TableCell>{t.ciclica ? "—" : dataCurta(t.dataFim)}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.ativos}</TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">{t.totalMatriculas}</TableCell>
                </LinhaTurma>
              ))}
            </TableBody>
          </Table>
          <ul className="grid gap-2 md:hidden">
            {grupo.turmas.map((t) => (
              <CartaoTurma key={t.id} href={`/academico/turmas/${t.id}`} nome={t.nome} situacao={situacao(t)}>
                {t.ciclica ? "Contínua" : `${dataCurta(t.dataInicio)} – ${dataCurta(t.dataFim)}`} · {t.ativos} ativos · {t.totalMatriculas} no total
              </CartaoTurma>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
