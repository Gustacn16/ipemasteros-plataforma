"use client";

import { ArrowDownIcon, ArrowUpIcon, TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { mascararReais } from "@/lib/dinheiro";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirIndicadorAcao, moverIndicadorAcao, salvarIndicadorAcao, salvarMetasIndicadorAcao } from "../acoes/planejamento";
import { FONTES, ROTULO_FONTE, type Fonte, type ParametrosFonte } from "../regras/fontes";
import { mesTravado } from "../regras/fechamento";
import { mesesDoAno } from "../regras/meses";
import type { IndicadorCadastro, OpcoesIndicador } from "../servicos/indicadores";
import { numeroParaCampo, rotuloMesCurto } from "./formatar";
import { CampoSimples, Escolha, classeCampo, useAcao } from "./ui-plano";

const ROTULO_FRENTE = { comercial: "Comercial", marketing: "Marketing" } as const;

function FormIndicador({ planoId, indicador, opcoes, frente, aoSalvar }: { planoId: string; indicador?: IndicadorCadastro; opcoes: OpcoesIndicador; frente: "comercial" | "marketing"; aoSalvar?: () => void }) {
  const [estado, executar, salvando] = useAcao(salvarIndicadorAcao, aoSalvar);
  const [fonte, setFonte] = useState<Fonte>((indicador?.fonte as Fonte) ?? "manual");
  const [params, setParams] = useState<ParametrosFonte>(indicador?.fonteParametros ?? {});
  const doPlano = Boolean(indicador?.metaCalculada);
  const canal = opcoes.canais.find((c) => c.id === params.canalId);
  const e = estado.erros ?? {};
  return (
    <form action={executar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="planoId" value={planoId} />
      {indicador && <input type="hidden" name="id" value={indicador.id} />}
      <input type="hidden" name="frente" value={indicador?.frente ?? frente} />
      <input type="hidden" name="fonteParametros" value={JSON.stringify(params)} />
      <CampoSimples rotulo="Nome" name="nome" defaultValue={indicador?.nome ?? ""} erros={e.nome} className="sm:col-span-2" />
      <CampoSimples rotulo="Grupo" name="grupo" defaultValue={indicador?.grupo ?? ""} placeholder="ex.: Newsletter" erros={e.grupo} disabled={doPlano} />
      <Escolha rotulo="Responsável" name="responsavelId" defaultValue={indicador?.responsavelId ?? ""}>
        <option value="">Ninguém</option>
        {opcoes.pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </Escolha>
      <Escolha rotulo="Unidade" name="unidade" defaultValue={indicador?.unidade ?? "numero"} disabled={doPlano}>
        <option value="numero">Número</option>
        <option value="reais">R$</option>
        <option value="percentual">%</option>
      </Escolha>
      <Escolha rotulo="Melhor quando" name="sentido" defaultValue={indicador?.sentido ?? "maior_melhor"} disabled={doPlano}>
        <option value="maior_melhor">Maior</option>
        <option value="menor_melhor">Menor</option>
      </Escolha>
      <Escolha rotulo="Como soma o ano" name="tipo" defaultValue={indicador?.tipo ?? "fluxo"} disabled={doPlano}>
        <option value="fluxo">Soma dos meses (posts, leads)</option>
        <option value="estoque">Número do fim do mês (seguidores)</option>
        <option value="taxa">Média (taxas)</option>
      </Escolha>
      <Escolha rotulo="De onde vem o realizado" name="fonte" value={fonte} onChange={(ev) => setFonte(ev.target.value as Fonte)} disabled={doPlano}>
        {FONTES.filter((f) => doPlano || !["calc_cac", "calc_conversao"].includes(f)).map((f) => (
          <option key={f} value={f}>
            {ROTULO_FONTE[f]}
          </option>
        ))}
      </Escolha>
      {/* Campo desabilitado não vai no formulário: repete os valores travados. */}
      {doPlano && indicador && (
        <>
          <input type="hidden" name="grupo" value={indicador.grupo} />
          <input type="hidden" name="unidade" value={indicador.unidade} />
          <input type="hidden" name="sentido" value={indicador.sentido} />
          <input type="hidden" name="tipo" value={indicador.tipo} />
          <input type="hidden" name="fonte" value={indicador.fonte} />
        </>
      )}
      {!doPlano && (fonte === "instagram_seguidores" || fonte === "instagram_alcance") && (
        <Escolha rotulo="Conta do Instagram" name="_conta" value={params.contaId ?? ""} onChange={(ev) => setParams({ contaId: ev.target.value || undefined })}>
          <option value="">Escolha…</option>
          {opcoes.contas.map((c) => (
            <option key={c.id} value={c.id}>
              @{c.usuario}
            </option>
          ))}
        </Escolha>
      )}
      {!doPlano && fonte === "conteudos_publicados" && (
        <>
          <Escolha rotulo="Canal" name="_canal" value={params.canalId ?? ""} onChange={(ev) => setParams({ canalId: ev.target.value || undefined })}>
            <option value="">Escolha…</option>
            {opcoes.canais.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Escolha>
          {canal && canal.formatos.length > 0 && (
            <fieldset className="grid gap-1 sm:col-span-2">
              <legend className="text-sm font-medium">Formatos que contam (nenhum marcado = todos)</legend>
              <div className="flex flex-wrap gap-3">
                {canal.formatos.map((f) => (
                  <label key={f.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={params.formatoIds?.includes(f.id) ?? false}
                      onChange={(ev) => {
                        const atuais = params.formatoIds ?? [];
                        const formatoIds = ev.target.checked ? [...atuais, f.id] : atuais.filter((x) => x !== f.id);
                        setParams({ ...params, formatoIds: formatoIds.length ? formatoIds : undefined });
                      }}
                    />
                    {f.nome}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="noPainel" defaultChecked={indicador?.noPainel ?? true} /> Mostrar no Painel
      </label>
      {estado.mensagem && !estado.ok && <p className="text-destructive text-sm sm:col-span-2 lg:col-span-4">{estado.mensagem}</p>}
      <div className="flex justify-end sm:col-span-2 lg:col-span-4">
        <Button type="submit" size="sm" disabled={salvando}>
          {salvando ? "Salvando…" : indicador ? "Salvar indicador" : "Criar indicador"}
        </Button>
      </div>
    </form>
  );
}

function GradeMetas({ indicador, ano, hoje, mesCriacao }: { indicador: IndicadorCadastro; ano: number; hoje: string; mesCriacao: string }) {
  const travado = (m: string) => mesTravado(m, hoje, mesCriacao);
  const meses = mesesDoAno(ano);
  const emReais = indicador.unidade === "reais";
  const noCampo = (v: string) => (emReais ? mascararReais(v) : v);
  const inicial = Object.fromEntries(meses.map((m) => [m, noCampo(numeroParaCampo(indicador.metas[m]))]));
  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [, executar, salvando] = useAcao(salvarMetasIndicadorAcao);
  const abertos = meses.filter((m) => !travado(m));
  const repetir = () => {
    const primeiro = valores[abertos[0]] ?? "";
    setValores((v) => ({ ...v, ...Object.fromEntries(abertos.map((m) => [m, primeiro])) }));
  };
  const sufixo = indicador.unidade === "percentual" ? " (%)" : indicador.unidade === "reais" ? " (R$)" : "";
  return (
    <form action={executar} className="grid gap-2">
      <input type="hidden" name="indicadorId" value={indicador.id} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Meta por mês{sufixo}</p>
        {abertos.length > 1 && (
          <Button type="button" variant="outline" size="sm" onClick={repetir}>
            Repetir em todos os meses
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {meses.map((m) => (
          <label key={m} className="grid gap-0.5 text-xs">
            <span className="text-muted-foreground capitalize">{rotuloMesCurto(m)}</span>
            <input
              name={`mes:${m}`}
              inputMode="decimal"
              value={valores[m]}
              disabled={travado(m)}
              title={travado(m) ? "Mês fechado: a meta não muda mais." : undefined}
              onChange={(ev) => setValores((v) => ({ ...v, [m]: noCampo(ev.target.value) }))}
              className={`${classeCampo} h-8 px-2`}
            />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar metas"}
        </Button>
      </div>
    </form>
  );
}

function LinhaIndicador({ i, planoId, opcoes, ano, hoje, mesCriacao, primeiro, ultimo }: { i: IndicadorCadastro; planoId: string; opcoes: OpcoesIndicador; ano: number; hoje: string; mesCriacao: string; primeiro: boolean; ultimo: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; mensagem?: string }>) =>
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) avisar(r);
      else router.refresh();
    });
  return (
    <details className="bg-card group rounded-lg border">
      <summary className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{i.nome}</span>
          {i.grupo && <span className="text-muted-foreground"> · {i.grupo}</span>}
          {!i.noPainel && <span className="text-muted-foreground"> · fora do Painel</span>}
        </span>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          {i.metaCalculada ? "Meta do plano" : "Meta digitada"} · {i.fonte === "manual" ? "lançado à mão" : "automático"}
        </span>
        <span className="flex gap-0.5" onClick={(ev) => ev.preventDefault()}>
          <Button variant="ghost" size="sm" aria-label="Subir" disabled={primeiro || pendente} onClick={() => rodar(() => moverIndicadorAcao(i.id, "subir"))}>
            <ArrowUpIcon />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Descer" disabled={ultimo || pendente} onClick={() => rodar(() => moverIndicadorAcao(i.id, "descer"))}>
            <ArrowDownIcon />
          </Button>
          {!i.metaCalculada && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Excluir ${i.nome}`}
              disabled={pendente}
              onClick={() => {
                if (confirm(`Excluir o indicador "${i.nome}"?`)) rodar(() => excluirIndicadorAcao(i.id));
              }}
            >
              <TrashIcon />
            </Button>
          )}
        </span>
      </summary>
      <div className="grid gap-4 border-t p-3">
        <FormIndicador planoId={planoId} indicador={i} opcoes={opcoes} frente={i.frente} />
        {i.metaCalculada ? (
          <p className="text-muted-foreground text-sm">A meta deste indicador é calculada pelo plano (turmas, metas avulsas e premissas do funil).</p>
        ) : (
          <GradeMetas indicador={i} ano={ano} hoje={hoje} mesCriacao={mesCriacao} />
        )}
      </div>
    </details>
  );
}

export function IndicadoresCadastro({ planoId, ano, hoje, mesCriacao, indicadores, opcoes }: { planoId: string; ano: number; hoje: string; mesCriacao: string; indicadores: IndicadorCadastro[]; opcoes: OpcoesIndicador }) {
  const [chaves, setChaves] = useState({ comercial: 0, marketing: 0 });
  return (
    <div className="grid gap-8">
      {(["comercial", "marketing"] as const).map((frente) => {
        const lista = indicadores.filter((i) => i.frente === frente);
        return (
          <section key={frente} className="grid gap-2">
            <h2 className="font-semibold">{ROTULO_FRENTE[frente]}</h2>
            {lista.map((i, idx) => (
              <LinhaIndicador key={i.id} i={i} planoId={planoId} opcoes={opcoes} ano={ano} hoje={hoje} mesCriacao={mesCriacao} primeiro={idx === 0} ultimo={idx === lista.length - 1} />
            ))}
            <details key={chaves[frente]} className="rounded-lg border border-dashed">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">+ Novo indicador de {ROTULO_FRENTE[frente]}</summary>
              <div className="border-t p-3">
                <FormIndicador planoId={planoId} opcoes={opcoes} frente={frente} aoSalvar={() => setChaves((c) => ({ ...c, [frente]: c[frente] + 1 }))} />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
