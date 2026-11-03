import type { Metadata } from "next";
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
