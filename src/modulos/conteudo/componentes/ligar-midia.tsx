"use client";

import { CameraIcon, ExternalLinkIcon, FilmIcon, GalleryHorizontalIcon, ImageIcon, LinkIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { candidatasParaLigarAcao, ligarMidiaAcao } from "../acoes/instagram";
import { ORDENS_MIDIA, type OrdemMidia, type TipoMidia } from "../regras/instagram";
import type { LinhaMidia } from "../servicos/visao-instagram";

const numero = new Intl.NumberFormat("pt-BR");
const fmt = (v: number | null) => (v === null ? "—" : numero.format(v));
const formatoData = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

const TIPO: Record<TipoMidia, { rotulo: string; icone: LucideIcon }> = {
  post: { rotulo: "Post", icone: ImageIcon },
  carrossel: { rotulo: "Carrossel", icone: GalleryHorizontalIcon },
  reels: { rotulo: "Reels", icone: FilmIcon },
  story: { rotulo: "Story", icone: CameraIcon },
};
const ROTULO_ORDEM: Record<OrdemMidia, string> = { data: "Mais recentes", alcance: "Maior alcance", interacoes: "Mais interações" };

/** Miniatura do post; o link da Meta expira, então cai para o ícone do tipo quando não carrega. */
function Miniatura({ url, tipo }: { url: string | null; tipo: TipoMidia }) {
  const [falhou, setFalhou] = useState(false);
  const Icone = TIPO[tipo].icone;
  if (!url || falhou)
    return (
      <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-md">
        <Icone className="size-5" aria-hidden />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" onError={() => setFalhou(true)} className="size-12 shrink-0 rounded-md object-cover" />;
}

type Candidata = { publicacaoId: string; conteudoId: string; titulo: string; dataPublicacao: Date | null };

/** Diálogo "Ligar a um conteúdo": lista os conteúdos aprovados do canal, mais perto da data do post primeiro. */
function LigarAConteudo({ midiaId }: { midiaId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [candidatas, setCandidatas] = useState<Candidata[] | null>(null);
  const [carregando, carregar] = useTransition();
  const [ligando, ligar] = useTransition();

  const abrir = (sim: boolean) => {
    setAberto(sim);
    if (sim && candidatas === null)
      carregar(async () => {
        const r = await candidatasParaLigarAcao(midiaId);
        if (avisar(r)) setCandidatas(r.dados ?? []);
      });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => abrir(true)}>
        <LinkIcon /> Ligar a um conteúdo
      </Button>
      <Dialog open={aberto} onOpenChange={abrir}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ligar a um conteúdo</DialogTitle>
            <DialogDescription>Os números do post passam a aparecer no conteúdo, e a publicação fica marcada como feita.</DialogDescription>
          </DialogHeader>
          {carregando || candidatas === null ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : candidatas.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum conteúdo aprovado com publicação livre neste canal.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {candidatas.map((c) => (
                <li key={c.publicacaoId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.titulo}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.dataPublicacao
                        ? `Previsto para ${formatoData.format(new Date(c.dataPublicacao.getTime() + 12 * 3600_000))}`
                        : "Sem data prevista"}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    disabled={ligando}
                    onClick={() =>
                      ligar(async () => {
                        if (avisar(await ligarMidiaAcao({ midiaId, publicacaoId: c.publicacaoId }))) {
                          setAberto(false);
                          router.refresh();
                        }
                      })
                    }
                  >
                    Ligar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Seção "Instagram" de Publicados: todos os posts e stories do mês, com a ligação ao conteúdo. */
export function ListaMidiasInstagram({ midias, ordem, mes }: { midias: LinhaMidia[]; ordem: OrdemMidia; mes: string }) {
  return (
    <section aria-labelledby="sec-instagram" className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sec-instagram" className="text-foreground font-semibold">
          Instagram <span className="text-muted-foreground font-normal tabular-nums">{midias.length}</span>
        </h2>
        <nav aria-label="Ordem dos posts" className="flex flex-wrap gap-1">
          {ORDENS_MIDIA.map((o) => (
            <Link
              key={o}
              href={`/conteudo/publicados?mes=${mes}&ordem=${o}`}
              aria-current={ordem === o ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                ordem === o ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ROTULO_ORDEM[o]}
            </Link>
          ))}
        </nav>
      </div>
      <ul className="grid gap-2">
        {midias.map((m) => {
          const tipo = TIPO[m.tipo];
          return (
            <li key={m.id} className="bg-card text-card-foreground flex min-w-0 flex-wrap items-start gap-3 rounded-xl border p-3 text-sm">
              <Miniatura url={m.miniaturaUrl} tipo={m.tipo} />
              <div className="grid min-w-0 flex-1 gap-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <ChipSituacao tamanho="sm" icone={tipo.icone}>
                    {tipo.rotulo}
                  </ChipSituacao>
                  <span className="text-muted-foreground text-xs">{formatoData.format(m.publicadoEm)}</span>
                  <a
                    href={m.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
                  >
                    <ExternalLinkIcon className="size-3" aria-hidden /> Abrir no Instagram
                  </a>
                </div>
                {m.publicacao ? (
                  <Link
                    href={`/conteudo/itens/${m.publicacao.conteudo.id}`}
                    className="text-foreground truncate font-medium hover:underline"
                  >
                    {m.publicacao.conteudo.titulo}
                  </Link>
                ) : (
                  <p className="text-muted-foreground line-clamp-1 break-words">{m.legenda || "Sem legenda"}</p>
                )}
                <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <div>
                    <dt className="inline">Alcance </dt>
                    <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.alcance)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Visualizações </dt>
                    <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.visualizacoes)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Interações </dt>
                    <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.interacoes)}</dd>
                  </div>
                  {m.tipo === "story" ? (
                    <div>
                      <dt className="inline">Respostas </dt>
                      <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.respostas)}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt className="inline">Salvos </dt>
                      <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.salvamentos)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">Compart. </dt>
                    <dd className="text-foreground inline font-medium tabular-nums">{fmt(m.compartilhamentos)}</dd>
                  </div>
                </dl>
              </div>
              {!m.publicacao && (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ChipSituacao tamanho="sm" tom="atencao">
                    Fora do planejamento
                  </ChipSituacao>
                  <LigarAConteudo midiaId={m.id} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
