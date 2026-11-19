import { FolderTreeIcon } from "lucide-react";
import type { Metadata } from "next";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoAcao, CampoAreaTexto, CampoSelecao, CampoTexto, FormularioAcao, Oculto } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import {
  criarAreaAcao,
  criarCategoriaAcao,
  editarAreaAcao,
  editarCategoriaAcao,
  excluirAreaAcao,
  excluirCategoriaAcao,
} from "@/modulos/processos/acoes/processos";
import { ICONE_CATEGORIA, ROTULO_ICONE } from "@/modulos/processos/componentes/icones";
import { NovoDocumento } from "@/modulos/processos/componentes/novo-documento";
import { SetasOrdem } from "@/modulos/processos/componentes/organizar";
import { ICONES_CATEGORIA } from "@/modulos/processos/esquemas/processos";
import { listarOpcoesArea, obterArvore, type CategoriaNaArvore } from "@/modulos/processos/servicos/estrutura";

export const metadata: Metadata = { title: "Organizar processos — IPEMaster OS" };

const OPCOES_ICONE = ICONES_CATEGORIA.map((i) => ({ valor: i, rotulo: ROTULO_ICONE[i] }));

function CamposCategoria({ c }: { c?: CategoriaNaArvore }) {
  return (
    <>
      <CampoTexto rotulo="Nome" name="nome" defaultValue={c?.nome} placeholder="Ex.: Marketing" required />
      <CampoSelecao rotulo="Ícone" name="icone" opcoes={OPCOES_ICONE} defaultValue={c?.icone ?? "pasta"} />
      <CampoAreaTexto rotulo="Descrição" name="descricao" defaultValue={c?.descricao} />
    </>
  );
}

export default async function PaginaOrganizar() {
  const usuario = await exigirPermissaoPagina("processos:editar");
  const [arvore, areas] = await Promise.all([obterArvore(usuario), listarOpcoesArea()]);
  const opcoesCategoria = arvore.map((c) => ({ valor: c.id, rotulo: c.nome }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-xl text-sm">Monte a estrutura: categorias (ex.: Marketing) agrupam áreas (ex.: Aquisição), e cada área guarda os documentos.</p>
        <div className="flex flex-wrap gap-2">
          <Dialogo rotuloBotao="Nova categoria" titulo="Nova categoria" variante={arvore.length ? "outline" : "default"}>
            <FormularioAcao acao={criarCategoriaAcao} rotuloBotao="Criar">
              <CamposCategoria />
            </FormularioAcao>
          </Dialogo>
          <NovoDocumento areas={areas} />
        </div>
      </div>

      {arvore.length === 0 && <EstadoVazio icone={FolderTreeIcon} titulo="Nenhuma categoria" descricao="Crie a primeira categoria para começar." />}

      <ol className="grid gap-4">
        {arvore.map((c, ci) => {
          const Icone = ICONE_CATEGORIA[c.icone] ?? ICONE_CATEGORIA.pasta;
          return (
            <li key={c.id} className="bg-card grid gap-3 rounded-2xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <Icone className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold">{c.nome}</h2>
                    {c.descricao && <p className="text-muted-foreground truncate text-xs">{c.descricao}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <SetasOrdem id={c.id} tipo="categoria" primeiro={ci === 0} ultimo={ci === arvore.length - 1} />
                  <Dialogo rotuloBotao="Editar" titulo="Editar categoria" variante="outline">
                    <FormularioAcao acao={editarCategoriaAcao} rotuloBotao="Salvar">
                      <Oculto name="id" value={c.id} />
                      <CamposCategoria c={c} />
                    </FormularioAcao>
                  </Dialogo>
                  <BotaoAcao acao={excluirCategoriaAcao.bind(null, c.id)} rotulo="Excluir" confirmar={`Excluir a categoria "${c.nome}"?`} />
                </div>
              </div>

              <ul className="grid gap-2 sm:ml-12">
                {c.areas.map((a, ai) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-medium">{a.nome}</span>{" "}
                      <span className="text-muted-foreground text-xs">
                        · {a.documentos.length} documento{a.documentos.length === 1 ? "" : "s"}
                      </span>
                      {a.descricao && <p className="text-muted-foreground truncate text-xs">{a.descricao}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <SetasOrdem id={a.id} tipo="area" primeiro={ai === 0} ultimo={ai === c.areas.length - 1} />
                      <Dialogo rotuloBotao="Editar" titulo="Editar área" variante="outline">
                        <FormularioAcao acao={editarAreaAcao} rotuloBotao="Salvar">
                          <Oculto name="id" value={a.id} />
                          <CampoTexto rotulo="Nome" name="nome" defaultValue={a.nome} required />
                          <CampoSelecao rotulo="Categoria" name="categoriaId" opcoes={opcoesCategoria} defaultValue={c.id} />
                          <CampoAreaTexto rotulo="Descrição" name="descricao" defaultValue={a.descricao} />
                        </FormularioAcao>
                      </Dialogo>
                      <BotaoAcao acao={excluirAreaAcao.bind(null, a.id)} rotulo="Excluir" confirmar={`Excluir a área "${a.nome}"?`} />
                    </div>
                  </li>
                ))}
                <li>
                  <Dialogo rotuloBotao="Nova área" titulo={`Nova área em ${c.nome}`} variante="outline">
                    <FormularioAcao acao={criarAreaAcao} rotuloBotao="Criar">
                      <Oculto name="categoriaId" value={c.id} />
                      <CampoTexto rotulo="Nome" name="nome" placeholder="Ex.: Aquisição" required />
                      <CampoAreaTexto rotulo="Descrição" name="descricao" />
                    </FormularioAcao>
                  </Dialogo>
                </li>
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
