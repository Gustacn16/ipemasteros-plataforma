"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { analisarPlanilhaAcao, importarPlanilhaAcao } from "../acoes/importacao";
import { ROTULO_SITUACAO_MATRICULA, type SituacaoMatricula } from "../esquemas/academico";
import { IGNORAR } from "../importacao/planejar";

const estiloSelect = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

/**
 * Importação em três passos (spec Acadêmico 1, §6). O arquivo fica guardado
 * aqui na tela e é reenviado na gravação; a prévia nunca mostra nomes.
 */
export function Importador() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [previa, analisar, analisando] = useActionState(analisarPlanilhaAcao, { ok: false });
  const [resultado, importar, importando] = useActionState(importarPlanilhaAcao, { ok: false });

  // Sem <form>: o React limparia o campo de arquivo depois da primeira ação.
  const enviar = (acao: (fd: FormData) => void, mapeamento: Record<string, string> = {}) => {
    if (!arquivo) return;
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    for (const [curso, produto] of Object.entries(mapeamento)) fd.set(`produto:${curso}`, produto);
    startTransition(() => acao(fd));
  };

  const dados = previa.ok ? previa.dados : undefined;
  const escolha = (curso: string, sugestao: string | null) => mapa[curso] ?? sugestao ?? "";
  const faltaEscolher = dados?.cursos.some((c) => !escolha(c.curso, c.sugestao));

  if (resultado.ok && resultado.dados) {
    const r = resultado.dados;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Importação concluída</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ul className="grid gap-1">
            <li>Turmas criadas: {r.turmasCriadas}</li>
            <li>Alunos novos: {r.alunosCriados}</li>
            <li>Alunos que já estavam no sistema: {r.alunosExistentes}</li>
            <li>Matrículas criadas: {r.matriculasCriadas}</li>
            <li>Matrículas atualizadas: {r.matriculasAtualizadas}</li>
            <li>Linhas ignoradas: {r.ignoradas}</li>
          </ul>
          {r.avisos.length > 0 && (
            <div>
              <p className="font-medium">Avisos</p>
              <ul className="text-muted-foreground list-disc pl-5">
                {r.avisos.map((a) => (
                  <li key={`${a.aba}-${a.numero}`}>
                    Aba “{a.aba}”, linha {a.numero}: {a.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <Button asChild>
              <Link href="/academico">Ver a visão geral</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha a planilha</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-muted-foreground text-sm">
            Arquivo .xlsx de até 5 MB. São lidas as abas que têm as colunas Nome, Curso e Turma. Nada é gravado antes do passo 3.
          </p>
          <div className="grid max-w-md gap-1.5">
            <Label htmlFor="arquivo">Planilha</Label>
            <Input
              id="arquivo"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setArquivo(e.target.files?.[0] ?? null);
                setMapa({});
              }}
            />
          </div>
          <div>
            <Button type="button" disabled={!arquivo || analisando} onClick={() => enviar(analisar)}>
              {analisando ? "Lendo…" : "Ler planilha"}
            </Button>
          </div>
          {!previa.ok && previa.mensagem && (
            <Alert variant="destructive">
              <AlertDescription>{previa.mensagem}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {dados && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Confira o que foi encontrado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm">
              {dados.abas.map((a) => (
                <div key={a.nome} className="grid gap-1">
                  <p className="font-medium">
                    Aba “{a.nome}”: {a.linhas} alunos
                  </p>
                  <p className="text-muted-foreground">
                    {Object.entries(a.situacoes)
                      .map(([s, n]) => `${ROTULO_SITUACAO_MATRICULA[s as SituacaoMatricula]}: ${n}`)
                      .join(" · ")}
                  </p>
                  <p className="text-muted-foreground">Turmas: {a.turmas.join(", ")}</p>
                </div>
              ))}
              {dados.abasIgnoradas.length > 0 && (
                <p className="text-muted-foreground">Abas ignoradas (sem as colunas de alunos): {dados.abasIgnoradas.join(", ")}</p>
              )}

              <div className="grid gap-2">
                <p className="font-medium">A que produto pertence cada valor da coluna “Curso”?</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso na planilha</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead className="text-right">Ativos</TableHead>
                      <TableHead className="min-w-64">Produto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dados.cursos.map((c) => (
                      <TableRow key={c.curso}>
                        <TableCell>{c.curso || "(vazio)"}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.linhas}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.ativos}</TableCell>
                        <TableCell>
                          <select
                            aria-label={`Produto para ${c.curso}`}
                            className={estiloSelect}
                            value={escolha(c.curso, c.sugestao)}
                            onChange={(e) => setMapa((m) => ({ ...m, [c.curso]: e.target.value }))}
                          >
                            <option value="">Escolha…</option>
                            <option value={IGNORAR}>Ignorar estas linhas</option>
                            {dados.produtos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                          {c.erros.length > 0 && escolha(c.curso, c.sugestao) !== IGNORAR && (
                            <ul className="text-destructive mt-1 list-disc pl-5 text-xs">
                              {c.erros.map((e) => (
                                <li key={`${e.aba}-${e.numero}-${e.mensagem}`}>
                                  Aba “{e.aba}”, linha {e.numero}: {e.mensagem}
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Gravar</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <p className="text-muted-foreground">
                Turmas que ainda não existem são criadas. Alunos e matrículas que já existem são atualizados, sem duplicar. Se houver
                qualquer problema, nada é gravado.
              </p>
              {!resultado.ok && resultado.mensagem && (
                <Alert variant="destructive">
                  <AlertDescription>{resultado.mensagem}</AlertDescription>
                </Alert>
              )}
              <div>
                <Button
                  type="button"
                  disabled={faltaEscolher || importando}
                  onClick={() => {
                    // Envia também as sugestões que o usuário não mudou.
                    const completo = Object.fromEntries(dados.cursos.map((c) => [c.curso, escolha(c.curso, c.sugestao)]));
                    setMapa(completo);
                    enviar(importar, completo);
                  }}
                >
                  {importando ? "Importando…" : "Importar"}
                </Button>
                {faltaEscolher && <p className="text-muted-foreground mt-1 text-xs">Escolha o produto (ou “Ignorar”) para cada curso.</p>}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
