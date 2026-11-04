"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { criarLoteAcao } from "../acoes/agenda";
import { MAX_LOTE, periodoPadraoFimDeSemana, titulosDoLote } from "../regras/periodo";
import {
  BarraSalvarCelular,
  Campo,
  CampoTipo,
  CamposFinais,
  CamposHora,
  CamposTurmaLocal,
  ErroCampo,
  estiloCampo,
  lerCamposComuns,
  type Erros,
  type OpcaoTipo,
} from "./formulario-evento";

const ID_FORMULARIO = "formulario-lote";

type Linha = { chave: number; dataInicio: string; dataFim: string };

/** Erros causados pelas horas, que são as mesmas em todo o lote: aparecem uma vez, junto das horas. */
const ERROS_DE_HORA = new Set(["Informe as duas horas ou nenhuma.", "Hora inválida.", "A hora final precisa ser depois da inicial."]);

const DIA_MS = 86_400_000;
const diasEntre = (inicio: string, fim: string) => Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / DIA_MS);

/** Separa os erros das linhas ("periodos.<i>") entre os de cada linha e os das horas. */
export function separarErrosDoLote(erros: Erros) {
  const porLinha: Record<number, string[]> = {};
  const deHora = new Set<string>([...(erros.horaInicio ?? []), ...(erros.horaFim ?? [])]);
  for (const [chave, mensagens] of Object.entries(erros)) {
    const m = /^periodos\.(\d+)/.exec(chave);
    if (!m || !mensagens) continue;
    for (const msg of mensagens) {
      if (ERROS_DE_HORA.has(msg)) deHora.add(msg);
      else (porLinha[Number(m[1])] ??= []).push(msg);
    }
  }
  return { porLinha, deHora: [...deHora] };
}

type Props = {
  tipos: OpcaoTipo[];
  turmas: string[];
  hoje: string;
  urlFechar: string;
  /** Só para a prévia visual: erros já preenchidos. */
  errosIniciais?: Erros;
};

