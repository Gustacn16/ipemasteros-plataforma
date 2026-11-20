// Cartão de uma avaliação da IA. Renderizado no servidor, sem estado no cliente; reusado na página da conversa.
import Link from "next/link";
import { FlameIcon, SnowflakeIcon, ThermometerIcon, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/componentes/ui/card";
import { formatarDataHora } from "@/lib/datas";
import { CRITERIO_TEMPO, CRITERIOS, formatarNota, ROTULO_SITUACAO_LEAD, ROTULO_TEMPERATURA, tipoDoTime } from "../regras/avaliacao";
import type { ItemLead } from "../servicos/leads";

export type PropsAvaliacaoConversa = Omit<ItemLead, "numeroNome" | "contatoNome"> & {
  contatoNome?: string;
  numeroNome?: string;
  pontosFortes?: string | null;
  melhorar?: string | null;
  /** Mostra o link "Abrir conversa" (desligue na própria página da conversa). */
  linkConversa?: boolean;
};

const ESTILO_TEMPERATURA: Record<string, { icone: LucideIcon; classe: string }> = {
  quente: { icone: FlameIcon, classe: "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" },
  morno: { icone: ThermometerIcon, classe: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  frio: { icone: SnowflakeIcon, classe: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200" },
};

function rotuloCriterio(chave: string, time: string): string {
  if (chave === CRITERIO_TEMPO.chave) return CRITERIO_TEMPO.rotulo;
  const tipo = tipoDoTime(time as Parameters<typeof tipoDoTime>[0]) ?? "vendas";
  return CRITERIOS[tipo].find((c) => c.chave === chave)?.rotulo ?? chave;
}

const pontos = (texto: string | null | undefined) => (texto ?? "").split("\n").map((p) => p.trim()).filter(Boolean);

export function AvaliacaoConversa({ item }: { item: PropsAvaliacaoConversa }) {
  const estilo = item.temperatura ? ESTILO_TEMPERATURA[item.temperatura] : null;
  const Icone = estilo?.icone ?? ThermometerIcon;
  const fortes = pontos(item.pontosFortes);
  const melhorar = pontos(item.melhorar);
  return (
    <Card>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.contatoNome && <h3 className="text-base font-semibold">{item.contatoNome}</h3>}
          {item.temperatura && estilo && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${estilo.classe}`}>
              <Icone className="size-3" aria-hidden />
              {ROTULO_TEMPERATURA[item.temperatura]}
            </span>
          )}
          {item.situacaoLead && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">{ROTULO_SITUACAO_LEAD[item.situacaoLead]}</span>
          )}
          <span className="ml-auto text-sm tabular-nums">
            Nota geral: <strong>{formatarNota(item.notaGeralDecimos)}</strong>
          </span>
        </div>
        {(item.numeroNome || item.venda) && (
          <p className="text-muted-foreground text-xs">
            {item.numeroNome && <>Número: {item.numeroNome}</>}
            {item.numeroNome && item.venda && " · "}
            {item.venda && <>Venda: {item.venda.produto} em {formatarDataHora(item.venda.criadoEm)}</>}
          </p>
        )}
        {item.motivoTemperatura && <p className="text-sm">{item.motivoTemperatura}</p>}
        {item.oQueRespondeu && (
          <p className="text-sm">
            <span className="font-medium">O que respondeu: </span>
            {item.oQueRespondeu}
          </p>
        )}
        {item.proximoPasso && (
          <p className="text-sm">
            <span className="font-medium">Próximo passo: </span>
            {item.proximoPasso}
          </p>
        )}
        {(fortes.length > 0 || melhorar.length > 0) && (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {fortes.length > 0 && (
              <div>
                <p className="font-medium">Pontos fortes</p>
                <ul className="list-disc pl-5">{fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
            {melhorar.length > 0 && (
              <div>
                <p className="font-medium">A melhorar</p>
                <ul className="list-disc pl-5">{melhorar.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
          </div>
        )}
        {item.criterios.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Critérios</summary>
            <ul className="mt-2 grid gap-2">
              {item.criterios.map((c) => (
                <li key={c.chave}>
                  <span className="font-medium">{rotuloCriterio(c.chave, item.time)}:</span>{" "}
                  <span className="tabular-nums">{c.nota === null ? "não se aplica" : String(c.nota)}</span>
                  {c.frase && <span className="text-muted-foreground"> — {c.frase}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {item.linkConversa !== false && (
          <Link href={`/whatsapp/conversas/${item.conversaId}`} className="text-sm font-medium underline-offset-4 hover:underline">
            Abrir conversa
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
