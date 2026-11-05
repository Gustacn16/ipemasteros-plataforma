import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/componentes/ui/button";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { VisaoDasMetas } from "@/modulos/comercial/componentes/metas/visao-metas";
import { esquemaMes } from "@/modulos/comercial/esquemas/meta";
import { mesAnterior, mesSeguinte, rotuloMes } from "@/modulos/comercial/regras/meta";
import { obterVisaoMetas } from "@/modulos/comercial/servicos/metas";

export const metadata: Metadata = { title: "Metas — IPEMaster OS" };

const botaoMes = "hover:bg-muted rounded-md border p-1.5";

/** Visão das metas do mês. O cadastro fica em /comercial/metas/cadastro. */
export default async function PaginaMetas({ searchParams }: PageProps<"/comercial/metas">) {
  const usuario = await exigirPermissaoPagina("comercial:ver");
  const { mes: mesUrl } = await searchParams;
  const mes = esquemaMes(new Date()).parse(typeof mesUrl === "string" ? mesUrl : undefined);
  const dados = await obterVisaoMetas(usuario, mes);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/comercial/metas?mes=${mesAnterior(mes)}`} className={botaoMes} aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <h2 className="min-w-44 text-center text-lg font-semibold first-letter:uppercase">{rotuloMes(mes)}</h2>
          <Link href={`/comercial/metas?mes=${mesSeguinte(mes)}`} className={botaoMes} aria-label="Mês seguinte">
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
        {dados.podeEditar && (
          <Button asChild variant="outline">
            <Link href={`/comercial/metas/cadastro?mes=${mes}`}>
              <PencilIcon /> Cadastrar metas
            </Link>
          </Button>
        )}
      </div>
      <VisaoDasMetas dados={dados} />
    </div>
  );
}
