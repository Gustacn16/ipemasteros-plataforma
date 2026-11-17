"use client";

import { SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { desconectarNumeroAcao, excluirNumeroAcao } from "../acoes/numeros";
import type { NumeroNaTela } from "../servicos/numeros";
import { ConectarNumero } from "./conectar-numero";

const ROTULO_FINALIDADE = { escola: "Escola", vendedor: "Vendedor" } as const;

// Datas chegam como string ISO do servidor para o componente de cliente.
type Linha = Omit<NumeroNaTela, "conectadoEm" | "ultimoSinalEm"> & { conectadoEm: string | null; ultimoSinalEm: string | null };

export type { Linha as LinhaNumero };

function data(valor: string | null) {
  return valor ? formatarDataHora(new Date(valor)) : "—";
}

export function ListaNumeros({ numeros, podeExcluir }: { numeros: Linha[]; podeExcluir: boolean }) {
  const router = useRouter();
  const [pendente, executar] = useTransition();

  const rodar = (acao: () => Promise<{ ok: boolean; mensagem?: string }>) =>
    executar(async () => {
      avisar(await acao());
      router.refresh();
    });

  if (numeros.length === 0) {
    return <EstadoVazio icone={SmartphoneIcon} titulo="Nenhum número por aqui" descricao="Quando houver uma vaga de número, ela aparece nesta lista." />;
  }

  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Finalidade</TableHead>
            <TableHead>Dono</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Conectado em</TableHead>
            <TableHead>Último sinal</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {numeros.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="font-medium">{n.nome}</TableCell>
              <TableCell>{ROTULO_FINALIDADE[n.finalidade]}</TableCell>
              <TableCell>{n.dono ?? "—"}</TableCell>
              <TableCell>{n.telefone ?? "—"}</TableCell>
              <TableCell>{n.rotulo}</TableCell>
              <TableCell>{data(n.conectadoEm)}</TableCell>
              <TableCell>{data(n.ultimoSinalEm)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {n.estado !== "conectado" && <ConectarNumero numeroId={n.id} nome={n.nome} />}
                  {n.estado === "conectado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendente}
                      onClick={() => {
                        if (!confirm("Desconectar este número? Para voltar, será preciso ler o QR de novo.")) return;
                        rodar(() => desconectarNumeroAcao(n.id));
                      }}
                    >
                      Desconectar
                    </Button>
                  )}
                  {podeExcluir && n.estado === "desconectado" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pendente}
                      onClick={() => {
                        if (!confirm(`Excluir o número "${n.nome}"?`)) return;
                        rodar(() => excluirNumeroAcao(n.id));
                      }}
                    >
                      Excluir
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
