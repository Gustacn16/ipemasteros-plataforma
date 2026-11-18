"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { type ResultadoTeste, testarPerfilAcao } from "../acoes/testar-perfil";

const ROTULO_TIPO: Record<string, string> = { reels: "Reels", post: "Post", carrossel: "Carrossel", video: "Vídeo" };
const numero = (n: number | null) => (n === null ? "—" : n.toLocaleString("pt-BR"));
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function TestarPerfil() {
  const [estado, executar, pendente] = useActionState(testarPerfilAcao, { ok: false } as { ok: boolean; mensagem?: string; dados?: ResultadoTeste });
  const r = estado.dados;
  return (
    <div className="grid gap-4">
      <form action={executar} className="flex max-w-md items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="usuario">@ do concorrente</Label>
          <Input id="usuario" name="usuario" placeholder="@perfil" required autoComplete="off" />
        </div>
        <Button type="submit" disabled={pendente}>
          {pendente ? "Testando…" : "Testar perfil"}
        </Button>
      </form>
      {estado.mensagem && !estado.ok && (
        <Alert variant="destructive">
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      {r && (
        <div className="grid gap-3">
          <p className="text-sm">
            <strong>@{r.usuario}</strong>: {numero(r.seguidores)} seguidores, {numero(r.totalPosts)} posts.
          </p>
          <Alert>
            <AlertDescription>
              Vídeo disponível em <strong>{r.campos.mediaUrlReels} de {r.campos.reels}</strong> Reels. Visualizações vieram em{" "}
              {r.campos.visualizacoes} de {r.campos.midias} mídias; curtidas em {r.campos.curtidas} de {r.campos.midias}.
              <br />
              Critério: a transcrição fica ligada se o vídeo vier em pelo menos metade dos Reels.
            </AlertDescription>
          </Alert>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Curtidas</TableHead>
                <TableHead className="text-right">Visualizações</TableHead>
                <TableHead>Vídeo disponível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.midias.map((m) => (
                <TableRow key={m.idExterno}>
                  <TableCell>
                    <a href={m.permalink} target="_blank" rel="noreferrer noopener" className="underline">
                      {ROTULO_TIPO[m.tipo] ?? m.tipo}
                    </a>
                  </TableCell>
                  <TableCell>{data(m.publicadoEm)}</TableCell>
                  <TableCell className="text-right">{numero(m.curtidas)}</TableCell>
                  <TableCell className="text-right">{numero(m.visualizacoes)}</TableCell>
                  <TableCell>{m.tipo === "reels" || m.tipo === "video" ? (m.temVideo ? "sim" : "não") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
