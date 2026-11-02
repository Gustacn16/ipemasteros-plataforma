import { exigirPermissaoPagina } from "@/lib/sessao";

/** Área do módulo Agenda. */
export default async function LayoutAgenda({ children }: { children: React.ReactNode }) {
  await exigirPermissaoPagina("agenda:usar");
  return children;
}
