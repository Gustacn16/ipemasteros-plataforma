import { cn } from "@/lib/utils";
import { COR_PLATAFORMA, ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";

const SIGLA_PLATAFORMA: Record<Plataforma, string> = {
  instagram: "IG",
  youtube: "YT",
  tiktok: "TT",
  facebook: "FB",
  linkedin: "IN",
  newsletter: "NL",
  blog: "BL",
  podcast: "PC",
  outro: "··",
};

/** Selo pequeno da plataforma (cor + sigla), com o nome completo para leitores de tela.
 *  A cor da plataforma é dado: entra só como fundo suave e borda; o texto usa o token do tema. */
export function SeloPlataforma({ plataforma, publicado }: { plataforma: Plataforma; publicado?: boolean }) {
  return (
    <span
      title={ROTULO_PLATAFORMA[plataforma] + (publicado ? " · publicado" : "")}
      className={cn(
        "text-foreground inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded border px-1 text-[10px] font-bold",
        publicado && "ring-sucesso ring-offset-background ring-2 ring-offset-1",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${COR_PLATAFORMA[plataforma]} 22%, transparent)`,
        borderColor: `color-mix(in oklab, ${COR_PLATAFORMA[plataforma]} 70%, var(--foreground))`,
      }}
    >
      <span aria-hidden>{SIGLA_PLATAFORMA[plataforma]}</span>
      <span className="sr-only">
        {ROTULO_PLATAFORMA[plataforma]}
        {publicado ? " (publicado)" : ""}
      </span>
    </span>
  );
}

