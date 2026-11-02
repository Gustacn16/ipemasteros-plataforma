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

/** Selo pequeno da plataforma (cor + sigla), com o nome completo para leitores de tela. */
export function SeloPlataforma({ plataforma, publicado }: { plataforma: Plataforma; publicado?: boolean }) {
  return (
    <span
      title={ROTULO_PLATAFORMA[plataforma] + (publicado ? " · publicado" : "")}
      className={cn(
        "inline-flex h-5 min-w-6 items-center justify-center rounded px-1 text-[10px] font-bold text-white",
        publicado && "ring-2 ring-green-500 ring-offset-1",
      )}
      style={{ backgroundColor: COR_PLATAFORMA[plataforma] }}
    >
      <span aria-hidden>{SIGLA_PLATAFORMA[plataforma]}</span>
      <span className="sr-only">
        {ROTULO_PLATAFORMA[plataforma]}
        {publicado ? " (publicado)" : ""}
      </span>
    </span>
  );
}

