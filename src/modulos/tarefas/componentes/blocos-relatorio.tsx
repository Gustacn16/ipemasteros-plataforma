// Blocos da tela do Relatório (sem estado; servem à página de servidor).
import { AlarmClockIcon, BarChart3Icon, CheckCheckIcon, ListTodoIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { AnelPercentual } from "@/componentes/anel-percentual";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Podio } from "@/componentes/podio";
import { CLASSE_TEXTO_TOM, faixaDoPercentual, type Tom } from "@/componentes/regras-visuais";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import {
  ROTULO_SITUACAO_PRAZO,
  variacao,
  variacaoPontos,
  type LinhaRelatorio,
  type SituacaoPrazo,
} from "../regras/relatorio";
import { GraficoEntregas } from "./grafico-entregas";

const TOM_SITUACAO: Record<SituacaoPrazo, Tom> = { no_prazo: "sucesso", atrasada: "perigo", sem_data: "neutro" };

export function SeloSituacao({ situacao }: { situacao: SituacaoPrazo }) {
  return (
    <ChipSituacao tom={TOM_SITUACAO[situacao]} tamanho="sm">
      {ROTULO_SITUACAO_PRAZO[situacao]}
    </ChipSituacao>
  );
}

function Percentual({ valor }: { valor: number | null }) {
  const faixa = faixaDoPercentual(valor);
  if (faixa === null) return <span className="text-muted-foreground">—</span>;
  return <span className={cn("font-semibold", CLASSE_TEXTO_TOM[faixa])}>{valor}%</span>;
}

/** Os quatro números do próprio usuário, com variação contra o período anterior nas entregas. */
export function NumerosRelatorio({ eu, anterior }: { eu: LinhaRelatorio; anterior: LinhaRelatorio }) {
  return (
    <section aria-label="Meus números" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <CartaoNumero rotulo="Abertas" icone={ListTodoIcon} valor={eu.abertas} />
      <CartaoNumero rotulo="Atrasadas agora" icone={AlarmClockIcon} tom="perigo" valor={eu.atrasadas} />
      <CartaoNumero
        rotulo="Entregues no período"
        icone={CheckCheckIcon}
        valor={eu.entregues}
        variacao={variacao(eu.entregues, anterior.entregues)}
      >
        Antes: {anterior.entregues}
      </CartaoNumero>
      <CartaoNumero
        rotulo="No prazo"
        icone={TargetIcon}
        valor={<AnelPercentual percentual={eu.percentual} tamanho={56} />}
        variacao={variacaoPontos(eu.percentual, anterior.percentual)}
        unidadeVariacao="pp"
      >
        {eu.entreguesComData > 0 ? `${eu.noPrazo} de ${eu.entreguesComData} com data` : "Nenhuma entrega com data"}
      </CartaoNumero>
    </section>
  );
}

type PontoSerie = { rotulo: string; noPrazo: number; atrasadas: number; semData: number };
type ItemPodio = LinhaRelatorio & { foto?: string | null };

const cartao = "bg-card text-card-foreground grid content-start gap-4 rounded-xl border p-4";

/** Pódio (só com alguém nele) e gráfico lado a lado no computador; sem pódio, o gráfico ocupa a linha. */
export function PodioEGrafico({ podio, serie }: { podio: ItemPodio[]; serie: PontoSerie[] }) {
  // Baldes mensais têm rótulo "jan/27"; semanais, "dd/mm".
  const mensal = serie.some((b) => !/^\d/.test(b.rotulo));
  const vazio = serie.every((b) => b.noPrazo + b.atrasadas + b.semData === 0);
  return (
    <div className={cn("grid grid-cols-1 gap-3", podio.length > 0 && "lg:grid-cols-2")}>
      {podio.length > 0 && (
        <section aria-labelledby="titulo-podio" className={cn(cartao, "min-w-0")}>
          <div>
            <h2 id="titulo-podio" className="font-semibold">
              Pódio do período
            </h2>
            <p className="text-muted-foreground text-sm">entregas no prazo</p>
          </div>
          <Podio
            itens={podio.map((l) => ({
              id: l.pessoa.id,
              nome: l.pessoa.nome,
              valor: `${l.noPrazo} no prazo`,
              foto: l.foto ?? undefined,
            }))}
          />
        </section>
      )}
      <section aria-labelledby="titulo-grafico" className={cn(cartao, "min-w-0")}>
        <h2 id="titulo-grafico" className="font-semibold">
          {mensal ? "Entregas por mês" : "Entregas por semana"}
        </h2>
        {vazio ? (
          <EstadoVazio icone={BarChart3Icon} titulo="Nenhuma entrega no período" />
        ) : (
          <GraficoEntregas dados={serie} />
        )}
      </section>
    </div>
  );
}

/** Por pessoa: tabela a partir de `md`, cartões abaixo disso. */
export function TabelaPorPessoa({
  linhas,
  selecionada,
  urlDaPessoa,
}: {
  linhas: LinhaRelatorio[];
  selecionada?: string;
  urlDaPessoa: (id: string) => string;
}) {
  return (
    <>
      <ul className="grid min-w-0 gap-2 md:hidden">
        {linhas.map((l) => (
          <li
            key={l.pessoa.id}
            className={cn("bg-card min-w-0 rounded-xl border p-3", selecionada === l.pessoa.id && "ring-ring ring-2")}
          >
            <div className="flex items-center justify-between gap-2">
              <Link href={urlDaPessoa(l.pessoa.id)} scroll={false} className="min-w-0 truncate font-medium hover:underline">
                {l.pessoa.nome}
              </Link>
              <ChipSituacao tom={faixaDoPercentual(l.percentual) ?? "neutro"} tamanho="sm">
                {l.percentual === null ? "—" : `${l.percentual}% no prazo`}
              </ChipSituacao>
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center tabular-nums">
              {(
                [
                  ["Abertas", l.abertas, false],
                  ["Atrasadas", l.atrasadas, l.atrasadas > 0],
                  ["Entregues", l.entregues, false],
                  ["No prazo", l.noPrazo, false],
                ] as const
              ).map(([rotulo, valor, alerta]) => (
                <div key={rotulo} className="min-w-0">
                  <dt className="text-muted-foreground truncate text-xs">{rotulo}</dt>
                  <dd className={cn("font-semibold", alerta && "text-perigo")}>{valor}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead className="text-right">Abertas</TableHead>
              <TableHead className="text-right">Atrasadas agora</TableHead>
              <TableHead className="text-right">Entregues</TableHead>
              <TableHead className="text-right">No prazo</TableHead>
              <TableHead className="text-right">% no prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {linhas.map((l) => (
              <TableRow key={l.pessoa.id} data-state={selecionada === l.pessoa.id ? "selected" : undefined}>
                <TableCell>
                  <Link href={urlDaPessoa(l.pessoa.id)} scroll={false} className="font-medium underline-offset-4 hover:underline">
                    {l.pessoa.nome}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{l.abertas}</TableCell>
                <TableCell className={cn("text-right", l.atrasadas > 0 && "text-perigo font-medium")}>{l.atrasadas}</TableCell>
                <TableCell className="text-right">{l.entregues}</TableCell>
                <TableCell className="text-right">{l.noPrazo}</TableCell>
                <TableCell className="text-right">
                  <Percentual valor={l.percentual} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
