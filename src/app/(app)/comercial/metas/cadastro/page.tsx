import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatarReais } from "@/lib/dinheiro";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoCopiarMetas, MetasMes } from "@/modulos/comercial/componentes/metas-mes";
import { esquemaMes } from "@/modulos/comercial/esquemas/meta";
import { mesAnterior, mesSeguinte, rotuloMes, totaisMetas } from "@/modulos/comercial/regras/meta";
import { obterMetasDoMes } from "@/modulos/comercial/servicos/metas";

export const metadata: Metadata = { title: "Cadastrar metas — IPEMaster OS" };

const botaoMes = "hover:bg-muted rounded-md border p-1.5";

/** Cadastro das metas do mês (produto × vendedor). A visão com gráficos fica em /comercial/metas. */
export default async function PaginaCadastroMetas({ searchParams }: PageProps<"/comercial/metas/cadastro">) {
  const usuario = await exigirPermissaoPagina("comercial:gerenciar_metas");
  const { mes: mesUrl } = await searchParams;
  const mes = esquemaMes(new Date()).parse(typeof mesUrl === "string" ? mesUrl : undefined);
  const dados = await obterMetasDoMes(usuario, mes);
  const geral = totaisMetas(dados.metas).geral;

  return (
    <div className="grid gap-6">
      <Link href={`/comercial/metas?mes=${mes}`} className="text-muted-foreground flex w-fit items-center gap-1 text-sm hover:underline">
        <ChevronLeftIcon className="size-4" /> Voltar para a visão das metas
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/comercial/metas/cadastro?mes=${mesAnterior(mes)}`} className={botaoMes} aria-label="Mês anterior">
            <ChevronLeftIcon className="size-4" />
          </Link>
          <h2 className="min-w-44 text-center text-lg font-semibold first-letter:uppercase">{rotuloMes(mes)}</h2>
          <Link href={`/comercial/metas/cadastro?mes=${mesSeguinte(mes)}`} className={botaoMes} aria-label="Mês seguinte">
            <ChevronRightIcon className="size-4" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            {dados.podeEditar ? "Meta do mês" : "Sua meta no mês"}: <strong>{formatarReais(geral.valor)}</strong> ·{" "}
            <strong>{geral.quantidade}</strong> {geral.quantidade === 1 ? "venda" : "vendas"}
          </span>
          {dados.podeEditar && <BotaoCopiarMetas mes={mes} origem={rotuloMes(mesAnterior(mes))} />}
        </div>
      </div>
      <MetasMes dados={dados} />
    </div>
  );
}
