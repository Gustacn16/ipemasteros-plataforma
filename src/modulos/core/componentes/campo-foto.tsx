"use client";

import { CameraIcon, UserRoundIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/componentes/ui/button";
import { LADO_FOTO } from "../regras/perfil";

/** Recorta o centro em quadrado e reduz para LADO_FOTO px em JPEG (~50 KB). */
async function prepararFoto(arquivo: File): Promise<File> {
  const imagem = await createImageBitmap(arquivo);
  const lado = Math.min(imagem.width, imagem.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LADO_FOTO;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  imagem.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  if (!blob) throw new Error("Falha ao preparar a foto");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}

type Props = { foto: File | null; aoMudar: (foto: File | null) => void; erro?: string };

/** Escolha da foto de perfil com prévia redonda. A foto preparada fica no estado de quem usa. */
export function CampoFoto({ foto, aoMudar, erro }: Props) {
  const id = useId();
  const [previa, setPrevia] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  // Libera a prévia anterior ao trocar e ao sair da tela.
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);

  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setFalha(null);
    try {
      const pronta = await prepararFoto(arquivo);
      setPrevia(URL.createObjectURL(pronta));
      aoMudar(pronta);
    } catch {
      setFalha("Não consegui abrir esta imagem. Use uma foto em JPG ou PNG.");
    }
  }

  const mensagem = falha ?? erro;
  return (
    <div className="flex items-center gap-4">
      <div className="bg-muted flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:), não passa pelo otimizador
          <img src={previa} alt="Prévia da sua foto" className="size-full object-cover" />
        ) : (
          <UserRoundIcon className="text-muted-foreground size-9" aria-hidden />
        )}
      </div>
      <div className="grid gap-1">
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={escolher} />
        <Button type="button" variant="outline" size="sm" className="justify-self-start" asChild>
          <label htmlFor={id} className="cursor-pointer">
            <CameraIcon /> {foto ? "Trocar foto" : "Adicionar foto"}
          </label>
        </Button>
        <p className={mensagem ? "text-destructive text-sm" : "text-muted-foreground text-sm"} role={mensagem ? "alert" : undefined}>
          {mensagem ?? "Obrigatória. Uma foto do rosto, de frente."}
        </p>
      </div>
    </div>
  );
}
