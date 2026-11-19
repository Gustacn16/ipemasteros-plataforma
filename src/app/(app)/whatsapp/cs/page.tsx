import type { Metadata } from "next";
import Link from "next/link";
import { SmartphoneIcon } from "lucide-react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { GraficoCs } from "@/modulos/whatsapp/componentes/grafico-cs";
import { TabelaCs } from "@/modulos/whatsapp/componentes/tabela-cs";
import { semanaDaConsulta, ultimasSemanas } from "@/modulos/whatsapp/regras/dia";
import { formatarDuracao } from "@/modulos/whatsapp/regras/horario";
import { evolucaoCs, listarVendasCs } from "@/modulos/whatsapp/servicos/cs";

export const metadata: Metadata = { title: "CS do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

const SEMANAS_NO_GRAFICO = 8;

export default async function PaginaCs({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirPermissaoPagina("whatsapp:ver_equipe");
  const { semana: valorSemana } = await searchParams;
  const agora = new Date();
  const semana = semanaDaConsulta(valorSemana, agora);
  const atual = semanaDaConsulta(undefined, agora);

  const [resumo, evolucao] = await Promise.all([
    // Na semana atual entram também as vendas de antes da segunda que ainda aguardam contato.
    listarVendasCs(usuario, semana.inicio, semana.fim, agora, { incluirAguardandoAnteriores: semana.texto === atual.texto }),
    evolucaoCs(usuario, ultimasSemanas(agora, SEMANAS_NO_GRAFICO), agora),
  ]);
  const pontos = evolucao.map((e) => ({
    rotulo: e.rotulo,
    medianaHoras: e.medianaSeg === null ? null : Math.round(e.medianaSeg / 360) / 10,
    vendas: e.vendas,
  }));

  const anterior = somarDias(semana.texto, -7);
  const proxima = semana.texto < atual.texto ? somarDias(semana.texto, 7) : null;

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina
        titulo="CS do WhatsApp"
        descricao={
          resumo.semNumeroCs
            ? "Tempo entre a venda e a primeira mensagem da CS."
            : `Mediana até o primeiro contato: ${formatarDuracao(resumo.medianaSeg)}. Aguardando contato: ${resumo.aguardando}.`
        }
      />
      <AbasWhatsapp papel={usuario.papel} ativa="cs" />

      {resumo.semNumeroCs ? (
        <EstadoVazio
          icone={SmartphoneIcon}
          titulo="Nenhum número de CS"
          descricao="Marque um número como CS na tela Números para medir o primeiro contato."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Semana de {semana.rotulo}</CardTitle>
              <CardDescription>
                Tempo em horas corridas, da venda até a primeira mensagem de um número da CS.
                {semana.texto === atual.texto && " Vendas de antes desta semana que ainda aguardam contato também aparecem no topo."}
              </CardDescription>
              <nav aria-label="Escolher semana" className="flex flex-wrap gap-3 text-sm">
                <Link href={`/whatsapp/cs?semana=${anterior}`} className="underline-offset-4 hover:underline">
                  ← Semana anterior
                </Link>
                {proxima && (
                  <Link href={`/whatsapp/cs?semana=${proxima}`} className="underline-offset-4 hover:underline">
                    Próxima semana →
                  </Link>
                )}
                {semana.texto !== atual.texto && (
                  <Link href={`/whatsapp/cs?semana=${atual.texto}`} className="underline-offset-4 hover:underline">
                    Semana atual
                  </Link>
                )}
              </nav>
            </CardHeader>
            <CardContent>
              <TabelaCs vendas={resumo.vendas} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimas {SEMANAS_NO_GRAFICO} semanas</CardTitle>
              <CardDescription>Mediana do tempo até o primeiro contato, em horas. Semana sem contato fica em branco.</CardDescription>
            </CardHeader>
            <CardContent>
              <GraficoCs dados={pontos} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
