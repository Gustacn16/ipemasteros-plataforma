import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ProvedorTema } from "@/componentes/provedor-tema";
import { Toaster } from "@/componentes/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IPEMaster OS",
  description: "Sistema interno da IPEMaster",
  robots: { index: false, follow: false },
  // Aberto pelo ícone da tela de início do iPhone: sem a barra do Safari e com
  // a barra de status preta (combina com o menu, #111416).
  appleWebApp: { capable: true, title: "IPEMaster", statusBarStyle: "black" },
  icons: { apple: "/app/icone-180.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#111416",
  // Ocupa a tela toda (inclusive atrás da barra de gestos); as margens seguras ficam no CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ProvedorTema>
          {children}
          <Toaster position="top-right" />
        </ProvedorTema>
      </body>
    </html>
  );
}
