"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";

/** Miniatura do anúncio vinda da Meta. A URL expira; sem ela (ou vencida), mostra um ícone. */
export function MiniaturaCriativo({ src }: { src: string | null }) {
  const [falhou, setFalhou] = useState(false);
  if (!src || falhou) {
    return (
      <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/50">
        <ImageIcon className="size-6" />
      </span>
    );
  }
  return (
    // Imagem externa da Meta, sem passar pelo otimizador.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFalhou(true)}
      className="size-16 shrink-0 rounded-xl object-cover"
    />
  );
}
