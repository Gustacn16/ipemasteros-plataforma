import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { ErroNegocio } from "@/lib/erros";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoAcao } from "@/modulos/academico/componentes/campos";
import { restaurarVersaoAcao } from "@/modulos/processos/acoes/processos";
import { formatarDataHoraCurta } from "@/modulos/processos/componentes/datas";
import { FichaProcesso } from "@/modulos/processos/componentes/ficha";
import { Fluxograma } from "@/modulos/processos/componentes/fluxograma";
import { TextoProcesso } from "@/modulos/processos/componentes/texto-processo";
import { podeEditar } from "@/modulos/processos/servicos/acesso";
import { obterVersao } from "@/modulos/processos/servicos/documentos";

export const metadata: Metadata = { title: "Versão — IPEMaster OS" };

export default async function PaginaVersao({ params }: PageProps<"/processos/documentos/[id]/historico/[numero]">) {
  const usuario = await exigirPermissaoPagina("processos:ver");
  const { id, numero } = await params;
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 1) notFound();
  let versao;
  try {
    versao = await obterVersao(usuario, id, n);
  } catch (erro) {
    if (erro instanceof ErroNegocio) notFound();
    throw erro;
  }
  const d = versao.dados;
  return (
    <article className="grid gap-6">
      <div className="grid gap-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href={`/processos/documentos/${id}/historico`}>
            <ArrowLeftIcon /> Histórico
          </Link>
        </Button>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{d.titulo}</h1>
        {d.resumo && <p className="text-muted-foreground">{d.resumo}</p>}
      </div>
      <Alert>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Versão {versao.numero}
            {versao.atual ? " (atual)" : ""} · {versao.publicadoPor.nome} · {formatarDataHoraCurta(versao.criadoEm)} — “{versao.nota}”
          </span>
          {podeEditar(usuario) && !versao.atual && (
            <BotaoAcao
              acao={restaurarVersaoAcao.bind(null, id, versao.numero)}
              rotulo="Restaurar como rascunho"
              confirmar="Copiar esta versão para o rascunho? O rascunho atual será substituído (as versões publicadas continuam no histórico)."
              irPara={`/processos/documentos/${id}/editar`}
            />
          )}
        </AlertDescription>
      </Alert>
      {d.tipo === "processo" && <FichaProcesso doc={d} />}
      {d.tipo === "processo" && d.fluxo.length > 0 && <Fluxograma etapas={d.fluxo} />}
      {d.conteudo && (
        <div className="bg-card rounded-2xl border p-5 sm:p-8">
          <TextoProcesso texto={d.conteudo} />
        </div>
      )}
    </article>
  );
}
