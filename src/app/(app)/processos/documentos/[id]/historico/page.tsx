import { ArrowLeftIcon, HistoryIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { formatarDataHoraCurta } from "@/modulos/processos/componentes/datas";
import { listarVersoes } from "@/modulos/processos/servicos/documentos";

export const metadata: Metadata = { title: "Histórico — IPEMaster OS" };

export default async function PaginaHistorico({ params }: PageProps<"/processos/documentos/[id]/historico">) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const { id } = await params;
  let dados;
  try {
    dados = await listarVersoes(usuario, id);
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href={`/processos/documentos/${id}`}>
            <ArrowLeftIcon /> Voltar ao documento
          </Link>
        </Button>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Histórico: {dados.titulo}</h1>
        <p className="text-muted-foreground text-sm">Cada publicação guarda uma versão completa do documento.</p>
      </div>
      {dados.versoes.length === 0 ? (
        <EstadoVazio icone={HistoryIcon} titulo="Ainda sem versões" descricao="A primeira aparece quando o documento for publicado." />
      ) : (
        <ol className="relative grid gap-3 border-l pl-6">
          {dados.versoes.map((v) => (
            <li key={v.numero} className="relative">
              <span aria-hidden className="bg-primary ring-background absolute top-4 -left-[1.95rem] size-3 rounded-full ring-4" />
              <Link href={`/processos/documentos/${id}/historico/${v.numero}`} className="bg-card hover:border-primary/50 grid gap-1 rounded-xl border p-4 transition-colors">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Versão {v.numero}</span>
                  {v.numero === dados.versaoPublicada && (
                    <ChipSituacao tom="sucesso" tamanho="sm">
                      Atual
                    </ChipSituacao>
                  )}
                </span>
                <span className="text-sm">“{v.nota}”</span>
                <span className="text-muted-foreground text-xs">
                  {v.publicadoPor.nome} · {formatarDataHoraCurta(v.criadoEm)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
