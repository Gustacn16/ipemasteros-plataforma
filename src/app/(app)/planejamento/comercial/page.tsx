import type { Metadata } from "next";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { cn } from "@/lib/utils";
import { SemPlano } from "@/modulos/planejamento/componentes/criar-plano";
import { formatarPct, reaisDeCentavos, rotuloMesCurto, rotuloMesLongo } from "@/modulos/planejamento/componentes/formatar";
import { lerAnoMes } from "@/modulos/planejamento/componentes/parametros";
import { SeletorAnoMes } from "@/modulos/planejamento/componentes/seletor-ano-mes";
import { GradeMensal, SeloStatus } from "@/modulos/planejamento/componentes/tabela-desempenho";
import { obterPlanoComercial, type DadosPlanoComercial } from "@/modulos/planejamento/servicos/visoes";

export const metadata: Metadata = { title: "Plano comercial — IPEMaster OS" };

const n = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));
const th = "px-2 py-2 text-right font-normal";
const td = "px-2 py-1.5 text-right tabular-nums";

type LinhaProduto = DadosPlanoComercial["porProduto"]["mes"][number];

function TabelaPorProduto({ titulo, linhas, parcial }: { titulo: string; linhas: LinhaProduto[]; parcial?: boolean }) {
  const soma = linhas.reduce(
    (s, l) => ({ ma: s.ma + l.meta.alunos, ra: s.ra + l.realizado.alunos, mv: s.mv + l.meta.valorCentavos, rv: s.rv + l.realizado.valorCentavos }),
    { ma: 0, ra: 0, mv: 0, rv: 0 },
  );
  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <p className="border-b px-3 py-2 text-sm font-medium capitalize">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-sm">Sem meta nem venda.</p>
      ) : (
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="px-3 py-2 text-left font-normal">Produto</th>
              <th className={th}>Meta (alunos)</th>
              <th className={th}>Vendidos</th>
              <th className={th}>Meta (R$)</th>
              <th className={th}>Vendido (R$)</th>
              <th className={th}>% da meta</th>
              <th className="px-2 py-2 text-center font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.produtoId} className="border-b last:border-0">
                <td className="px-3 py-1.5 text-sm">{l.produto}</td>
                <td className={td}>{l.meta.alunos || "—"}</td>
                <td className={td}>{l.realizado.alunos}</td>
                <td className={td}>{l.meta.valorCentavos ? reaisDeCentavos(l.meta.valorCentavos) : "—"}</td>
                <td className={td}>{reaisDeCentavos(l.realizado.valorCentavos)}</td>
                <td className={td}>{formatarPct(l.pct)}</td>
                <td className="px-2 py-1.5 text-center">
                  <SeloStatus status={l.status} parcial={parcial && l.status !== null} />
                </td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-medium">
              <td className="px-3 py-1.5 text-sm">Total</td>
              <td className={td}>{soma.ma}</td>
              <td className={td}>{soma.ra}</td>
              <td className={td}>{reaisDeCentavos(soma.mv)}</td>
              <td className={td}>{reaisDeCentavos(soma.rv)}</td>
              <td className={td}>{soma.mv ? formatarPct(soma.rv / soma.mv) : "—"}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default async function PaginaPlanoComercial({ searchParams }: PageProps<"/planejamento/comercial">) {
  const usuario = await exigirPermissaoPagina("planejamento:ver");
  const { ano, mes } = await lerAnoMes(usuario, await searchParams);
  const d = await obterPlanoComercial(usuario, ano, mes);
  if (!d) {
    return (
      <div className="grid gap-4">
        <SeletorAnoMes ano={ano} />
        <SemPlano ano={ano} editor={temPermissao(usuario.papel, "planejamento:editar")} />
      </div>
    );
  }
  const total = d.meses.map((_, i) => d.produtos.reduce((s, p) => ({ alunos: s.alunos + p.meses[i].alunos, valorCentavos: s.valorCentavos + p.meses[i].valorCentavos }), { alunos: 0, valorCentavos: 0 }));
  const congelado = (m: string) => d.congelados.includes(m);
  const linhasFunil: { rotulo: string; valor: (f: DadosPlanoComercial["funil"][number]) => string; destaque?: boolean }[] = [
    { rotulo: "Meta de vendas (R$)", valor: (f) => reaisDeCentavos(f.valorCentavos), destaque: true },
    { rotulo: "Meta de vendas (alunos)", valor: (f) => n(f.alunos), destaque: true },
    { rotulo: "Reuniões realizadas necessárias", valor: (f) => n(f.reunioesRealizadas) },
    { rotulo: "Reuniões agendadas necessárias", valor: (f) => n(f.reunioesAgendadas) },
    { rotulo: "Leads necessários", valor: (f) => n(f.leads), destaque: true },
    { rotulo: "Verba de mídia", valor: (f) => reaisDeCentavos(f.verbaCentavos) },
    { rotulo: "Comissão comercial", valor: (f) => reaisDeCentavos(f.comissaoCentavos) },
    { rotulo: "CAC por aluno previsto", valor: (f) => reaisDeCentavos(f.cacPorAlunoCentavos) },
    { rotulo: "Teto de CAC por aluno (meta)", valor: (f) => reaisDeCentavos(f.cacTetoPorAlunoCentavos ?? null), destaque: true },
    { rotulo: "CAC % do vendido", valor: (f) => formatarPct(f.cacPct) },
  ];
  return (
    <div className="grid gap-6">
      <SeletorAnoMes ano={ano} mes={mes} />

      <section className="grid gap-2">
        <h2 className="font-semibold">Meta de vendas por produto</h2>
        <p className="text-muted-foreground text-sm">Vem das turmas e das metas avulsas. Meses com 🔒 já fecharam e a meta deles não muda mais.</p>
        {d.produtos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Cadastre premissas e turmas em Cadastrar → Turmas e metas avulsas.</p>
        ) : (
          <div className="bg-card overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1100px] text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="px-3 py-2 text-left font-normal">Produto</th>
                  <th className={th}>Antes</th>
                  {d.meses.map((m) => (
                    <th key={m} className={cn(th, "capitalize")}>
                      {congelado(m) && <span aria-label="mês fechado">🔒 </span>}
                      {rotuloMesCurto(m)}
                    </th>
                  ))}
                  <th className={th}>Depois</th>
                  <th className={cn(th, "border-l")}>Total do ano</th>
                </tr>
              </thead>
              <tbody>
                {d.produtos.map((p) => (
                  <tr key={p.produtoId} className="border-b align-top">
                    <td className="px-3 py-1.5 text-sm">{p.produto}</td>
                    {[p.antes, ...p.meses, p.depois].map((v, i) => (
                      <td key={i} className={cn(td, (i === 0 || i === 13) && "text-muted-foreground")}>
                        <div>{v.alunos || "—"}</div>
                        <div className="text-muted-foreground">{v.valorCentavos ? reaisDeCentavos(v.valorCentavos) : ""}</div>
                      </td>
                    ))}
                    <td className={cn(td, "border-l font-medium")}>
                      <div>{p.total.alunos}</div>
                      <div className="text-muted-foreground">{reaisDeCentavos(p.total.valorCentavos)}</div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-medium">
                  <td className="px-3 py-1.5 text-sm">Total</td>
                  <td className={td} />
                  {total.map((v, i) => (
                    <td key={i} className={td}>
                      <div>{v.alunos || "—"}</div>
                      <div className="text-muted-foreground">{v.valorCentavos ? reaisDeCentavos(v.valorCentavos) : ""}</div>
                    </td>
                  ))}
                  <td className={td} />
                  <td className={cn(td, "border-l")}>
                    <div>{total.reduce((s, v) => s + v.alunos, 0)}</div>
                    <div className="text-muted-foreground">{reaisDeCentavos(total.reduce((s, v) => s + v.valorCentavos, 0))}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Meta × realizado por produto</h2>
        <p className="text-muted-foreground text-sm">
          Vendas do Comercial de cada produto contra a meta do plano. Produto vendido sem meta também aparece. O acumulado vai de janeiro até o mês escolhido, sem o mês em andamento.
        </p>
        <div className="grid gap-3 xl:grid-cols-2">
          <TabelaPorProduto titulo={`${rotuloMesLongo(mes)}${d.porProduto.parcial ? " (parcial)" : ""}`} linhas={d.porProduto.mes} parcial={d.porProduto.parcial} />
          <TabelaPorProduto
            titulo={
              d.porProduto.mesesAcumulados.length
                ? `Acumulado ${rotuloMesCurto(d.porProduto.mesesAcumulados[0])}–${rotuloMesCurto(d.porProduto.mesesAcumulados.at(-1)!)} ${ano}`
                : `Acumulado ${ano}`
            }
            linhas={d.porProduto.acumulado}
          />
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">O que precisa acontecer no mês</h2>
        <p className="text-muted-foreground text-sm">Calculado de trás para frente a partir da meta de vendas e das premissas do funil. A meta de CAC por aluno é o teto ({formatarPct(d.tetoCacPct)} do vendido ÷ alunos); CAC previsto acima do teto fica em vermelho.</p>
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[1000px] text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="px-3 py-2 text-left font-normal">Mês</th>
                {d.meses.map((m) => (
                  <th key={m} className={cn(th, "capitalize")}>
                    {rotuloMesCurto(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasFunil.map((l) => (
                <tr key={l.rotulo} className="border-b last:border-0">
                  <td className={cn("px-3 py-1.5 text-sm", l.destaque && "font-medium")}>{l.rotulo}</td>
                  {d.funil.map((f) => (
                    <td key={f.mes} className={cn(td, l.rotulo.startsWith("CAC %") && f.acimaDoTeto && "text-red-700 dark:text-red-400")}>
                      {l.valor(f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="font-semibold">Estamos no caminho?</h2>
        <GradeMensal linhas={d.linhas} meses={d.meses} />
      </section>
    </div>
  );
}
