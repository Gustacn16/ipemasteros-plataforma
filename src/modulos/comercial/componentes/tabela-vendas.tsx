"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarReais } from "@/lib/dinheiro";
import { ROTULO_FORMA_PAGAMENTO } from "../esquemas/produto";
import type { LinhaVenda } from "../servicos/vendas";
import { FormularioVenda, type OpcoesVenda } from "./formulario-venda";

const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dataDoDia = (dia: string) => formatoDia.format(new Date(`${dia}T00:00:00Z`));

type Props = OpcoesVenda & { vendas: LinhaVenda[]; total: string; mostrarVendedor: boolean };

/** Lista de vendas com total no rodapé; "Registrar venda" e clicar numa linha abrem o formulário. */
export function TabelaVendas({ vendas, total, mostrarVendedor, ...opcoes }: Props) {
  const [aberta, setAberta] = useState<LinhaVenda | "nova" | null>(null);
  const fechar = useCallback(() => setAberta(null), []);
  const venda = aberta === "nova" ? null : aberta;

  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <Button onClick={() => setAberta("nova")}>
          <PlusIcon /> Registrar venda
        </Button>
      </div>

      {vendas.length === 0 ? (
        <p className="text-muted-foreground rounded-md border p-6 text-center text-sm">Nenhuma venda neste período.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                {mostrarVendedor && <TableHead>Vendedor</TableHead>}
                <TableHead>Canal</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendas.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setAberta(v)}>
                  <TableCell className="whitespace-nowrap">{dataDoDia(v.dataVenda)}</TableCell>
                  <TableCell className="max-w-56 truncate">{v.produtoNome}</TableCell>
                  <TableCell>
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => setAberta(v)}>
                      {v.nomeCliente}
                    </button>
                  </TableCell>
                  {mostrarVendedor && <TableCell>{v.vendedorNome}</TableCell>}
                  <TableCell>{v.canalNome ?? "—"}</TableCell>
                  <TableCell>{ROTULO_FORMA_PAGAMENTO[v.metodoPagamento]}</TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">{formatarReais(v.valorTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={mostrarVendedor ? 6 : 5}>
                  {vendas.length} {vendas.length === 1 ? "venda" : "vendas"}
                </TableCell>
                <TableCell className="text-right font-semibold whitespace-nowrap">{formatarReais(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <Dialog open={aberta !== null} onOpenChange={(abrir) => !abrir && fechar()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{venda ? (venda.podeEditar ? "Editar venda" : "Venda") : "Registrar nova venda"}</DialogTitle>
          </DialogHeader>
          {aberta !== null && (
            <FormularioVenda
              key={venda?.id ?? "nova"}
              {...opcoes}
              venda={venda}
              somenteLeitura={venda ? !venda.podeEditar : false}
              fechar={fechar}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
