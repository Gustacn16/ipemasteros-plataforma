import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Comissoes } from "@/modulos/comercial/componentes/comissoes";
import { esquemaMes } from "@/modulos/comercial/esquemas/meta";
import { mesAnterior, mesSeguinte, rotuloMes } from "@/modulos/comercial/regras/meta";
import { obterComissoes } from "@/modulos/comercial/servicos/comissoes";

export const metadata: Metadata = { title: "Comissões — IPEMaster OS" };

const botaoMes = "hover:bg-muted rounded-md border p-1.5";

/** Comissões do mês, calculadas a partir das vendas registradas e das metas. */
export default async function PaginaComissoes({ searchParams }: PageProps<"/comercial/comissoes">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const { mes: mesUrl } = await searchParams;
  const mes = esquemaMes(new Date()).parse(typeof mesUrl === "string" ? mesUrl : undefined);
  const dados = await obterComissoes(usuario, mes);

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-2">
        <Link href={`/comercial/comissoes?mes=${mesAnterior(mes)}`} className={botaoMes} aria-label="Mês anterior">
          <ChevronLeftIcon className="size-4" />
        </Link>
        <h2 className="min-w-44 text-center text-lg font-semibold first-letter:uppercase">{rotuloMes(mes)}</h2>
        <Link href={`/comercial/comissoes?mes=${mesSeguinte(mes)}`} className={botaoMes} aria-label="Mês seguinte">
          <ChevronRightIcon className="size-4" />
        </Link>
      </div>
      <Comissoes dados={dados} />
    </div>
  );
}
