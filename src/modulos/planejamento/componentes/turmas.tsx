"use client";

import { TrashIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { formatarReais } from "@/lib/dinheiro";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { excluirTurmaAcao, salvarMetaAvulsaAcao, salvarTurmaAcao } from "../acoes/planejamento";
import type { CadastroDoPlano } from "../servicos/planos";
import { rotuloMesCurto, rotuloMesLongo } from "./formatar";
import { CampoReais, CampoSimples, Escolha, paraCampo, useAcao } from "./ui-plano";

type Turma = CadastroDoPlano["turmas"][number];
const herda = "text-muted-foreground italic";

/** Calendário de turmas: cada turma vira meta de vendas nos meses da janela, terminando no mês de abertura. */
export function CalendarioTurmas({ plano }: { plano: CadastroDoPlano }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Turma | null>(null);
  const [chave, setChave] = useState(0);
  const limpar = () => {
    setEditando(null);
    setChave((c) => c + 1);
  };
  const [estado, executar, salvando] = useAcao(salvarTurmaAcao, limpar);
  const [excluindo, iniciar] = useTransition();
  const e = estado.erros ?? {};
  const premissa = (produtoId: string) => plano.premissas.find((p) => p.produtoId === produtoId);

  return (
    <section className="bg-card grid gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">Calendário de turmas</h2>
        <p className="text-muted-foreground text-sm">
          Campos vazios usam a premissa do produto (em itálico na lista). A turma vende nos meses da janela, terminando no mês de abertura.
        </p>
      </div>
      {plano.turmas.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma turma cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 font-normal">Produto</th>
                <th className="py-2 pr-3 font-normal">Turma</th>
                <th className="py-2 pr-3 font-normal">Abertura</th>
                <th className="py-2 pr-3 text-right font-normal">Alunos</th>
                <th className="py-2 pr-3 text-right font-normal">Contrato</th>
                <th className="py-2 pr-3 text-right font-normal">Janela</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {plano.turmas.map((t) => {
                const p = premissa(t.produtoId);
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{t.produto}</td>
                    <td className="py-2 pr-3">{t.codigo}</td>
                    <td className="py-2 pr-3 capitalize">{rotuloMesLongo(t.mesAbertura)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${t.alunos === null ? herda : ""}`}>{t.alunos ?? p?.alunosPorTurma ?? "—"}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${t.contratoMedio === null ? herda : ""}`}>
                      {t.contratoMedio ? formatarReais(t.contratoMedio) : p ? formatarReais(p.contratoMedio) : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${t.janelaVendasMeses === null ? herda : ""}`}>
                      {t.janelaVendasMeses ?? p?.janelaVendasMeses ?? 1} meses
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => { setEditando(t); setChave((c) => c + 1); }}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir ${t.codigo}`}
                        disabled={excluindo}
                        onClick={() => {
                          if (!confirm(`Excluir a turma ${t.codigo} de ${t.produto}?`)) return;
                          iniciar(async () => {
                            if (avisar(await excluirTurmaAcao(plano.id, t.id))) router.refresh();
                          });
                        }}
                      >
                        <TrashIcon />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {plano.turmasDeOutrosPlanos.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Também vendem em {plano.ano} (cadastradas em outro plano):{" "}
          {plano.turmasDeOutrosPlanos.map((t) => `${t.produto} ${t.codigo} (abre ${rotuloMesCurto(t.mesAbertura)}/${t.mesAbertura.slice(0, 4)}, plano ${t.anoDoPlano})`).join(" · ")}.
        </p>
      )}
      <form key={chave} action={executar} className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2 lg:grid-cols-4">
        <input type="hidden" name="planoId" value={plano.id} />
        {editando && <input type="hidden" name="id" value={editando.id} />}
        <Escolha rotulo="Produto" name="produtoId" defaultValue={editando?.produtoId ?? ""} erros={e.produtoId} className="lg:col-span-2">
          <option value="">Escolha…</option>
          {plano.produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Escolha>
        <CampoSimples rotulo="Código" name="codigo" placeholder="T5" defaultValue={editando?.codigo ?? ""} erros={e.codigo} />
        <CampoSimples rotulo="Mês de abertura" name="mesAbertura" type="month" defaultValue={editando?.mesAbertura ?? `${plano.ano}-01`} erros={e.mesAbertura} />
        <CampoSimples rotulo="Alunos" name="alunos" type="number" min={1} placeholder="da premissa" defaultValue={editando?.alunos ?? ""} erros={e.alunos} />
        <CampoReais rotulo="Contrato médio (R$)" name="contratoMedio" placeholder="da premissa" defaultValue={paraCampo(editando?.contratoMedio)} erros={e.contratoMedio} />
        <CampoSimples rotulo="Janela (meses)" name="janelaVendasMeses" type="number" min={1} placeholder="da premissa" defaultValue={editando?.janelaVendasMeses ?? ""} erros={e.janelaVendasMeses} />
        <CampoSimples rotulo="Duração (meses)" name="duracaoMeses" type="number" min={1} placeholder="da premissa" defaultValue={editando?.duracaoMeses ?? ""} erros={e.duracaoMeses} />
        <CampoSimples rotulo="Observação" name="observacoes" defaultValue={editando?.observacoes ?? ""} erros={e.observacoes} className="sm:col-span-2 lg:col-span-3" />
        <div className="flex items-end justify-end gap-2">
          {editando && (
            <Button type="button" variant="outline" onClick={limpar}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : editando ? "Salvar turma" : "Adicionar turma"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Metas sem turma: curso livre, paciente modelo, assinatura. Alunos e valor vazios apagam. */
export function MetasAvulsas({ plano }: { plano: CadastroDoPlano }) {
  const [chave, setChave] = useState(0);
  const [estado, executar, salvando] = useAcao(salvarMetaAvulsaAcao, () => setChave((c) => c + 1));
  const e = estado.erros ?? {};
  return (
    <section className="bg-card grid gap-4 rounded-xl border p-4">
      <div>
        <h2 className="font-semibold">Metas avulsas</h2>
        <p className="text-muted-foreground text-sm">Para produtos que vendem sem turma. Somam com a meta das turmas no mesmo mês. Para apagar, salve o mês com alunos e valor vazios.</p>
      </div>
      {plano.metasAvulsas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="py-2 pr-3 font-normal">Produto</th>
                <th className="py-2 pr-3 font-normal">Mês</th>
                <th className="py-2 pr-3 text-right font-normal">Alunos</th>
                <th className="py-2 text-right font-normal">Valor</th>
              </tr>
            </thead>
            <tbody>
              {plano.metasAvulsas.map((a) => (
                <tr key={`${a.produtoId}-${a.mes}`} className="border-b last:border-0">
                  <td className="py-2 pr-3">{a.produto}</td>
                  <td className="py-2 pr-3 capitalize">{rotuloMesLongo(a.mes)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{a.alunos}</td>
                  <td className="py-2 text-right tabular-nums">{formatarReais(a.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form key={chave} action={executar} className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2 lg:grid-cols-5">
        <input type="hidden" name="planoId" value={plano.id} />
        <Escolha rotulo="Produto" name="produtoId" defaultValue="" erros={e.produtoId} className="lg:col-span-2">
          <option value="">Escolha…</option>
          {plano.produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Escolha>
        <CampoSimples rotulo="Mês" name="mes" type="month" defaultValue={`${plano.ano}-01`} min={`${plano.ano}-01`} max={`${plano.ano}-12`} erros={e.mes} />
        <CampoSimples rotulo="Alunos" name="alunos" type="number" min={0} erros={e.alunos} />
        <CampoReais rotulo="Valor (R$)" name="valor" erros={e.valor} />
        <div className="flex justify-end sm:col-span-2 lg:col-span-5">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar meta avulsa"}
          </Button>
        </div>
      </form>
    </section>
  );
}
