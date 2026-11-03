"use client";

import { ThemeProvider } from "next-themes";

/** Tema claro/escuro por classe `.dark` no <html>; segue o aparelho até o usuário escolher. */
export function ProvedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
