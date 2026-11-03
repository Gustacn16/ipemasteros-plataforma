"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { atualizarMetaAgoraAcao, definirContaAtivaAcao } from "../acoes/meta-ads";
import type { SituacaoIntegracao } from "../servicos/importacao-meta";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const formatoDia = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const dia = (d: string | null) => (d ? formatoDia.format(new Date(`${d}T00:00:00Z`)) : "—");

const ROTULO_STATUS = { concluida: "Concluída", falhou: "Falhou", em_andamento: "Em andamento" } as const;
const COR_STATUS = { concluida: "text-green-700", falhou: "text-red-600", em_andamento: "text-amber-600" } as const;

/** Situação da conexão: a última importação diz se a chave funciona. */
function situacao(s: SituacaoIntegracao): { rotulo: string; cor: string; detalhe: string } {
  if (!s.configurada)
    return {
      rotulo: "Não configurada",
      cor: "bg-neutral-100 text-neutral-700",
      detalhe: "Falta colocar a chave META_ACCESS_TOKEN na Hostinger.",
    };
  const ultima = s.importacoes.find((i) => i.status !== "em_andamento");
  if (ultima?.status === "falhou" && ultima.erro?.includes("chave de acesso")) {
    return {
      rotulo: "Chave inválida",
      cor: "bg-red-100 text-red-700",
      detalhe: "Gere uma nova chave no Business Manager e troque na Hostinger.",
    };
  }
  if (ultima?.status === "concluida")
    return { rotulo: "Conectada", cor: "bg-green-100 text-green-800", detalhe: "A importação diária roda às 4h." };
  return { rotulo: "Configurada", cor: "bg-amber-100 text-amber-800", detalhe: 'Clique em "Atualizar agora" para a primeira carga.' };
}

export function IntegracaoMeta({ situacao: s }: { situacao: SituacaoIntegracao }) {
  const router = useRouter();
  const [importando, iniciarImportacao] = useTransition();
  const [alterando, iniciarAlteracao] = useTransition();
  const atual = situacao(s);

  return (
    <div className="grid max-w-5xl gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              Meta Ads <span className={cn("rounded px-2 py-0.5 text-xs font-medium", atual.cor)}>{atual.rotulo}</span>
            </CardTitle>
            <CardDescription>{atual.detalhe}</CardDescription>
          </div>
          <Button
            disabled={importando || !s.configurada}
            onClick={() =>
              iniciarImportacao(async () => {
                avisar(await atualizarMetaAgoraAcao());
                // Atualiza também quando falha, para mostrar o erro no histórico.
                router.refresh();
              })
            }
          >
            <RefreshCwIcon className={cn(importando && "animate-spin")} />
            {importando ? "Importando… pode levar alguns minutos na primeira vez" : "Atualizar agora"}
          </Button>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Passo a passo da configuração: <code>docs/runbooks/meta-ads.md</code>.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas de anúncio</CardTitle>
          <CardDescription>Contas que a chave consegue ler. Desligue as que não devem entrar nos números.</CardDescription>
        </CardHeader>
        <CardContent>
          {s.contas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma conta encontrada ainda.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {s.contas.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{c.nome}</span> <span className="text-muted-foreground">{c.idExterno}</span>
                    {c.moeda !== "BRL" && <span className="ml-2 text-xs text-amber-700">Moeda {c.moeda}: fora dos totais</span>}
                  </span>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={c.ativa}
                      disabled={alterando}
                      onChange={(e) =>
                        iniciarAlteracao(async () => {
                          if (avisar(await definirContaAtivaAcao(c.id, e.target.checked))) router.refresh();
                        })
                      }
                    />
                    Importar
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas importações</CardTitle>
        </CardHeader>
        <CardContent>
          {s.importacoes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma importação ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.importacoes.map((i) => (
                    <TableRow key={i.id} className="align-top">
                      <TableCell className="whitespace-nowrap">{formatoDataHora.format(new Date(i.iniciadoEm))}</TableCell>
                      <TableCell>{i.origem === "agendada" ? "Automática" : "Manual"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {dia(i.desde)} a {dia(i.ate)}
                      </TableCell>
                      <TableCell className="text-right">{i.registros}</TableCell>
                      <TableCell className="max-w-md">
                        <span className={cn("font-medium", COR_STATUS[i.status])}>{ROTULO_STATUS[i.status]}</span>
                        {i.erro && <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">{i.erro}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
