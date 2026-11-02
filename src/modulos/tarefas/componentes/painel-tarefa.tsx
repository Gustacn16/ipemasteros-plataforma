"use client";

import { Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { formatarDataHora } from "@/lib/datas";
import { atualizarTarefaAcao, excluirTarefaAcao, mudarStatusAcao } from "../acoes/tarefas";
import { PRIORIDADES, ROTULO_PRIORIDADE, type Prioridade } from "../esquemas/tarefa";
import { ERRO_SUBTAREFAS_ABERTAS } from "../regras/status";
import type { obterTarefa } from "../servicos/tarefas";
import { avisar } from "./avisar";
import { ChecklistTarefa } from "./checklist-tarefa";
import { EtiquetasTarefa } from "./etiquetas";
import { PontoCor, valorInputData } from "./exibicao";
import { HistoricoTarefa } from "./historico-tarefa";
import { NovaTarefaRapida } from "./nova-tarefa-rapida";

export const ID_MODELO = "__tarefa__";

type Dados = Awaited<ReturnType<typeof obterTarefa>>;

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
  const erroDe = (campo: string) =>
    erros[campo] && <p className="text-destructive text-sm">{erros[campo]!.join(" ")}</p>;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Fechar tarefa" className="absolute inset-0 bg-black/20" onClick={fechar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-painel"
        className="bg-background relative flex h-full w-full flex-col overflow-y-auto shadow-xl sm:max-w-xl"
      >
        <div className="bg-background sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-5 py-3">
          <p id="titulo-painel" className="text-muted-foreground truncate text-sm">
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

        <div className="grid gap-5 p-5">
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

          <EtiquetasTarefa
            tarefaId={tarefa.id}
            espacoId={tarefa.lista.espacoId}
            selecionadas={tarefa.etiquetas.map((e) => e.etiqueta)}
            doEspaco={etiquetasDoEspaco}
            podeEditar={podeEditar}
            podeCriar={podeGerenciarEtiquetas}
          />

          <ChecklistTarefa tarefaId={tarefa.id} itens={tarefa.checklist} />

          <form action={salvar} className="grid gap-4 border-t pt-5">
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

              {podeEditar && (
                <Button type="submit" className="justify-self-start">
                  {pendente ? "Salvando…" : "Salvar alterações"}
                </Button>
              )}
            </fieldset>
          </form>

          {!tarefa.tarefaPaiId && (
            <section className="grid gap-2" aria-labelledby="titulo-subtarefas">
              <h3 id="titulo-subtarefas" className="text-sm font-medium">
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
          )}

          <div className="border-t pt-5">
            <HistoricoTarefa linhas={tarefa.historico} criadaPor={tarefa.criadoPor.nome} criadaEm={tarefa.criadoEm} />
            {tarefa.concluidaEm && <p className="text-muted-foreground mt-3 text-xs">Concluída em {formatarDataHora(tarefa.concluidaEm)}</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
