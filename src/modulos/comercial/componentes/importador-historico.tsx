"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarReais } from "@/lib/dinheiro";
import { analisarHistoricoAcao, importarHistoricoAcao } from "../acoes/importacao-lovable";
import type { ResumoImportacao } from "../servicos/importacao-lovable";

/** Tabelas do arquivo do Lovable que a importação usa; o resto (alunos, mídia…) nem sai do navegador. */
const TABELAS = ["sales", "sales_seller_product_targets", "products", "profiles"] as const;

async function recortar(arquivo: File): Promise<string> {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(await arquivo.text());
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const recorte: Record<string, unknown> = {};
  for (const t of TABELAS) recorte[t] = json[t];
  // Dos produtos e vendedores, só id e nome.
  if (Array.isArray(recorte.products)) recorte.products = recorte.products.map((p: { id?: unknown; name?: unknown }) => ({ id: p.id, name: p.name }));
  if (Array.isArray(recorte.profiles))
    recorte.profiles = recorte.profiles.map((p: { user_id?: unknown; full_name?: unknown }) => ({ user_id: p.user_id, full_name: p.full_name }));
  return JSON.stringify(recorte);
}

const nomeDoMes = (mes: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${mes}-01T00:00:00Z`));

function Resumo({ r }: { r: ResumoImportacao }) {
  const c = r.contagens;
  return (
    <div className="grid gap-4 text-sm">
      <ul className="grid gap-1">
        <li>
          Vendas novas: <strong>{r.vendasNovas}</strong> ({formatarReais(r.valorNovo)})
        </li>
        <li>Metas novas: {r.metasNovas}</li>
        {c.vendasJaImportadas > 0 && <li>Vendas que já tinham sido importadas: {c.vendasJaImportadas}</li>}
        {c.vendasRegistradasNoSistema > 0 && <li>Vendas que já estavam registradas no sistema (mesmo produto, dia e cliente): {c.vendasRegistradasNoSistema}</li>}
        {c.vendasCanceladas > 0 && <li>Vendas canceladas, ignoradas: {c.vendasCanceladas}</li>}
        {c.metasJaExistentes > 0 && <li>Metas que já existiam no mês (mantidas como estão): {c.metasJaExistentes}</li>}
        {c.metasZeradas > 0 && <li>Metas zeradas, ignoradas: {c.metasZeradas}</li>}
        {r.canaisNovos.length > 0 && <li>Canais novos: {r.canaisNovos.join(", ")}</li>}
      </ul>
      {r.porMes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.porMes.map((m) => (
              <TableRow key={m.mes}>
                <TableCell className="capitalize">{nomeDoMes(m.mes)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.vendas}</TableCell>
                <TableCell className="text-right tabular-nums">{formatarReais(m.valor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {r.vendedores.length > 0 && (
        <div className="grid gap-1">
          <p className="font-medium">Vendedores</p>
          <ul className="text-muted-foreground grid gap-0.5">
            {r.vendedores.map((v) => (
              <li key={v.nomeAntigo}>
                {v.nomeAntigo} → {v.novo ? "novo vendedor inativo (sem acesso ao sistema)" : v.nomeNovo}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.avisos.length > 0 && (
        <ul className="text-muted-foreground list-disc pl-5">
          {r.avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {r.erros.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="list-disc pl-5">
              {r.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/** Importação do histórico do Lovable em três passos: escolher, conferir e gravar. */
export function ImportadorHistorico() {
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [previa, analisar, analisando] = useActionState(analisarHistoricoAcao, { ok: false });
  const [resultado, importar, importando] = useActionState(importarHistoricoAcao, { ok: false });

  const enviar = (acao: (fd: FormData) => void) => {
    if (!conteudo) return;
    const fd = new FormData();
    fd.set("conteudo", conteudo);
    startTransition(() => acao(fd));
  };

  if (resultado.ok && resultado.dados) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importação concluída</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Resumo r={resultado.dados} />
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/comercial">Ver o dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/comercial/vendas?periodo=intervalo&de=2026-06-01">Ver as vendas</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dados = previa.ok ? previa.dados : undefined;
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha o arquivo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            O arquivo <strong>dados-comerciais.json</strong>, que vem dentro do pacote exportado do Lovable. Entram as vendas e as metas por
            vendedor. Nada é gravado antes do passo 3, e importar de novo não duplica.
          </p>
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="arquivo">Arquivo</Label>
            <Input
              id="arquivo"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const arquivo = e.target.files?.[0];
                setConteudo(null);
                setErroArquivo(null);
                if (!arquivo) return;
                try {
                  setConteudo(await recortar(arquivo));
                } catch (erro) {
                  setErroArquivo(erro instanceof Error ? erro.message : "Não foi possível ler o arquivo.");
                }
              }}
            />
          </div>
          <div>
            <Button type="button" disabled={!conteudo || analisando} onClick={() => enviar(analisar)}>
              {analisando ? "Lendo…" : "Ler arquivo"}
            </Button>
          </div>
          {(erroArquivo || (!previa.ok && previa.mensagem)) && (
            <Alert variant="destructive">
              <AlertDescription>{erroArquivo ?? previa.mensagem}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {dados && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Confira</CardTitle>
            </CardHeader>
            <CardContent>
              <Resumo r={dados} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Gravar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">Se houver qualquer problema, nada é gravado.</p>
              {!resultado.ok && resultado.mensagem && (
                <Alert variant="destructive">
                  <AlertDescription>{resultado.mensagem}</AlertDescription>
                </Alert>
              )}
              <div>
                <Button
                  type="button"
                  disabled={importando || dados.erros.length > 0 || (dados.vendasNovas === 0 && dados.metasNovas === 0)}
                  onClick={() => enviar(importar)}
                >
                  {importando ? "Importando…" : "Importar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
