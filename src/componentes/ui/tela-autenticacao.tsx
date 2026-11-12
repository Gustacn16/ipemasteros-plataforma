import { SunIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = { children: ReactNode; frase?: string };

/**
 * Moldura das telas de acesso: painel escuro decorativo à esquerda e o
 * conteúdo (cartão com formulário) à direita. Os cartões dentro dela perdem a
 * borda e a cor primária vira laranja, para casar com o painel. Fica sempre no
 * tema claro (.tema-claro), mesmo com o tema escuro ligado.
 */
export function TelaAutenticacao({
  children,
  frase = "Toda a operação da IPEMaster em um só lugar.",
}: Props) {
  return (
    <main className="tema-claro text-foreground flex flex-1 items-center justify-center overflow-hidden bg-neutral-100 p-4">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl md:min-h-[36rem] md:flex-row">
        <PainelDecorativo frase={frase} />

        <div className="flex flex-col justify-center p-8 text-neutral-900 md:w-1/2 md:p-12 [--primary:var(--color-orange-500)] [--primary-foreground:var(--color-white)] [--ring:var(--color-orange-500)] [&_[data-slot=card]]:gap-6 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:ring-0 [&_[data-slot=card]]:[--card-spacing:0px] [&_[data-slot=card-title]]:text-3xl [&_[data-slot=card-title]]:tracking-tight [&_[data-slot=button]]:h-11 [&_[data-slot=button]]:hover:bg-orange-600 [--muted-foreground:var(--color-neutral-600)] [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:border-neutral-300">
          <SunIcon className="mb-4 size-10 text-orange-500" aria-hidden />
          {children}
        </div>
      </div>
    </main>
  );
}

function PainelDecorativo({ frase }: { frase: string }) {
  return (
    <div className="relative h-44 overflow-hidden bg-black p-8 text-white md:h-auto md:w-1/2 md:rounded-br-3xl md:p-12">
      {/* "Sol" laranja ao fundo, desfocado pelas faixas de vidro. */}
      <div aria-hidden className="absolute -bottom-24 left-1/2 size-60 -translate-x-1/2 rounded-full bg-orange-500" />
      <div aria-hidden className="absolute bottom-0 left-1/2 h-20 w-32 -translate-x-1/2 rounded-full bg-white" />
      <div aria-hidden className="absolute inset-0 flex backdrop-blur-2xl">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-full w-16 shrink-0 bg-linear-90 from-[#ffffff00] via-[#000000] via-[69%] to-[#ffffff30] opacity-30"
          />
        ))}
      </div>
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-transparent to-black" />

      <p className="relative z-10 mb-3 text-sm font-semibold tracking-wide text-white/70">IPEMaster OS</p>
      <p className="relative z-10 max-w-xs text-2xl leading-tight font-medium tracking-tight md:text-3xl">
        {frase}
      </p>
    </div>
  );
}
