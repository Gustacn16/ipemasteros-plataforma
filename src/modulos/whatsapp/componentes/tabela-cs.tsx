// Tabela de vendas da aba CS, renderizada no servidor (sem "use client").
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { rotuloSituacaoCs } from "../regras/cs";
import type { VendaCs } from "../servicos/cs";

export function TabelaCs({ vendas }: { vendas: VendaCs[] }) {
  if (vendas.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma venda nesta semana.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Venda</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Saiu</TableHead>
          <TableHead>1º contato</TableHead>
          <TableHead className="text-right">Tempo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {vendas.map((v) => (
          <TableRow key={v.id}>
            <TableCell>{v.produto}</TableCell>
            <TableCell>
              {v.conversaId ? (
                <Link href={`/whatsapp/conversas/${v.conversaId}`} className="font-medium underline-offset-4 hover:underline">
                  {v.cliente}
                </Link>
              ) : (
                v.cliente
              )}
            </TableCell>
            <TableCell>{formatarDataHora(v.criadoEm)}</TableCell>
            <TableCell>{v.primeiroContatoEm ? formatarDataHora(v.primeiroContatoEm) : "—"}</TableCell>
            <TableCell className="text-right">{rotuloSituacaoCs(v.situacao, v.segundos)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
