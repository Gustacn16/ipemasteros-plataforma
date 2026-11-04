import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarRange, CalendarX, ListChecks } from "lucide-react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoConcluir } from "@/modulos/tarefas/componentes/botao-concluir";
import { ChipPrazo, ChipStatus } from "@/modulos/tarefas/componentes/chips-tarefa";
import { PontoCor } from "@/modulos/tarefas/componentes/exibicao";
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
  const agora = new Date();

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6">
      <CabecalhoPagina
        titulo="Minhas tarefas"
        descricao={total === 0 ? "Nada pendente com você." : `${total} ${total === 1 ? "tarefa aberta" : "tarefas abertas"} com você.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoNumero rotulo="Atrasadas" icone={CalendarX} valor={grupos.atrasadas.length} tom="perigo" />
        <CartaoNumero rotulo="Hoje" icone={CalendarClock} valor={grupos.hoje.length} tom="atencao" />
        <CartaoNumero rotulo="Próximos 7 dias" icone={CalendarRange} valor={grupos.proximos7.length} />
      </div>

      {total === 0 && (
        <EstadoVazio
          icone={ListChecks}
          titulo="Nada atribuído a você"
          descricao="Quando alguém te atribuir uma tarefa, ela aparece aqui."
        />
      )}

      {GRUPOS_MINHAS.filter((g) => grupos[g].length > 0).map((g) => (
        <section key={g} aria-labelledby={`grupo-${g}`} className="grid gap-2">
          <h2 id={`grupo-${g}`} className={g === "atrasadas" ? "text-perigo font-semibold" : "text-foreground font-semibold"}>
            {ROTULO_GRUPO_MINHAS[g]} <span className="text-muted-foreground font-normal tabular-nums">{grupos[g].length}</span>
          </h2>
          <ul className="bg-card divide-y rounded-xl border">
            {grupos[g].map((t) => {
              const conteudo = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block truncate font-medium">{t.titulo}</span>
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                      <PontoCor cor={t.lista.espaco.cor} className="size-2" />
                      <span className="truncate">
                        {t.lista.espaco.nome} › {t.lista.nome}
                      </span>
                    </span>
                  </span>
                  <span className="flex min-w-0 max-w-[55%] flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <ChipPrazo dataEntrega={t.dataEntrega} agora={agora} />
                    <ChipStatus nome={t.status.nome} cor={t.status.cor} />
                  </span>
                </>
              );
              return (
                <li key={t.id}>
                  {abreLista ? (
                    <Link href={`/tarefas/listas/${t.lista.id}?tarefa=${t.id}`} className="hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5">
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