export function FormularioLote({ tipos, turmas, hoje, urlFechar, errosIniciais }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erros, setErros] = useState<Erros>(errosIniciais ?? {});
  const [diaInteiro, setDiaInteiro] = useState(true);
  const [numerar, setNumerar] = useState(true);
  const [titulo, setTitulo] = useState("");
  const proximaChave = useRef(1);
  const [linhas, setLinhas] = useState<Linha[]>(() => [{ chave: 0, ...periodoPadraoFimDeSemana(hoje) }]);

  const { porLinha, deHora } = separarErrosDoLote(erros);
  const cheio = linhas.length >= MAX_LOTE;
  const rotuloSalvar = pendente ? "Lançando…" : `Lançar ${linhas.length} ${linhas.length === 1 ? "data" : "datas"}`;

  // Os títulos são numerados na ordem das datas: a prévia mostra o da data mais cedo.
  const primeira = [...linhas].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))[0];
  const previa = titulosDoLote(titulo.trim() || "Título", 1, numerar)[0];

  function adicionar() {
    if (cheio) return;
    const ultimoFim = linhas.reduce((max, l) => (l.dataFim > max ? l.dataFim : max), linhas[0]?.dataFim ?? hoje);
    const sugestao = periodoPadraoFimDeSemana(somarDias(ultimoFim || hoje, 1));
    // Linha nova vai para o fim: os índices dos erros já mostrados continuam valendo.
    setLinhas((atual) => [...atual, { chave: proximaChave.current++, ...sugestao }]);
  }

  function remover(chave: number) {
    setLinhas((atual) => (atual.length > 1 ? atual.filter((l) => l.chave !== chave) : atual));
    setErros({}); // os índices mudam: os erros antigos não valem mais
  }

  function mudarInicio(chave: number, valor: string) {
    // Mantém a duração da linha ao mudar o início.
    setLinhas((atual) =>
      atual.map((l) => {
        if (l.chave !== chave) return l;
        const duracao = l.dataInicio && l.dataFim ? Math.max(0, diasEntre(l.dataInicio, l.dataFim)) : 0;
        return { ...l, dataInicio: valor, dataFim: valor ? somarDias(valor, duracao) : l.dataFim };
      }),
    );
  }

  function mudarFim(chave: number, valor: string) {
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, dataFim: valor } : l)));
  }

  function salvar(f: FormData) {
    const dados = {
      ...lerCamposComuns(f, diaInteiro),
      titulo,
      numerar,
      periodos: linhas.map(({ dataInicio, dataFim }) => ({ dataInicio, dataFim })),
    };
    iniciar(async () => {
      const r = await criarLoteAcao(dados);
      setErros(r.erros ?? {});
      if (avisar(r)) router.push(urlFechar, { scroll: false });
    });
  }

  return (
    <form id={ID_FORMULARIO} action={salvar} className="grid min-w-0 grid-cols-1 gap-4" noValidate>
      <fieldset disabled={pendente} className="grid min-w-0 grid-cols-1 gap-4">
        <CampoTipo tipos={tipos} erros={erros} prefixo="lote" />
        <Campo rotulo="Título" htmlFor="lote-titulo" erro={erros.titulo}>
          <Input id="lote-titulo" name="titulo" maxLength={150} value={titulo} onChange={(e) => setTitulo(e.target.value)} required aria-invalid={!!erros.titulo} />
        </Campo>
        <div className="grid gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={numerar} onChange={(e) => setNumerar(e.target.checked)} className="accent-primary" />
            Numerar títulos
          </label>
          <p className="text-muted-foreground text-xs" aria-live="polite">
            Primeira data{primeira ? ` (${primeira.dataInicio.split("-").reverse().join("/")})` : ""}: <span className="text-foreground font-medium">{previa}</span>
          </p>
        </div>

        <CamposHora prefixo="lote" diaInteiro={diaInteiro} aoMudarDiaInteiro={setDiaInteiro} erros={deHora} />

        <fieldset className="grid min-w-0 grid-cols-1 gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <legend className="text-sm font-medium">Datas</legend>
            <span className={cheio ? "text-perigo text-sm font-medium" : "text-muted-foreground text-sm"} aria-live="polite">
              {linhas.length} de {MAX_LOTE}
            </span>
          </div>
          <ol className="grid grid-cols-1 gap-2">
            {linhas.map((l, i) => {
              const erroLinha = porLinha[i];
              const idErro = `lote-erro-${l.chave}`;
              return (
                <li key={l.chave} className={erroLinha ? "border-destructive/60 bg-destructive/5 grid gap-1.5 rounded-lg border p-2" : "grid gap-1.5 rounded-lg border p-2"}>
                  <div className="flex items-end gap-1.5 sm:gap-2">
                    <span className="text-muted-foreground w-4 shrink-0 pb-2 text-right text-xs tabular-nums sm:w-5">{i + 1}</span>
                    <label className="grid min-w-0 flex-1 grid-cols-1 gap-1">
                      <span className="text-muted-foreground text-xs">Início</span>
                      <input
                        type="date"
                        className={`${estiloCampo} min-w-0 px-1.5 sm:px-2`}
                        value={l.dataInicio}
                        required
                        aria-invalid={!!erroLinha}
                        aria-describedby={erroLinha ? idErro : undefined}
                        onChange={(e) => mudarInicio(l.chave, e.target.value)}
                      />
                    </label>
                    <label className="grid min-w-0 flex-1 grid-cols-1 gap-1">
                      <span className="text-muted-foreground text-xs">Fim</span>
                      <input
                        type="date"
                        className={`${estiloCampo} min-w-0 px-1.5 sm:px-2`}
                        value={l.dataFim}
                        min={l.dataInicio}
                        required
                        aria-invalid={!!erroLinha}
                        aria-describedby={erroLinha ? idErro : undefined}
                        onChange={(e) => mudarFim(l.chave, e.target.value)}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => remover(l.chave)}
                      disabled={linhas.length === 1}
                      aria-label={`Remover data ${i + 1}`}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <ErroCampo id={idErro} mensagens={erroLinha} />
                </li>
              );
            })}
          </ol>
          <ErroCampo mensagens={erros.periodos} />
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={adicionar} disabled={cheio}>
            <PlusIcon /> Adicionar fim de semana
          </Button>
        </fieldset>

        <CamposTurmaLocal turmas={turmas} erros={erros} prefixo="lote" />
        <CamposFinais prefixo="lote" erros={erros} />

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" className="hidden sm:inline-flex">
            {rotuloSalvar}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push(urlFechar, { scroll: false })}>
            Cancelar
          </Button>
        </div>
      </fieldset>
      <BarraSalvarCelular formulario={ID_FORMULARIO} disabled={pendente}>
        {rotuloSalvar}
      </BarraSalvarCelular>
    </form>
  );
}
