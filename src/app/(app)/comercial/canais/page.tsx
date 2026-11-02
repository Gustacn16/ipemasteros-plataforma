import type { Metadata } from "next";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { CanaisVenda } from "@/modulos/comercial/componentes/canais-venda";
import { listarCanais } from "@/modulos/comercial/servicos/canais";

export const metadata: Metadata = { title: "Canais de venda — IPEMaster OS" };

export default async function PaginaCanais() {
  await exigirPermissaoPagina("comercial:gerenciar_produtos");
  const canais = await listarCanais();
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-lg font-semibold">Canais de venda</h2>
        <p className="text-muted-foreground text-sm">Por onde a venda chegou. Canais desativados não aparecem ao registrar uma venda.</p>
      </div>
      <CanaisVenda canais={canais} />
    </section>
  );
}
