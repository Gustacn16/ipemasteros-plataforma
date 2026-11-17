import type { MetadataRoute } from "next";

/** Manifesto do aplicativo: permite "Adicionar à Tela de Início" e abrir sem a barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IPEMaster OS",
    short_name: "IPEMaster",
    description: "Sistema interno da IPEMaster",
    lang: "pt-BR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111416",
    theme_color: "#111416",
    icons: [
      { src: "/app/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
