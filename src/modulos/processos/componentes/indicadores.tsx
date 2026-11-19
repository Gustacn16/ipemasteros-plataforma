import { ActivityIcon, ArrowDownIcon, ArrowUpIcon, UserIcon } from "lucide-react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { CLASSE_TEXTO_TOM } from "@/componentes/regras-visuais";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { BotaoAcao, CampoAreaTexto, CampoSelecao, CampoTexto, FormularioAcao, Oculto } from "@/modulos/academico/componentes/campos";
import { Dialogo } from "@/modulos/academico/componentes/dialogo";
import { cn } from "@/lib/utils";
import {
  criarIndicadorAcao,
  editarIndicadorAcao,
  excluirIndicadorAcao,
  excluirMedicaoAcao,
  registrarMedicaoAcao,
} from "../acoes/processos";
import {
  FREQUENCIAS,
  ROTULO_FREQUENCIA,
  ROTULO_SENTIDO,
  SENTIDOS,
  VISUAL_SITUACAO_INDICADOR,
  formatarValor,
  periodoAnterior,
  rotuloPeriodo,
  tomDaMedicao,
} from "../regras/indicadores";
import type { IndicadorTela } from "../servicos/indicadores";
import { GraficoIndicador } from "./grafico-indicador";

type Opcao = { valor: string; rotulo: string };

export function CamposIndicador({ pessoas, indicador }: { pessoas: Opcao[]; indicador?: IndicadorTela }) {
  return (
    <>
      <CampoTexto rotulo="Nome do indicador" name="nome" defaultValue={indicador?.nome} placeholder="Ex.: Custo por lead" required largo />
      <CampoAreaTexto rotulo="Como medir" name="descricao" defaultValue={indicador?.descricao} />
      <CampoTexto rotulo="Unidade" name="unidade" defaultValue={indicador?.unidade} placeholder="%, R$, leads, dias" />
      <CampoTexto rotulo="Meta" name="meta" defaultValue={indicador?.meta != null ? String(indicador.meta).replace(".", ",") : undefined} placeholder="Ex.: 25" />
      <CampoSelecao rotulo="Sentido" name="sentido" opcoes={SENTIDOS.map((s) => ({ valor: s, rotulo: ROTULO_SENTIDO[s] }))} defaultValue={indicador?.sentido ?? "maior_melhor"} />
      <CampoSelecao rotulo="Frequência" name="frequencia" opcoes={FREQUENCIAS.map((f) => ({ valor: f, rotulo: ROTULO_FREQUENCIA[f] }))} defaultValue={indicador?.frequencia ?? "mensal"} />
      <CampoSelecao rotulo="Responsável por lançar" name="responsavelId" opcoes={pessoas} defaultValue={indicador?.responsavelId} vazio="Ninguém (só a gestão)" largo />
    </>
  );
}

export function LancarResultado({ indicador }: { indicador: IndicadorTela }) {
  const semanal = indicador.frequencia === "semanal";
  const sugerido = periodoAnterior(indicador.periodoAtual, indicador.frequencia);
  return (
    <Dialogo rotuloBotao="Lançar resultado" titulo={`Lançar: ${indicador.nome}`} descricao="Se o período já tiver resultado, ele é substituído.">
      <FormularioAcao acao={registrarMedicaoAcao} rotuloBotao="Lançar">
        <Oculto name="indicadorId" value={indicador.id} />
        <CampoTexto
          rotulo={semanal ? "Qualquer dia da semana" : indicador.frequencia === "trimestral" ? "Um mês do trimestre" : "Mês"}
          name="periodo"
          type={semanal ? "date" : "month"}
          defaultValue={semanal ? sugerido : sugerido.slice(0, 7)}
          required
        />
        <CampoTexto rotulo={`Resultado${indicador.unidade ? ` (${indicador.unidade})` : ""}`} name="valor" required />
        <CampoAreaTexto rotulo="Análise — se ficou fora da meta: o que aconteceu, a causa e o que será feito" name="analise" />
      </FormularioAcao>
    </Dialogo>
  );
}

