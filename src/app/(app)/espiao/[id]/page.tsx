import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { ListaSinais } from "@/modulos/espiao/componentes/lista-sinais";
import { ROTULO_MIDIA, dataCurta, dataHora, numero } from "@/modulos/espiao/componentes/rotulos";
import { type VisaoConcorrente, visaoConcorrente } from "@/modulos/espiao/servicos/visao";

export const metadata: Metadata = { title: "Concorrente — Espião — IPEMaster OS" };

const TRANSCRICAO: Record<string, string> = { pendente: "aguardando", sem_video: "sem vídeo", longa_demais: "longo demais", falhou: "falhou", nao_se_aplica: "" };

export default async function PaginaConcorrente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirPermissaoPagina("espiao:ver");
  const { id } = await params;
  let c: VisaoConcorrente;
  try {
    c = await visaoConcorrente(usuario, id);
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
  const fotos = [...c.fotos].reverse();
  const maior = Math.max(1, ...fotos.map((f) => f.seguidores));
  return (
    <div className="grid gap-6">
      <CabecalhoPagina titulo={c.nome} descricao={[c.instagram ? `@${c.instagram}` : null, c.site].filter(Boolean).join(" · ") || "Sem Instagram nem site cadastrados"} />
      <Link href="/espiao" className="text-sm underline">
        ← Voltar ao Espião
      </Link>
      {c.errosUltimaColeta.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            Na última coleta: {c.errosUltimaColeta.join(" ")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seguidores por coleta</CardTitle>
        </CardHeader>
        <CardContent>
          {fotos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Ainda sem coleta do Instagram.</p>
          ) : (
            <div className="flex h-32 items-end gap-1" role="img" aria-label={`Seguidores de ${numero(fotos[0].seguidores)} a ${numero(fotos.at(-1)!.seguidores)}`}>
              {fotos.map((f) => (
                <div key={f.capturadaEm.toISOString()} className="bg-primary/70 flex-1 rounded-t" style={{ height: `${Math.max(4, (f.seguidores / maior) * 100)}%` }} title={`${dataCurta(f.capturadaEm)}: ${numero(f.seguidores)}`} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sinais</CardTitle>
        </CardHeader>
        <CardContent>
          <ListaSinais sinais={c.sinais} comConcorrente={false} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posts recentes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {c.midias.length === 0 && <p className="text-muted-foreground text-sm">Nenhum post coletado.</p>}
          {c.midias.map((m) => (
            <details key={m.id} className="rounded-md border p-3 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <strong>{ROTULO_MIDIA[m.tipo] ?? m.tipo}</strong>
                <span>{dataCurta(m.publicadoEm)}</span>
                <span className="text-muted-foreground">
                  {numero(m.visualizacoes)} visualizações · {numero(m.curtidas)} curtidas · {numero(m.comentarios)} comentários
                </span>
                {TRANSCRICAO[m.situacaoTranscricao] && <span className="text-muted-foreground text-xs">transcrição: {TRANSCRICAO[m.situacaoTranscricao]}</span>}
              </summary>
              <div className="mt-2 grid gap-2">
                {m.resumo && <p><strong>Resumo:</strong> {m.resumo}</p>}
                {m.legenda && <p className="whitespace-pre-wrap"><strong>Legenda:</strong> {m.legenda}</p>}
                {m.transcricao && <p className="whitespace-pre-wrap"><strong>Transcrição:</strong> {m.transcricao}</p>}
                <a href={m.permalink} target="_blank" rel="noreferrer noopener" className="text-primary underline">
                  Abrir no Instagram
                </a>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Páginas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {c.paginas.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma página cadastrada.</p>}
          {c.paginas.map((p) => (
            <div key={p.id} className="grid gap-2 text-sm">
              <p>
                <strong>{p.rotulo}</strong> ·{" "}
                <a href={p.url} target="_blank" rel="noreferrer noopener" className="underline">
                  {p.url}
                </a>{" "}
                · {p.ultimaCapturaEm ? (p.legivel ? "legível" : "não legível") : "ainda não lida"} · última leitura {dataHora(p.ultimaCapturaEm)}
              </p>
              {p.versoes.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão de</TableHead>
                      <TableHead>Preços achados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.versoes.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{dataHora(v.capturadaEm)}</TableCell>
                        <TableCell>{v.precos.join(" · ") || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
