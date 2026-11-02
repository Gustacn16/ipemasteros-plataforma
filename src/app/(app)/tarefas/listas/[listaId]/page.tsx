import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { AlternarVisao } from "@/modulos/tarefas/componentes/alternar-visao";
import { ConfigurarStatus } from "@/modulos/tarefas/componentes/configurar-status";
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

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: dados.lista.espaco.cor }} aria-hidden />
            {dados.lista.espaco.nome}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{dados.lista.nome}</h1>
        </div>
        <div className="flex items-center gap-2">
          <AlternarVisao visao={visao} />
          {podeGerenciar && <ConfigurarStatus listaId={listaId} status={dados.status} />}
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <NovaTarefaRapida listaId={listaId} />
        <FiltrosDaLista pessoas={dados.atribuiveis} etiquetas={dados.etiquetas} />
      </div>

      {visao === "quadro" ? (
        <QuadroTarefas status={dados.status} principais={dados.principais} subtarefas={dados.subtarefas} modeloUrlTarefa={urlTarefa(ID_MODELO)} />
      ) : (
        <TabelaTarefas status={dados.status} principais={dados.principais} subtarefas={dados.subtarefas} urlTarefa={urlTarefa} />
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
