import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { temPermissao } from "@/lib/permissoes";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { Analise } from "@/modulos/espiao/componentes/analise";
import { ListaSinais } from "@/modulos/espiao/componentes/lista-sinais";
import { dataHora } from "@/modulos/espiao/componentes/rotulos";
import { TabelaIndicadores } from "@/modulos/espiao/componentes/tabela-indicadores";
import { marcarEspiaoVisto, visaoSemana } from "@/modulos/espiao/servicos/visao";

export const metadata: Metadata = { title: "Espião — IPEMaster OS" };

const STATUS = { rodando: "em andamento", concluida: "concluída", parcial: "parcial (algum concorrente falhou)", falhou: "falhou", sem_saldo: "parada: teto de gasto" } as const;
const dia = (d: string) => d.split("-").reverse().join("/");

export default async function PaginaEspiao({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirPermissaoPagina("espiao:ver");
  const { semana } = await searchParams;
  const v = await visaoSemana(usuario, semana);
  await marcarEspiaoVisto(usuario.id);
  const coleta = v.ultimaColeta;
  return (
    <div className="grid gap-6">
      <CabecalhoPagina
        titulo="Espião"
        descricao={
          coleta
            ? `Semana de ${dia(v.semana)} · coleta ${STATUS[coleta.status]} em ${dataHora(coleta.finalizadaEm ?? coleta.iniciadaEm)}`
            : "Ainda não houve coleta. Cadastre os concorrentes em Configurar."
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {v.semanasDisponiveis.length > 1 && (
          <nav aria-label="Semanas" className="flex flex-wrap gap-2">
            {v.semanasDisponiveis.slice(0, 8).map((s) => (
              <Link key={s} href={`/espiao?semana=${s}`} aria-current={s === v.semana ? "page" : undefined} className={s === v.semana ? "font-semibold underline" : "text-muted-foreground hover:underline"}>
                {dia(s)}
              </Link>
            ))}
          </nav>
        )}
        {temPermissao(usuario.papel, "espiao:configurar") && (
          <Link href="/espiao/configurar" className="ml-auto underline">
            Configurar
          </Link>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>🎯 Sinais ({v.sinais.length})</CardTitle>
          <CardDescription>O que mudou nos concorrentes nesta semana, com o link de onde veio.</CardDescription>
        </CardHeader>
        <CardContent>
          <ListaSinais sinais={v.sinais} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Indicadores</CardTitle>
          <CardDescription>Engajamento = curtidas + comentários sobre seguidores, média dos últimos 30 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          <TabelaIndicadores indicadores={v.indicadores} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Análise da IA</CardTitle>
          <CardDescription>Escrita a partir dos sinais e indicadores. Confira os links antes de decidir.</CardDescription>
        </CardHeader>
        <CardContent>
          <Analise texto={v.analise} />
        </CardContent>
      </Card>
    </div>
  );
}
