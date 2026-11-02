import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatarDataHora } from "@/lib/datas";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { EditorConteudo } from "@/modulos/conteudo/componentes/editor-conteudo";
import { BadgeEtapa } from "@/modulos/conteudo/componentes/exibicao";
import { PublicacoesConteudo } from "@/modulos/conteudo/componentes/publicacoes-conteudo";
import { SeletorEtapa } from "@/modulos/conteudo/componentes/seletor-etapa";
import { ROTULO_FORMATO } from "@/modulos/conteudo/esquemas/conteudo";
import { obterConteudo } from "@/modulos/conteudo/servicos/conteudos";

export const metadata: Metadata = { title: "Conteúdo — IPEMaster OS" };

export default async function PaginaItemConteudo({ params }: PageProps<"/conteudo/itens/[id]">) {
  const usuario = await exigirPermissaoPagina("conteudo:usar");
  const { id } = await params;
  const { conteudo, pessoas, podeAprovar } = await obterConteudo(usuario, id).catch((erro) => {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  });
  const liberada = conteudo.etapa === "aprovado" || conteudo.etapa === "publicado";

  return (
    // A key remonta os formulários quando o conteúdo muda no servidor.
    <div key={conteudo.atualizadoEm.toISOString()} className="grid max-w-4xl gap-8">
      <header className="grid gap-3">
        <Link href={`/conteudo/planejamento?marca=${conteudo.marca.id}`} className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline">
          <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: conteudo.marca.cor }} />
          {conteudo.marca.nome} · {ROTULO_FORMATO[conteudo.formato]}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{conteudo.titulo}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <BadgeEtapa etapa={conteudo.etapa} />
          <SeletorEtapa conteudoId={conteudo.id} etapa={conteudo.etapa} />
          {conteudo.etapa === "revisao" && !podeAprovar && (
            <span className="text-muted-foreground text-sm">Aguardando aprovação de um gestor.</span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          Criado por {conteudo.criadoPor.nome} em {formatarDataHora(conteudo.criadoEm)}
          {conteudo.aprovadoPor && conteudo.aprovadoEm && ` · Aprovado por ${conteudo.aprovadoPor.nome} em ${formatarDataHora(conteudo.aprovadoEm)}`}
        </p>
      </header>

      <section aria-labelledby="sec-dados" className="grid gap-3">
        <h2 id="sec-dados" className="sr-only">
          Dados do conteúdo
        </h2>
        <EditorConteudo
          conteudo={conteudo}
          canais={conteudo.marca.canais}
          canaisSelecionados={conteudo.publicacoes.map((p) => p.canalId)}
          pessoas={pessoas}
        />
      </section>

      <section aria-labelledby="sec-pub" className="grid gap-3 border-t pt-6">
        <div>
          <h2 id="sec-pub" className="font-semibold">
            Publicações nos canais
          </h2>
          <p className="text-muted-foreground text-sm">
            Depois de publicar em cada canal, marque aqui com o link. Quando todos estiverem marcados, o conteúdo vira Publicado.
          </p>
        </div>
        <PublicacoesConteudo publicacoes={conteudo.publicacoes} liberada={liberada} />
      </section>
    </div>
  );
}
