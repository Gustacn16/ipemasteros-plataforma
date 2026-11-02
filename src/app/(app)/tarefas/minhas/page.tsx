import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoConcluir } from "@/modulos/tarefas/componentes/botao-concluir";
import { BadgePrioridade, DataEntrega, PontoCor } from "@/modulos/tarefas/componentes/exibicao";
import { GRUPOS_MINHAS, ROTULO_GRUPO_MINHAS } from "@/modulos/tarefas/regras/prazo";
import { navegaEmEspacos } from "@/modulos/tarefas/servicos/acesso";
import { listarMinhasTarefas } from "@/modulos/tarefas/servicos/tarefas";

export const metadata: Metadata = { title: "Minhas tarefas — IPEMaster OS" };

export default async function PaginaMinhasTarefas() {
  const usuario = await exigirPermissaoPagina("tarefas:usar");
  const grupos = await listarMinhasTarefas(usuario);
  const total = GRUPOS_MINHAS.reduce((n, g) => n + grupos[g].length, 0);
  // O professor não abre listas; os demais abrem a tarefa no painel da lista.
  const abreLista = navegaEmEspacos(usuario);

  return (
    <div className="grid max-w-4xl gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Minhas tarefas</h1>
        <p className="text-muted-foreground">
          {total === 0 ? "Nada pendente com você." : `${total} ${total === 1 ? "tarefa aberta" : "tarefas abertas"} com você.`}
        </p>
      </header>

      {GRUPOS_MINHAS.filter((g) => grupos[g].length > 0).map((g) => (
        <section key={g} aria-labelledby={`grupo-${g}`} className="grid gap-2">
          <h2 id={`grupo-${g}`} className={g === "atrasadas" ? "font-semibold text-red-600" : "font-semibold"}>
            {ROTULO_GRUPO_MINHAS[g]} <span className="text-muted-foreground font-normal">{grupos[g].length}</span>
          </h2>
          <ul className="divide-y rounded-md border">
            {grupos[g].map((t) => {
              const conteudo = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.titulo}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                      <PontoCor cor={t.lista.espaco.cor} className="size-2" />
                      {t.lista.espaco.nome} › {t.lista.nome} · {t.status.nome}
                    </span>
                  </span>
                  <BadgePrioridade prioridade={t.prioridade} />
                  <span className="w-12 text-right text-sm">
                    <DataEntrega data={t.dataEntrega} />
                  </span>
                </>
              );
              return (
                <li key={t.id}>
                  {abreLista ? (
                    <Link href={`/tarefas/listas/${t.lista.id}?tarefa=${t.id}`} className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2">
                      {conteudo}
                      {t.lista.status[0] && <BotaoConcluir tarefaId={t.id} statusId={t.lista.status[0].id} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
