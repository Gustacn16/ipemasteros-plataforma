import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { AvisoAniversarios } from "@/modulos/academico/componentes/aviso-aniversarios";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { listarEventos } from "@/modulos/agenda/servicos/eventos";
import { PainelInicio } from "@/modulos/core/componentes/painel-inicio";
import { ResumoMesInicio } from "@/modulos/planejamento/componentes/resumo-mes-inicio";
import { obterResumoDoMes } from "@/modulos/planejamento/servicos/visoes";
import { DIAS_INICIO } from "@/modulos/core/regras/inicio";
import { diaEmSaoPaulo, somarDias } from "@/modulos/tarefas/regras/prazo";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { listarMinhasTarefas } from "@/modulos/tarefas/servicos/tarefas";

export const metadata: Metadata = { title: "Início — IPEMaster OS" };

export default async function PaginaInicio({
  searchParams,
}: PageProps<"/inicio">) {
  const usuario = await exigirUsuario();
  const { erro } = await searchParams;
  const agora = new Date();
  const hoje = diaEmSaoPaulo(agora);
  const comTarefas = temPermissao(usuario.papel, "tarefas:usar");
  const comAgenda =
    temPermissao(usuario.papel, "agenda:usar") &&
    podeVerInstitucional(usuario.papel);

  const comResumo =
    temPermissao(usuario.papel, "comercial:ver") &&
    temPermissao(usuario.papel, "planejamento:ver");

  const [grupos, eventos, resumo] = await Promise.all([
    comTarefas ? listarMinhasTarefas(usuario) : null,
    comAgenda
      ? listarEventos(usuario, { de: hoje, ate: somarDias(hoje, DIAS_INICIO) })
      : [],
    // Um erro no resumo não pode derrubar o Início: o bloco aparece com "—" e um aviso.
    comResumo
      ? obterResumoDoMes(usuario).catch((e: unknown) => {
          console.error("Resumo do mês no Início falhou", e);
          return "falhou" as const;
        })
      : null,
  ]);

  return (
    <PainelInicio
      nome={usuario.apelido ?? usuario.nome.split(" ")[0]}
      grupos={grupos}
      eventos={eventos}
      comTarefas={comTarefas}
      comAgenda={comAgenda}
      // O professor não abre listas; ele conclui pela tela "Minhas tarefas".
      abreLista={navegaEmEspacos(usuario)}
      hoje={hoje}
      agora={agora}
      erro={erro}
      aviso={<AvisoAniversarios usuario={usuario} />}
      resumo={
        resumo ? (
          <ResumoMesInicio
            mes={hoje.slice(0, 7)}
            resumo={resumo === "falhou" ? null : resumo}
          />
        ) : undefined
      }
    />
  );
}
