import { CalendarPlusIcon, CopyPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/componentes/ui/button";
import { ErroNegocio } from "@/lib/erros";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BarraCamadas } from "@/modulos/agenda/componentes/barra-camadas";
import { FormularioEvento } from "@/modulos/agenda/componentes/formulario-evento";
import { FormularioLote } from "@/modulos/agenda/componentes/formulario-lote";
import { AvisoAgendasComErro } from "@/modulos/agenda/componentes/minhas-agendas";
import { PainelEvento, PainelLateral } from "@/modulos/agenda/componentes/painel-evento";
import { CabecalhoAgenda, VisaoPadraoCelular } from "@/modulos/agenda/componentes/cabecalho-agenda";
import { lerData, lerFiltro, lerVisao } from "@/modulos/agenda/componentes/filtro";
import { ID_MODELO_EVENTO, itensDaAgenda, urlAgenda } from "@/modulos/agenda/componentes/item-agenda";
import { VisaoLista } from "@/modulos/agenda/componentes/visao-lista";
import { VisaoMes } from "@/modulos/agenda/componentes/visao-mes";
import { VisaoSemana } from "@/modulos/agenda/componentes/visao-semana";
import { intervaloDaVisao, tituloDoPeriodo } from "@/modulos/agenda/regras/disposicao";
import { navegar } from "@/modulos/agenda/regras/periodo";
import { itensPessoais } from "@/modulos/agenda/regras/pessoal";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { eventosDasMinhasAgendas } from "@/modulos/agenda/servicos/agendas-externas";
import { listarEventos, listarTurmas, obterEvento } from "@/modulos/agenda/servicos/eventos";
import { listarTarefasComEntrega } from "@/modulos/agenda/servicos/tarefas-na-agenda";
import { listarTipos } from "@/modulos/agenda/servicos/tipos";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : null);

/** Detalhe do evento, ou nulo quando está fora do alcance ("Não encontrado."). */
async function detalheDoEvento(...args: Parameters<typeof obterEvento>) {
  try {
    return await obterEvento(...args);
  } catch (erro) {
    if (erro instanceof ErroNegocio) return null;
    throw erro;
  }
}

export const metadata: Metadata = { title: "Agenda — IPEMaster OS" };

export default async function PaginaAgenda({ searchParams }: PageProps<"/agenda">) {
  const usuario = await exigirPermissaoPagina("agenda:usar");
  const busca = await searchParams;
  const filtro = await lerFiltro();
  const visao = lerVisao(busca, filtro);
  const data = lerData(busca);
  const hoje = diaEmSaoPaulo(new Date());
  const { de, ate } = intervaloDaVisao(visao, data);

  const institucional = podeVerInstitucional(usuario.papel);
  const comTarefas = temPermissao(usuario.papel, "tarefas:usar");
  const podeEditar = temPermissao(usuario.papel, "agenda:editar_institucional");
  // Um painel por vez: o evento vence o formulário. Formulário só para quem edita.
  const idEvento = texto(busca.evento);
  const novo = !idEvento && podeEditar && (busca.novo === "evento" || busca.novo === "lote") ? busca.novo : null;
  const [eventos, tarefas, tipos, turmas, detalhe, pessoal] = await Promise.all([
    institucional ? listarEventos(usuario, { de, ate, tipos: filtro.tipos, turma: filtro.turma }) : [],
    comTarefas && filtro.tarefas ? listarTarefasComEntrega(usuario, { de, ate }) : [],
    institucional ? listarTipos(usuario, { incluirInativos: false }) : [],
    institucional ? listarTurmas(usuario) : [],
    idEvento && institucional ? detalheDoEvento(usuario, idEvento) : null,
    // Sem agendas ligadas, é uma consulta só, sem leitura de iCal. Uma agenda que falha vira aviso.
    eventosDasMinhasAgendas(usuario, de, ate, filtro.desligadas),
  ]);

  // O professor não abre listas: a tarefa leva a Minhas tarefas.
  const abreLista = navegaEmEspacos(usuario);
  const itens = [
    ...itensDaAgenda(eventos, tarefas, {
      evento: (id) => urlAgenda(busca, { evento: id, novo: null }),
      tarefa: (t) => (abreLista ? `/tarefas/listas/${t.listaId}?tarefa=${t.id}` : "/tarefas/minhas"),
    }),
    // Convertidos aqui no servidor: para o navegador vão só textos (dia e hora de São Paulo), sem Date nem URL.
    ...itensPessoais(pessoal.eventos, pessoal.agendas),
  ];
  const agendas = pessoal.agendas.map(({ id, nome, cor }) => ({ id, nome, cor }));

  const semEvento = { evento: null, novo: null };
  const consulta = new URLSearchParams(
    Object.entries(busca).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();
  const urlFechar = urlAgenda(busca, semEvento);
  const hrefDia = (dia: string) => urlAgenda(busca, { ...semEvento, visao: "lista", data: dia });

  return (
    <div className="grid gap-4">
      {!busca.visao && !filtro.visao && <VisaoPadraoCelular consulta={consulta} />}
      <CabecalhoAgenda
        visao={visao}
        titulo={tituloDoPeriodo(visao, data)}
        filtro={filtro}
        consulta={consulta}
        hrefAnterior={urlAgenda(busca, { ...semEvento, data: navegar(visao, data, -1) })}
        hrefProximo={urlAgenda(busca, { ...semEvento, data: navegar(visao, data, 1) })}
        hrefHoje={urlAgenda(busca, { ...semEvento, data: null })}
        emHoje={data === hoje}
      >
        {podeEditar && (
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={urlAgenda(busca, { evento: null, novo: "lote" })} scroll={false}>
                <CopyPlusIcon /> Lançar várias datas
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={urlAgenda(busca, { evento: null, novo: "evento" })} scroll={false}>
                <CalendarPlusIcon /> Novo evento
              </Link>
            </Button>
          </>
        )}
      </CabecalhoAgenda>
      <BarraCamadas
        filtro={filtro}
        tipos={tipos}
        agendas={agendas}
        turmas={turmas}
        mostrarInstitucional={institucional}
        mostrarTarefas={comTarefas}
      />
      <AvisoAgendasComErro agendas={pessoal.agendas} />
      {visao === "mes" && <VisaoMes data={data} itens={itens} hoje={hoje} hrefDia={hrefDia} />}
      {visao === "semana" && <VisaoSemana data={data} itens={itens} hoje={hoje} />}
      {visao === "lista" && <VisaoLista data={data} itens={itens} hoje={hoje} />}

      {idEvento && (
        <PainelEvento
          key={idEvento}
          dados={detalhe}
          urlFechar={urlFechar}
          modeloUrlEvento={urlAgenda(busca, { evento: ID_MODELO_EVENTO, novo: null })}
          tipos={podeEditar ? tipos : []}
          turmas={podeEditar ? turmas : []}
        />
      )}
      {novo === "evento" && (
        <PainelLateral urlFechar={urlFechar} rotulo="novo evento" cabecalho={<span className="font-medium">Novo evento</span>}>
          <FormularioEvento tipos={tipos} turmas={turmas} hoje={hoje} urlFechar={urlFechar} />
        </PainelLateral>
      )}
      {novo === "lote" && (
        <PainelLateral urlFechar={urlFechar} rotulo="lançamento em lote" cabecalho={<span className="font-medium">Lançar várias datas</span>}>
          <FormularioLote tipos={tipos} turmas={turmas} hoje={hoje} urlFechar={urlFechar} />
        </PainelLateral>
      )}
    </div>
  );
}
