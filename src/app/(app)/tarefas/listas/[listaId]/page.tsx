import { FilterXIcon, ListTodoIcon } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { AlternarVisao } from "@/modulos/tarefas/componentes/alternar-visao";
import { ConfigurarStatus } from "@/modulos/tarefas/componentes/configurar-status";
import { EditarLista } from "@/modulos/tarefas/componentes/editar-lista";
import { FiltrosDaLista } from "@/modulos/tarefas/componentes/filtros-lista";
import { NovaTarefaRapida } from "@/modulos/tarefas/componentes/nova-tarefa-rapida";
import { ID_MODELO } from "@/modulos/tarefas/componentes/modelo-url";
import { PainelTarefa } from "@/modulos/tarefas/componentes/painel-tarefa";
import { QuadroTarefas } from "@/modulos/tarefas/componentes/quadro-tarefas";
import { TabelaTarefas } from "@/modulos/tarefas/componentes/tabela-tarefas";
import { esquemaFiltrosLista } from "@/modulos/tarefas/esquemas/tarefa";
import { COOKIE_VISAO, lerVisao } from "@/modulos/tarefas/regras/visao";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { obterListaComTarefas, obterTarefa } from "@/modulos/tarefas/servicos/tarefas";

export const metadata: Metadata = { title: "Lista — IPEMaster OS" };

/** Converte "não encontrado" do serviço em 404; outros erros seguem. */
async function ou404<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
}

export default async function PaginaLista({ params, searchParams }: PageProps<"/tarefas/listas/[listaId]">) {
  const usuario = await exigirUsuario();
  if (!navegaEmEspacos(usuario)) redirect("/tarefas/minhas");

  const { listaId } = await params;
  const busca = await searchParams;
  const texto = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const filtros = esquemaFiltrosLista.parse({
    responsavel: texto(busca.responsavel),
    prioridade: texto(busca.prioridade),
    etiqueta: texto(busca.etiqueta),
    atrasadas: texto(busca.atrasadas),
  });

  const dados = await ou404(obterListaComTarefas(usuario, listaId, filtros));
  const idTarefa = texto(busca.tarefa);
  const detalhe = idTarefa ? await obterTarefa(usuario, idTarefa).catch(() => null) : null;
  const podeGerenciar = temPermissao(usuario.papel, "tarefas:gerenciar_listas");
  const visao = lerVisao((await cookies()).get(COOKIE_VISAO)?.value);

  // Mantém os filtros ao abrir e fechar o painel da tarefa.
  const paramsFiltros = new URLSearchParams(
    Object.entries({
      responsavel: filtros.responsavel,
      prioridade: filtros.prioridade,
      etiqueta: filtros.etiqueta,
      atrasadas: filtros.atrasadas ? "1" : undefined,
    })
      .filter((e): e is [string, string] => Boolean(e[1])),
  );
  const urlBase = `/tarefas/listas/${listaId}`;
  const urlFiltros = paramsFiltros.size ? `${urlBase}?${paramsFiltros}` : urlBase;
  const urlTarefa = (id: string) => {
    const p = new URLSearchParams(paramsFiltros);
    p.set("tarefa", id);
    return `${urlBase}?${p}`;
  };

  const semTarefas = dados.principais.length === 0 && dados.subtarefas.length === 0;
  const filtrando = paramsFiltros.size > 0;
  // Na Lista vazia e sem filtro, o campo de criar fica dentro do estado vazio.
  const criarNoVazio = visao === "lista" && semTarefas && !filtrando;
  const vazio = filtrando ? (
    <EstadoVazio icone={FilterXIcon} titulo="Nenhuma tarefa com estes filtros" descricao="Mude ou limpe os filtros para ver mais tarefas." />
  ) : (
    <EstadoVazio
      icone={ListTodoIcon}
      titulo="Crie a primeira tarefa desta lista"
      descricao="Dê um título; prazo, responsáveis e o resto você preenche depois."
      acao={<NovaTarefaRapida listaId={listaId} />}
    />
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <CabecalhoPagina
        titulo={dados.lista.nome}
        descricao={dados.lista.espaco.nome}
        acoes={
          <>
            <AlternarVisao visao={visao} />
            <FiltrosDaLista pessoas={dados.atribuiveis} etiquetas={dados.etiquetas} />
            {podeGerenciar && <ConfigurarStatus listaId={listaId} status={dados.status} />}
            {podeGerenciar && (
              <EditarLista
                lista={{ id: listaId, nome: dados.lista.nome }}
                totalTarefas={filtrando ? null : dados.principais.length + dados.subtarefas.length}
              />
            )}
          </>
        }
      />

      {!criarNoVazio && <NovaTarefaRapida listaId={listaId} />}

      {visao === "quadro" ? (
        <QuadroTarefas status={dados.status} principais={dados.principais} subtarefas={dados.subtarefas} modeloUrlTarefa={urlTarefa(ID_MODELO)} />
      ) : (
        <TabelaTarefas status={dados.status} principais={dados.principais} subtarefas={dados.subtarefas} urlTarefa={urlTarefa} vazio={vazio} />
      )}

      {detalhe && detalhe.tarefa.listaId === listaId && (
        <PainelTarefa
          key={detalhe.tarefa.id + detalhe.tarefa.atualizadoEm.toISOString()}
          dados={detalhe}
          urlFechar={urlFiltros}
          modeloUrlTarefa={urlTarefa(ID_MODELO)}
        />
      )}
    </div>
  );
}
