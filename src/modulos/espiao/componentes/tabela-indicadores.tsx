import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import type { IndicadorConcorrente } from "../regras/tipos";
import { numero, percentual } from "./rotulos";

export function TabelaIndicadores({ indicadores }: { indicadores: (IndicadorConcorrente & { concorrenteId: string })[] }) {
  if (indicadores.length === 0) return <p className="text-muted-foreground text-sm">Nenhum concorrente acompanhado.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Concorrente</TableHead>
            <TableHead className="text-right">Seguidores</TableHead>
            <TableHead className="text-right">Δ semana</TableHead>
            <TableHead className="text-right">Posts/semana</TableHead>
            <TableHead className="text-right">Engajamento</TableHead>
            <TableHead>Destaques</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {indicadores.map((i) => (
            <TableRow key={i.concorrenteId}>
              <TableCell>
                <Link href={`/espiao/${i.concorrenteId}`} className="font-medium underline-offset-2 hover:underline">
                  {i.concorrente}
                </Link>
              </TableCell>
              <TableCell className="text-right">{numero(i.seguidores)}</TableCell>
              <TableCell className="text-right">{percentual(i.variacaoSeguidores)}</TableCell>
              <TableCell className="text-right">{i.postsPorSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</TableCell>
              <TableCell className="text-right">{i.engajamentoMedio === null ? "—" : `${i.engajamentoMedio.toLocaleString("pt-BR")}%`}</TableCell>
              <TableCell>{i.destaques.length ? i.destaques.length : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
