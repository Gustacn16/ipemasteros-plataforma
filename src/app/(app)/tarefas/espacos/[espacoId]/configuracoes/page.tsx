import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { ExcluirEspaco, FormularioDadosEspaco, MembrosEspaco } from "@/modulos/tarefas/componentes/configuracoes-espaco";
import { obterConfiguracaoEspaco } from "@/modulos/tarefas/servicos/espacos";

export const metadata: Metadata = { title: "Configurações do espaço — IPEMaster OS" };

export default async function PaginaConfiguracoesEspaco({ params }: PageProps<"/tarefas/espacos/[espacoId]/configuracoes">) {
  const usuario = await exigirPermissaoPagina("tarefas:gerenciar_espacos");
  const { espacoId } = await params;
  const dados = await obterConfiguracaoEspaco(usuario, espacoId).catch((erro) => {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  });

  return (
    <div className="grid max-w-3xl gap-8">
      <header>
        <p className="text-muted-foreground text-sm">Configurações do espaço</p>
        <h1 className="text-2xl font-semibold tracking-tight">{dados.espaco.nome}</h1>
      </header>

      <section className="grid gap-3" aria-labelledby="sec-dados">
        <h2 id="sec-dados" className="font-semibold">
          Dados
        </h2>
        <FormularioDadosEspaco espaco={dados.espaco} />
      </section>

      <section className="grid gap-3" aria-labelledby="sec-membros">
        <div>
          <h2 id="sec-membros" className="font-semibold">
            Membros
          </h2>
          <p className="text-muted-foreground text-sm">Quem participa deste departamento vê o espaço e pode receber tarefas dele.</p>
        </div>
        <MembrosEspaco espacoId={espacoId} usuarios={dados.usuarios} membroIds={dados.membroIds} />
      </section>

      <section className="grid gap-3 border-t pt-6" aria-labelledby="sec-excluir">
        <h2 id="sec-excluir" className="font-semibold">
          Excluir espaço
        </h2>
        <p className="text-muted-foreground text-sm">O conteúdo não é apagado do banco, só deixa de aparecer.</p>
        <div>
          <ExcluirEspaco espaco={dados.espaco} />
        </div>
      </section>
    </div>
  );
}
