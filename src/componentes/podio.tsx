import { CrownIcon } from "lucide-react";
import { cn } from "cn";

export type ItemPodio = { id: string; nome: string; valor: string; foto?: string | null };

const DEGRAUS = [
  { altura: 70, cor: "bg-podio-ouro", rotulo: "1º" },
  { altura: 46, cor: "bg-podio-prata", rotulo: "2º" },
  { altura: 32, cor: "bg-podio-bronze", rotulo: "3º" },
] as const;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

/** Até 3 itens na ordem de colocação; desenha 2-1-3 mostrando só os degraus existentes. */
export function Podio({ itens }: { itens: ItemPodio[] }) {
  const top = itens.slice(0, 3);
  if (top.length === 0) return null;
  // Posições (índice da colocação) na ordem visual: 2º, 1º, 3º.
  const ordem = [1, 0, 2].filter((i) => i < top.length);

  return (
    <ol className="flex items-end justify-center gap-2 sm:gap-3" aria-label="Pódio">
      {ordem.map((i) => {
        const item = top[i];
        const degrau = DEGRAUS[i];
        return (
          <li key={item.id} className="flex w-24 min-w-0 flex-col items-center gap-1 sm:w-28">
            {i === 0 ? <CrownIcon className="text-podio-ouro size-5" aria-hidden /> : null}
            {item.foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.foto} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden
                className="bg-muted text-foreground flex size-12 items-center justify-center rounded-full text-sm font-semibold"
              >
                {iniciais(item.nome)}
              </span>
            )}
            <span className="text-foreground w-full truncate text-center text-sm font-medium" title={item.nome}>
              {item.nome}
            </span>
            <span
              className="text-muted-foreground w-full truncate text-center text-xs tabular-nums"
              title={`${degrau.rotulo} · ${item.valor}`}
            >
              {degrau.rotulo} · {item.valor}
            </span>
            <div
              aria-hidden
              style={{ height: degrau.altura }}
              className={cn("w-full rounded-t-md", degrau.cor)}
            />
          </li>
        );
      })}
    </ol>
  );
}