function CartaoIndicador({ indicador, editor, pessoas }: { indicador: IndicadorTela; editor: boolean; pessoas: Opcao[] }) {
  const visual = VISUAL_SITUACAO_INDICADOR[indicador.situacao];
  const ultima = indicador.medicoes.at(-1);
  const recentes = [...indicador.medicoes].reverse();
  return (
    <article className="bg-card grid gap-4 rounded-xl border p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-1">
          <h3 className="text-foreground leading-snug font-semibold">{indicador.nome}</h3>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              {indicador.sentido === "maior_melhor" ? <ArrowUpIcon className="size-3" aria-hidden /> : <ArrowDownIcon className="size-3" aria-hidden />}
              {ROTULO_SENTIDO[indicador.sentido]}
            </span>
            <span>{ROTULO_FREQUENCIA[indicador.frequencia]}</span>
            {indicador.responsavel && (
              <span className="inline-flex items-center gap-1">
                <UserIcon className="size-3" aria-hidden /> {indicador.responsavel}
              </span>
            )}
          </p>
        </div>
        <ChipSituacao tom={visual.tom} tamanho="sm">
          {visual.rotulo}
        </ChipSituacao>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-0.5">
          <span className="text-muted-foreground text-xs">{ultima ? rotuloPeriodo(ultima.periodo, indicador.frequencia) : "Último resultado"}</span>
          <span className={cn("text-2xl font-semibold tabular-nums", ultima && CLASSE_TEXTO_TOM[tomDaMedicao(ultima.valor, ultima.meta, indicador.sentido)])}>
            {ultima ? formatarValor(ultima.valor, indicador.unidade) : "—"}
          </span>
        </div>
        <div className="grid gap-0.5">
          <span className="text-muted-foreground text-xs">Meta</span>
          <span className="text-foreground text-2xl font-semibold tabular-nums">{indicador.meta !== null ? formatarValor(indicador.meta, indicador.unidade) : "—"}</span>
        </div>
      </div>

      <GraficoIndicador medicoes={indicador.medicoes} meta={indicador.meta} sentido={indicador.sentido} frequencia={indicador.frequencia} unidade={indicador.unidade} />
      {indicador.descricao && <p className="text-muted-foreground text-xs whitespace-pre-line">Como medir: {indicador.descricao}</p>}

      {recentes.length > 0 && (
        <details className="group">
          <summary className="text-primary cursor-pointer text-sm font-medium select-none">Histórico e análises ({recentes.length})</summary>
          <ul className="mt-3 grid gap-2">
            {recentes.map((m) => {
              const tom = tomDaMedicao(m.valor, m.meta, indicador.sentido);
              return (
                <li key={m.id} className="grid gap-1 rounded-lg border p-2.5 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{rotuloPeriodo(m.periodo, indicador.frequencia)}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("font-semibold tabular-nums", CLASSE_TEXTO_TOM[tom])}>{formatarValor(m.valor, indicador.unidade)}</span>
                      {m.meta !== null && <span className="text-muted-foreground text-xs">meta {formatarValor(m.meta, indicador.unidade)}</span>}
                    </span>
                  </div>
                  {m.analise ? (
                    <p className="text-foreground/80 text-xs whitespace-pre-line">{m.analise}</p>
                  ) : tom === "perigo" ? (
                    <p className="text-perigo text-xs">Fora da meta e sem análise.</p>
                  ) : null}
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                    <span>por {m.registradoPor}</span>
                    {indicador.podeLancar && (
                      <BotaoAcao acao={excluirMedicaoAcao.bind(null, m.id)} rotulo="Excluir" confirmar="Excluir este resultado?" variante="outline" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {(indicador.podeLancar || editor) && (
        <footer className="flex flex-wrap gap-2 border-t pt-3">
          {indicador.podeLancar && <LancarResultado indicador={indicador} />}
          {editor && (
            <>
              <Dialogo rotuloBotao="Editar" titulo="Editar indicador" variante="outline">
                <FormularioAcao acao={editarIndicadorAcao} rotuloBotao="Salvar">
                  <Oculto name="id" value={indicador.id} />
                  <CamposIndicador pessoas={pessoas} indicador={indicador} />
                </FormularioAcao>
              </Dialogo>
              <BotaoAcao acao={excluirIndicadorAcao.bind(null, indicador.id)} rotulo="Excluir" confirmar={`Excluir o indicador "${indicador.nome}"? O histórico fica guardado.`} variante="outline" />
            </>
          )}
        </footer>
      )}
    </article>
  );
}

export function SecaoIndicadores({
  documentoId,
  indicadores,
  editor,
  pessoas,
}: {
  documentoId: string;
  indicadores: IndicadorTela[];
  editor: boolean;
  pessoas: Opcao[];
}) {
  return (
    <section aria-labelledby="titulo-indicadores" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="titulo-indicadores" className="text-foreground text-lg font-semibold tracking-tight">
            Itens de controle
          </h2>
          <p className="text-muted-foreground text-sm">Os indicadores que mostram se o processo entrega o resultado.</p>
        </div>
        {editor && (
          <Dialogo rotuloBotao="Novo indicador" titulo="Novo indicador" descricao="Defina como medir, a meta e quem lança o resultado.">
            <FormularioAcao acao={criarIndicadorAcao} rotuloBotao="Criar">
              <Oculto name="documentoId" value={documentoId} />
              <CamposIndicador pessoas={pessoas} />
            </FormularioAcao>
          </Dialogo>
        )}
      </div>
      {indicadores.length === 0 ? (
        <EstadoVazio
          compacto
          icone={ActivityIcon}
          titulo="Nenhum indicador ainda"
          descricao={editor ? "Crie o primeiro item de controle deste processo." : "Este processo ainda não tem indicadores."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {indicadores.map((i) => (
            <CartaoIndicador key={i.id} indicador={i} editor={editor} pessoas={pessoas} />
          ))}
        </div>
      )}
    </section>
  );
}
