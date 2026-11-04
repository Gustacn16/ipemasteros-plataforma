import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { podeVerInstitucional } from "@/modulos/agenda/regras/visibilidade";
import { listarEventos } from "@/modulos/agenda/servicos/eventos";
import { PainelInicio } from "@/modulos/core/componentes/painel-inicio";
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

  const [grupos, eventos] = await Promise.all([
    comTarefas ? listarMinhasTarefas(usuario) : null,
    comAgenda
      ? listarEventos(usuario, { de: hoje, ate: somarDias(hoje, DIAS_INICIO) })
      : [],
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
    />
  );
}
