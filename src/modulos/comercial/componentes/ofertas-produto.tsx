"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarReais } from "@/lib/dinheiro";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirOfertaAcao, salvarOfertaAcao } from "../acoes/produtos";
import { FORMAS_PAGAMENTO, ROTULO_FORMA_PAGAMENTO } from "../esquemas/produto";
import type { ProdutoDetalhe } from "../servicos/produtos";
import { descreverParcelas } from "./exibicao";
import { valorCampo } from "./formulario-produto";

type Oferta = ProdutoDetalhe["ofertas"][number];

function FormularioOferta({ produtoId, oferta, fechar }: { produtoId: string; oferta: Oferta | null; fechar: () => void }) {
  const router = useRouter();
  const [estado, executar, pendente] = useActionState(salvarOfertaAcao, {
    ok: false,
  });
  useEffect(() => {
    if (estado.ok) {
      avisar(estado);
      fechar();
      router.refresh();
    }
  }, [estado, fechar, router]);
  const e = estado.erros;

  return (
    <form action={executar} className="grid gap-4">
      <input type="hidden" name="produtoId" value={produtoId} />
      {oferta && <input type="hidden" name="id" value={oferta.id} />}
      {!estado.ok && estado.mensagem && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" name="nome" placeholder="Ex.: À vista" defaultValue={oferta?.nome ?? ""} erros={e?.nome} required />
      <div className="grid grid-cols-2 gap-4">
        <Campo
          rotulo="Preço cheio"
          name="precoCheio"
          inputMode="decimal"
          defaultValue={oferta ? valorCampo(oferta.precoCheio) : ""}
          erros={e?.precoCheio}
          required
        />
        <Campo
          rotulo="Matrícula"
          name="matricula"
          inputMode="decimal"
          defaultValue={oferta ? valorCampo(oferta.matricula) : ""}
          erros={e?.matricula}
        />
        <Campo
          rotulo="Parcelas (0 = à vista)"
          name="parcelas"
          type="number"
          min={0}
          max={60}
          defaultValue={oferta?.parcelas ?? 0}
          erros={e?.parcelas}
        />
        <Campo
          rotulo="Valor da parcela"
          name="valorParcela"
          inputMode="decimal"
          defaultValue={oferta ? valorCampo(oferta.valorParcela) : ""}
          erros={e?.valorParcela}
        />
        <Campo
          rotulo="Desconto pontualidade (%)"
          name="descontoPontualidadePct"
          inputMode="decimal"
          defaultValue={oferta ? valorCampo(oferta.descontoPontualidadePct) : ""}
          erros={e?.descontoPontualidadePct}
        />
        <Campo rotulo="Link de pagamento" name="link" type="url" defaultValue={oferta?.link ?? ""} erros={e?.link} />
      </div>
      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-medium">Formas de pagamento</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {FORMAS_PAGAMENTO.map((f) => (
            <label key={f} className="flex items-center gap-1.5">
              <input type="checkbox" name="formasPagamento" value={f} defaultChecked={oferta?.formasPagamento.includes(f)} />
              {ROTULO_FORMA_PAGAMENTO[f]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="padrao" defaultChecked={oferta?.padrao} /> Oferta padrão (vem escolhida ao registrar venda)
      </label>
      <DialogFooter>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar oferta"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function OfertasProduto({ produtoId, ofertas, podeEditar }: { produtoId: string; ofertas: Oferta[]; podeEditar: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Oferta | "nova" | null>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Ofertas e preços</CardTitle>
        {podeEditar && (
          <Button size="sm" variant="outline" onClick={() => setEditando("nova")}>
            <PlusIcon /> Nova oferta
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {ofertas.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma oferta cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oferta</TableHead>
                  <TableHead className="text-right">Preço cheio</TableHead>
                  <TableHead className="text-right">Matrícula</TableHead>
                  <TableHead>Parcelas</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                  <TableHead>Pagamento</TableHead>
                  {podeEditar && <TableHead className="sr-only">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofertas.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.nome}
                      {o.padrao && <span className="text-muted-foreground ml-1.5 text-xs">(padrão)</span>}
                      {o.link && (
                        <a href={o.link} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-xs underline">
                          link
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatarReais(o.precoCheio)}</TableCell>
                    <TableCell className="text-right">{formatarReais(o.matricula)}</TableCell>
                    <TableCell>{descreverParcelas(o.parcelas, o.valorParcela)}</TableCell>
                    <TableCell className="text-right">
                      {Number(o.descontoPontualidadePct) > 0 ? `${Number(o.descontoPontualidadePct)}%` : "—"}
                    </TableCell>
                    <TableCell>{o.formasPagamento.map((f) => ROTULO_FORMA_PAGAMENTO[f]).join(", ") || "—"}</TableCell>
                    {podeEditar && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" aria-label={`Editar ${o.nome}`} onClick={() => setEditando(o)}>
                          <PencilIcon />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Excluir ${o.nome}`}
                          disabled={pendente}
                          onClick={() => {
                            if (!confirm(`Excluir a oferta "${o.nome}"?`)) return;
                            iniciar(async () => {
                              if (avisar(await excluirOfertaAcao(o.id))) router.refresh();
                            });
                          }}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog open={editando !== null} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando === "nova" ? "Nova oferta" : "Editar oferta"}</DialogTitle>
          </DialogHeader>
          {editando !== null && (
            <FormularioOferta produtoId={produtoId} oferta={editando === "nova" ? null : editando} fechar={() => setEditando(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
