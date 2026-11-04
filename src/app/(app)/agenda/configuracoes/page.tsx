import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { GerenciarTipos } from "@/modulos/agenda/componentes/gerenciar-tipos";
import { LinkAssinatura } from "@/modulos/agenda/componentes/link-assinatura";
import { MinhasAgendas } from "@/modulos/agenda/componentes/minhas-agendas";
import { rotuloLeitura } from "@/modulos/agenda/regras/pessoal";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { LIMITE_AGENDAS, listarMinhasAgendas } from "@/modulos/agenda/servicos/agendas-externas";
import { temLinkAssinatura } from "@/modulos/agenda/servicos/assinatura";
import { listarTipos } from "@/modulos/agenda/servicos/tipos";

export const metadata: Metadata = { title: "Configurações da Agenda — IPEMaster OS" };

function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-card text-card-foreground grid min-w-0 grid-cols-1 gap-3 rounded-xl border p-4" aria-labelledby={id}>
      <div className="grid gap-1">
        <h2 id={id} className="text-base font-semibold">
          {titulo}
        </h2>
        <p className="text-muted-foreground max-w-2xl text-sm">{descricao}</p>
      </div>
      {children}
    </section>
  );
}

export default async function PaginaConfiguracoesAgenda() {
  const usuario = await exigirPermissaoPagina("agenda:usar");
  const gerenciaTipos = temPermissao(usuario.papel, "agenda:gerenciar_tipos");
  // A assinatura só traz o calendário da IPEMaster; sem ele, o feed responde 404.
  const assina = podeVerInstitucional(usuario.papel);
  const [agendas, temLink, tipos] = await Promise.all([
    listarMinhasAgendas(usuario),
    assina ? temLinkAssinatura(usuario) : false,
    gerenciaTipos ? listarTipos(usuario, { incluirInativos: true }) : [],
  ]);
  const agora = new Date();
  // Só textos para o componente: nada de Date nem URL completa.
  const linhas = agendas.map((a) => ({
    id: a.id,
    nome: a.nome,
    cor: a.cor,
    urlMascarada: a.urlMascarada,
    leitura: rotuloLeitura(a.ultimoSucessoEm, agora),
    ultimoErro: a.ultimoErro,
  }));

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6">
      <div className="grid min-w-0 gap-2">
        <Link href="/agenda" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeftIcon className="size-4" /> Agenda
        </Link>
        <CabecalhoPagina titulo="Configurações da agenda" />
      </div>

      <Secao
        id="titulo-minhas-agendas"
        titulo="Minhas agendas"
        descricao="Cole o link iCal da sua agenda do Google ou do Outlook para ver seus compromissos junto com o calendário da IPEMaster."
      >
        <MinhasAgendas agendas={linhas} limite={LIMITE_AGENDAS} />
      </Secao>

      {assina && (
        <Secao
          id="titulo-levar-google"
          titulo="Levar para o Google"
          descricao="Assine o calendário da IPEMaster no seu Google Agenda e veja as datas no celular."
        >
          <LinkAssinatura temLink={temLink} />
        </Secao>
      )}

      {gerenciaTipos && (
        <Secao
          id="titulo-tipos"
          titulo="Tipos de evento"
          descricao="Tipos inativos somem do formulário de novo evento, mas os eventos que já usam o tipo continuam no calendário."
        >
          <GerenciarTipos tipos={tipos} />
        </Secao>
      )}
    </div>
  );
}
