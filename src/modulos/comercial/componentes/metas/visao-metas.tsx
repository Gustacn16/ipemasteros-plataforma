import { PlusIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { AnelPercentual } from "@/componentes/anel-percentual";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Podio } from "@/componentes/podio";
import { Button } from "@/componentes/ui/button";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { faixaMeta } from "../../regras/dashboard";
import type { VisaoMetas } from "../../servicos/metas";
import { GraficoMetas } from "./grafico-metas";

/** Cores das metas do Comercial (spec, seção 8): verde ≥ 100%, âmbar 70–99%, vermelho < 70%. */
const COR_DA_FAIXA = { verde: "sucesso", amarelo: "atencao", vermelho: "perigo" } as const;
const faixaDaMeta = (p: number | null) => {
  const f = faixaMeta(p);
  return f ? COR_DA_FAIXA[f] : null;
};

const cartao = "bg-card text-card-foreground rounded-xl border p-4";

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

function Foto({ nome, foto, tamanho = "size-12" }: { nome: string; foto: string | null; tamanho?: string }) {
  return foto ? (
    // Foto servida por rota protegida; não passa pelo otimizador de imagens.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" className={cn(tamanho, "shrink-0 rounded-full object-cover")} />
  ) : (
    <span
      aria-hidden
      className={cn(tamanho, "bg-muted text-foreground flex shrink-0 items-center justify-center rounded-full text-sm font-semibold")}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Visão das metas do mês: anel do total, números, gráfico por vendedor, cartões com foto e pódio. */
export function VisaoDasMetas({ dados }: { dados: VisaoMetas }) {
  const t = dados.total;
  const semMeta = t.percentual === null;

  if (semMeta && t.vendas === 0) {
    return (
      <EstadoVazio
        icone={TargetIcon}
        titulo="Nenhuma meta neste mês"
        descricao={
          dados.podeEditar
            ? "Cadastre as metas por produto e vendedor para acompanhar o mês aqui."
            : "Quando a gestão cadastrar suas metas, elas aparecem aqui."
        }
        acao={
          dados.podeEditar ? (
            <Button asChild>
              <Link href={`/comercial/metas/cadastro?mes=${dados.mes}`}>
                <PlusIcon /> Cadastrar metas
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid gap-6">
      <section aria-label="Meta do mês" className="grid gap-3 md:grid-cols-[auto_1fr]">
        <div className={cn(cartao, "flex items-center gap-4")}>
          <AnelPercentual percentual={t.percentual} tamanho={120} faixa={faixaDaMeta} rotulo="da meta do mês" />
          <div className="grid gap-1">
            <p className="text-muted-foreground text-sm">{dados.equipe ? "Meta da equipe" : "Sua meta"}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatarReais(t.vendido)}</p>
            <p className="text-muted-foreground text-sm">de {formatarReais(t.metaValor)}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CartaoNumero rotulo="Meta do mês" valor={formatarReais(t.metaValor)} />
          <CartaoNumero rotulo="Vendido" valor={formatarReais(t.vendido)} tom={faixaDaMeta(t.percentual) ?? "neutro"} />
          <CartaoNumero rotulo="Falta vender" valor={Number(t.falta) === 0 && !semMeta ? "Meta batida" : formatarReais(t.falta)} />
          <CartaoNumero rotulo="Vendas" valor={t.vendas}>
            {t.metaQuantidade > 0 ? `de ${t.metaQuantidade} na meta` : "sem meta de quantidade"}
          </CartaoNumero>
        </div>
      </section>

      {dados.equipe && dados.vendedores.length > 0 && (
        <section aria-labelledby="titulo-grafico-metas" className={cn(cartao, "grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
          <div className="grid min-w-0 gap-2">
            <h2 id="titulo-grafico-metas" className="font-semibold">
              Vendido × meta por vendedor
            </h2>
            <GraficoMetas
              pontos={dados.vendedores.map((v) => ({
                nome: v.nome.split(" ")[0] ?? v.nome,
                vendido: Number(v.vendido),
                meta: Number(v.metaValor),
              }))}
            />
          </div>
          <div className="grid content-start gap-3">
            <h2 className="font-semibold">Pódio do mês</h2>
            {dados.podio.length > 0 ? (
              <Podio itens={dados.podio.map((v) => ({ id: v.id, nome: v.nome, valor: `${v.percentual}%`, foto: v.foto }))} />
            ) : (
              <p className="text-muted-foreground text-sm">O pódio aparece quando houver metas cadastradas.</p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="titulo-vendedores" className="grid gap-3">
        <h2 id="titulo-vendedores" className="font-semibold">
          {dados.equipe ? "Por vendedor" : "Seu progresso"}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {dados.vendedores.map((v) => {
            const eu = v.id === dados.euId;
            return (
              <li key={v.id} className={cn(cartao, "grid gap-3", eu && "border-primary ring-primary/20 ring-2")}>
                <div className="flex items-center gap-3">
                  <Foto nome={v.nome} foto={v.foto} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {v.nome}
                      {eu && <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">Você</span>}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {v.vendas} {v.vendas === 1 ? "venda" : "vendas"}
                      {v.metaQuantidade > 0 && ` de ${v.metaQuantidade}`}
                    </p>
                  </div>
                  <AnelPercentual percentual={v.percentual} tamanho={64} faixa={faixaDaMeta} rotulo="da meta" />
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Meta</dt>
                    <dd className="font-medium tabular-nums">{v.percentual === null ? "—" : formatarReais(v.metaValor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Vendido</dt>
                    <dd className="font-medium tabular-nums">{formatarReais(v.vendido)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Falta</dt>
                    <dd className="font-medium tabular-nums">
                      {v.percentual === null ? "—" : Number(v.falta) === 0 ? "Batida" : formatarReais(v.falta)}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
