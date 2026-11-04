"use client";

import { Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { Separator } from "@/componentes/ui/separator";
import { formatarDataHora } from "@/lib/datas";
import { atualizarTarefaAcao, excluirTarefaAcao, mudarStatusAcao } from "../acoes/tarefas";
import { PRIORIDADES, ROTULO_PRIORIDADE, type Prioridade } from "../esquemas/tarefa";
import { ERRO_SUBTAREFAS_ABERTAS } from "../regras/status";
import type { obterTarefa } from "../servicos/tarefas";
import { avisar } from "./avisar";
import { ChecklistTarefa } from "./checklist-tarefa";
import { ChipPrazo, ChipStatus } from "./chips-tarefa";
import { EtiquetasTarefa } from "./etiquetas";
import { CLASSE_TITULO_SECAO, PontoCor, valorInputData } from "./exibicao";
import { HistoricoTarefa } from "./historico-tarefa";
import { ID_MODELO } from "./modelo-url";
import { NovaTarefaRapida } from "./nova-tarefa-rapida";

type Dados = Awaited<ReturnType<typeof obterTarefa>>;

const ID_FORMULARIO = "formulario-tarefa";
const estiloCampo = "border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm disabled:opacity-70";

/** Painel lateral com o detalhe da tarefa (tela cheia no celular). */
export function PainelTarefa({ dados, urlFechar, modeloUrlTarefa }: { dados: Dados; urlFechar: string; modeloUrlTarefa: string }) {
  const { tarefa, statusDaLista, atribuiveis, etiquetasDoEspaco, podeEditar, podeExcluir, podeGerenciarEtiquetas } = dados;
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const [statusAtual, setStatusAtual] = useState(tarefa.statusId);
  const [responsaveis, setResponsaveis] = useState(() => tarefa.responsaveis.map((r) => r.usuario.id));

  const fechar = () => router.push(urlFechar, { scroll: false });
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && router.push(urlFechar, { scroll: false });
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [router, urlFechar]);

  // Quem saiu do espaço continua listado enquanto for responsável (regra 7).
  const idsAtribuiveis = new Set(atribuiveis.map((p) => p.id));
  const pessoas = [
    ...atribuiveis,
    ...tarefa.responsaveis.map((r) => r.usuario).filter((u) => !idsAtribuiveis.has(u.id)),
  ];

  function mudarStatus(statusId: string) {
    const anterior = statusAtual;
    setStatusAtual(statusId);
    iniciar(async () => {
      let r = await mudarStatusAcao({ tarefaId: tarefa.id, statusId });
      if (!r.ok && r.mensagem === ERRO_SUBTAREFAS_ABERTAS) {
        if (!window.confirm(ERRO_SUBTAREFAS_ABERTAS)) {
          setStatusAtual(anterior);
          return;
        }
        r = await mudarStatusAcao({ tarefaId: tarefa.id, statusId, confirmarSubtarefasAbertas: true });
      }
      if (!avisar(r)) setStatusAtual(anterior);
    });
  }

  function salvar(formData: FormData) {
    iniciar(async () => {
      const r = await atualizarTarefaAcao({
        tarefaId: tarefa.id,
        titulo: formData.get("titulo"),
        descricao: formData.get("descricao") ?? "",
        prioridade: formData.get("prioridade"),
        dataInicio: formData.get("dataInicio") ?? "",
        dataEntrega: formData.get("dataEntrega") ?? "",
        responsaveis,
      });
      setErros(r.erros ?? {});
      avisar(r);
    });
  }

  function excluir() {
    if (!window.confirm("Excluir esta tarefa e as subtarefas dela?")) return;
    iniciar(async () => {
      if (avisar(await excluirTarefaAcao(tarefa.id))) fechar();
    });
  }

  const urlDe = (id: string) => modeloUrlTarefa.replace(ID_MODELO, id);
  const rotuloSalvar = pendente ? "Salvando…" : "Salvar alterações";
  const erroDe = (campo: string) =>
    erros[campo] && <p className="text-destructive text-sm">{erros[campo]!.join(" ")}</p>;

  const statusDaTarefa = statusDaLista.find((s) => s.id === statusAtual) ?? tarefa.status;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar tarefa" className="absolute inset-0 bg-black/20" onClick={fechar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-painel"
        className="bg-background relative flex h-full w-full scroll-pb-20 flex-col overflow-y-auto shadow-xl sm:max-w-xl sm:scroll-pb-0"
      >
        <header className="bg-background sticky top-0 z-10 grid gap-2 border-b px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p id="titulo-painel" className="text-muted-foreground min-w-0 truncate text-sm">
              {tarefa.lista.espaco.nome} › {tarefa.lista.nome}
              {tarefa.tarefaPai && (
                <>
                  {" › "}
                  <Link href={urlDe(tarefa.tarefaPai.id)} scroll={false} className="underline-offset-4 hover:underline">
                    {tarefa.tarefaPai.titulo}
                  </Link>
                </>
              )}
            </p>
            <div className="flex shrink-0 gap-1">
              {podeExcluir && (
                <Button type="button" variant="ghost" size="icon" onClick={excluir} disabled={pendente} aria-label="Excluir tarefa">
                  <Trash2Icon />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" onClick={fechar} aria-label="Fechar">
                <XIcon />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipStatus nome={statusDaTarefa.nome} cor={statusDaTarefa.cor} />
            <ChipPrazo dataEntrega={tarefa.dataEntrega} concluidaEm={tarefa.concluidaEm} />
          </div>
        </header>

        <div className="grid flex-1 gap-5 p-5">
          <section className="grid gap-4" aria-labelledby="titulo-detalhes">
            <h3 id="titulo-detalhes" className={CLASSE_TITULO_SECAO}>
              Detalhes
            </h3>
            <div className="grid gap-1.5">
              <Label htmlFor="status-tarefa">Status</Label>
              <select
                id="status-tarefa"
                className={estiloCampo}
                value={statusAtual}
                disabled={pendente}
                onChange={(e) => mudarStatus(e.target.value)}
              >
                {statusDaLista.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <form id={ID_FORMULARIO} action={salvar} className="grid gap-4">
              <fieldset disabled={!podeEditar || pendente} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="titulo-tarefa">Título</Label>
                  <Input id="titulo-tarefa" name="titulo" defaultValue={tarefa.titulo} maxLength={200} required />
                  {erroDe("titulo")}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="inicio-tarefa">Início</Label>
                    <input id="inicio-tarefa" type="date" name="dataInicio" className={estiloCampo} defaultValue={valorInputData(tarefa.dataInicio)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="entrega-tarefa">Entrega</Label>
                    <input id="entrega-tarefa" type="date" name="dataEntrega" className={estiloCampo} defaultValue={valorInputData(tarefa.dataEntrega)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="prioridade-tarefa">Prioridade</Label>
                    <select id="prioridade-tarefa" name="prioridade" className={estiloCampo} defaultValue={tarefa.prioridade}>
                      {PRIORIDADES.map((p: Prioridade) => (
                        <option key={p} value={p}>
                          {ROTULO_PRIORIDADE[p]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {erroDe("dataInicio")}

                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium">Responsáveis</legend>
                  <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2">
                    {pessoas.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={responsaveis.includes(p.id)}
                          onChange={(e) =>
                            setResponsaveis((atual) => (e.target.checked ? [...atual, p.id] : atual.filter((id) => id !== p.id)))
                          }
                        />
                        {p.nome}
                        {!idsAtribuiveis.has(p.id) && <span className="text-muted-foreground text-xs">(não é mais membro)</span>}
                      </label>
                    ))}
                  </div>
                  {erroDe("responsaveis")}
                </fieldset>

                <div className="grid gap-1.5">
                  <Label htmlFor="descricao-tarefa">Descrição</Label>
                  <textarea
                    id="descricao-tarefa"
                    name="descricao"
                    rows={5}
                    maxLength={20000}
                    defaultValue={tarefa.descricao ?? ""}
                    className={estiloCampo}
                  />
                </div>

                {/* No celular o botão fica na barra fixa do rodapé (abaixo). */}
                {podeEditar && (
                  <Button type="submit" className="hidden justify-self-start sm:inline-flex">
                    {rotuloSalvar}
                  </Button>
                )}
              </fieldset>
            </form>
          </section>

          <Separator />

          <EtiquetasTarefa
            tarefaId={tarefa.id}
            espacoId={tarefa.lista.espacoId}
            selecionadas={tarefa.etiquetas.map((e) => e.etiqueta)}
            doEspaco={etiquetasDoEspaco}
            podeEditar={podeEditar}
            podeCriar={podeGerenciarEtiquetas}
          />

          <Separator />

          <ChecklistTarefa tarefaId={tarefa.id} itens={tarefa.checklist} />

          {!tarefa.tarefaPaiId && (
            <>
              <Separator />
              <section className="grid gap-2" aria-labelledby="titulo-subtarefas">
                <h3 id="titulo-subtarefas" className={CLASSE_TITULO_SECAO}>
                  Subtarefas
                </h3>
                {tarefa.subtarefas.length > 0 && (
                  <ul className="grid gap-1">
                    {tarefa.subtarefas.map((s) => (
                      <li key={s.id}>
                        <Link
                          href={urlDe(s.id)}
                          scroll={false}
                          className="hover:bg-muted flex items-center gap-2 rounded px-2 py-1 text-sm"
                        >
                          <PontoCor cor={s.status.cor} />
                          <span className={s.concluidaEm ? "text-muted-foreground line-through" : ""}>{s.titulo}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {podeEditar && <NovaTarefaRapida listaId={tarefa.listaId} tarefaPaiId={tarefa.id} rotulo="Nova subtarefa" />}
              </section>
            </>
          )}

          <Separator />

          <div>
            <HistoricoTarefa linhas={tarefa.historico} criadaPor={tarefa.criadoPor.nome} criadaEm={tarefa.criadoEm} />
            {tarefa.concluidaEm && <p className="text-muted-foreground mt-3 text-xs">Concluída em {formatarDataHora(tarefa.concluidaEm)}</p>}
          </div>
        </div>

        {podeEditar && (
          <div className="bg-background sticky bottom-0 z-10 border-t px-5 py-3 sm:hidden">
            <Button type="submit" form={ID_FORMULARIO} disabled={pendente} className="w-full">
              {rotuloSalvar}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
