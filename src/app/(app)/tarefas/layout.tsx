import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { MenuTarefas } from "@/modulos/tarefas/componentes/menu-tarefas";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { listarArvore } from "@/modulos/tarefas/servicos/espacos";

/** Área do módulo Tarefas: menu próprio (Minhas tarefas e espaços) ao lado do conteúdo. */
export default async function LayoutTarefas({ children }: { children: React.ReactNode }) {
  const usuario = await exigirPermissaoPagina("tarefas:usar");
  // O professor não navega em espaços: vê só Minhas tarefas.
  const espacos = navegaEmEspacos(usuario) ? await listarArvore(usuario) : null;

  return (
    // Ocupa a área do <main> inteira, anulando o padding dele.
    <div className="-m-4 flex flex-1 flex-col md:-m-8 md:flex-row">
      <MenuTarefas
        espacos={espacos}
        podeCriarEspaco={temPermissao(usuario.papel, "tarefas:gerenciar_espacos")}
        podeCriarLista={temPermissao(usuario.papel, "tarefas:gerenciar_listas")}
      />
      <div className="min-w-0 flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
