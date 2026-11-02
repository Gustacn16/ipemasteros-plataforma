import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Cartao, SeloPlataforma } from "@/modulos/conteudo/componentes/exibicao";
import { lerFiltro } from "@/modulos/conteudo/componentes/filtro";
import { ROTULO_PLATAFORMA } from "@/modulos/conteudo/esquemas/conteudo";
import type { CartaoConteudo } from "@/modulos/conteudo/servicos/conteudos";
import { visaoGeral } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Conteúdo — IPEMaster OS" };

function Bloco({ titulo, itens, vazio, destaque, gravacao }: { titulo: string; itens: CartaoConteudo[]; vazio: string; destaque?: boolean; gravacao?: boolean }) {
  return (
    <section className="grid content-start gap-2" aria-label={titulo}>
      <h2 className={destaque && itens.length ? "font-semibold text-red-600" : "font-semibold"}>
        {titulo} <span className="text-muted-foreground font-normal">{itens.length}</span>
      </h2>
      {itens.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">{vazio}</p>
      ) : (
        <div className="grid gap-2">
          {itens.map((i) => (
            <Cartao key={i.id} item={i} mostrarGravacao={gravacao} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function PaginaVisaoGeral() {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const filtro = await lerFiltro();
  const v = await visaoGeral(usuario, filtro);

  // Publicados do mês por plataforma.
  const porPlataforma = new Map<string, { plataforma: (typeof v.publicadosMes)[number]["canal"]["plataforma"]; total: number }>();
  for (const p of v.publicadosMes) {
    const atual = porPlataforma.get(p.canal.plataforma) ?? { plataforma: p.canal.plataforma, total: 0 };
    atual.total++;
    porPlataforma.set(p.canal.plataforma, atual);
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="text-muted-foreground">O que precisa de atenção na produção de conteúdo.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { rotulo: "Atrasados", valor: v.atrasados.length, href: "/conteudo/planejamento", alerta: v.atrasados.length > 0 },
          { rotulo: "Banco de ideias", valor: v.ideias, href: "/conteudo/planejamento" },
          { rotulo: "Gravados aguardando edição", valor: v.aguardandoEdicao, href: "/conteudo/gravacoes" },
          { rotulo: "Publicados no mês", valor: v.publicadosMes.length, href: "/conteudo/publicados" },
        ].map((c) => (
          <Link key={c.rotulo} href={c.href} className="hover:bg-muted/50 rounded-lg border p-4">
            <p className="text-muted-foreground text-sm">{c.rotulo}</p>
            <p className={c.alerta ? "text-3xl font-semibold text-red-600" : "text-3xl font-semibold"}>{c.valor}</p>
          </Link>
        ))}
      </div>

      {porPlataforma.size > 0 && (
        <div className="flex flex-wrap gap-3 text-sm">
          {[...porPlataforma.values()].map((p) => (
            <span key={p.plataforma} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
              <SeloPlataforma plataforma={p.plataforma} /> {ROTULO_PLATAFORMA[p.plataforma]}: {p.total}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Bloco titulo="Atrasados" itens={v.atrasados} vazio="Nada atrasado." destaque />
        <Bloco titulo="Publicar nos próximos 7 dias" itens={v.proximos} vazio="Nada previsto para a semana." />
        <Bloco titulo="Gravações marcadas" itens={v.gravacoes} vazio="Nenhuma gravação marcada." gravacao />
      </div>
    </div>
  );
}
