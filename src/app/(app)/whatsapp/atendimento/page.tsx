import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { GraficoAtendimento } from "@/modulos/whatsapp/componentes/grafico-atendimento";
import { RegrasAtendimentoForm } from "@/modulos/whatsapp/componentes/regras-atendimento";
import { ListaSemResposta, TabelaAtendimento, TextoRegras } from "@/modulos/whatsapp/componentes/tabela-atendimento";
import { semanaDaConsulta, ultimasSemanas } from "@/modulos/whatsapp/regras/dia";
import { obterRegrasAtendimento } from "@/modulos/whatsapp/servicos/configuracao";
import { evolucaoDoNumero, resumoDaSemana, semRespostaAgora } from "@/modulos/whatsapp/servicos/painel-atendimento";

export const metadata: Metadata = { title: "Atendimento do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

const SEMANAS_NO_GRAFICO = 8;

export default async function PaginaAtendimento({ searchParams }: { searchParams: Promise<{ semana?: string; numero?: string }> }) {
  const usuario = await exigirPermissaoPagina("whatsapp:ver_equipe");
  const { semana: valorSemana, numero: valorNumero } = await searchParams;
  const agora = new Date();
  const semana = semanaDaConsulta(valorSemana, agora);
  const atual = semanaDaConsulta(undefined, agora);

  const aoVivo = await semRespostaAgora(usuario, agora);
  const [linhas, regras] = await Promise.all([resumoDaSemana(usuario, semana, { agora, semResposta: aoVivo }), obterRegrasAtendimento()]);
  const selecionado = linhas.find((l) => l.numeroId === valorNumero) ?? null;
  const evolucao = selecionado ? await evolucaoDoNumero(usuario, selecionado.numeroId, ultimasSemanas(agora, SEMANAS_NO_GRAFICO)) : [];
  const itens = selecionado ? aoVivo.filter((i) => i.numeroId === selecionado.numeroId) : aoVivo;

  const comNumero = (s: string) => `/whatsapp/atendimento?semana=${s}${selecionado ? `&numero=${selecionado.numeroId}` : ""}`;
  const anterior = somarDias(semana.texto, -7);
  const proxima = semana.texto < atual.texto ? somarDias(semana.texto, 7) : null;

  return (
    <div className="grid max-w-6xl gap-6">
      <CabecalhoPagina
        titulo="Atendimento do WhatsApp"
        descricao="Tempo de resposta, prazo e follow-up de cada número, nas conversas com leads e alunos."
      />
      <AbasWhatsapp papel={usuario.papel} ativa="atendimento" />

      <Card>
        <CardHeader>
          <CardTitle>Semana de {semana.rotulo}</CardTitle>
          <CardDescription>Tempos contados só dentro do horário de atendimento. &quot;Sem resposta agora&quot; é a situação deste momento.</CardDescription>
          <nav aria-label="Escolher semana" className="flex flex-wrap gap-3 text-sm">
            <Link href={comNumero(anterior)} className="underline-offset-4 hover:underline">
              ← Semana anterior
            </Link>
            {proxima && (
              <Link href={comNumero(proxima)} className="underline-offset-4 hover:underline">
                Próxima semana →
              </Link>
            )}
            {semana.texto !== atual.texto && (
              <Link href={comNumero(atual.texto)} className="underline-offset-4 hover:underline">
                Semana atual
              </Link>
            )}
          </nav>
        </CardHeader>
        <CardContent>
          <TabelaAtendimento linhas={linhas} semana={semana.texto} numeroSelecionado={selecionado?.numeroId ?? null} />
        </CardContent>
      </Card>

      {selecionado && (
        <Card>
          <CardHeader>
            <CardTitle>{selecionado.nome}: últimas {SEMANAS_NO_GRAFICO} semanas</CardTitle>
            <CardDescription>
              <Link href={`/whatsapp/atendimento?semana=${semana.texto}`} className="underline-offset-4 hover:underline">
                Ver todos os números
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GraficoAtendimento dados={evolucao} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sem resposta agora{selecionado ? ` — ${selecionado.nome}` : ""}</CardTitle>
          <CardDescription>Conversas em que o cliente espera além do prazo de resposta, da maior espera para a menor.</CardDescription>
        </CardHeader>
        <CardContent>
          <ListaSemResposta itens={itens} mostrarNumero={!selecionado} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regras do atendimento</CardTitle>
          {usuario.papel !== "admin" && <CardDescription>Só o admin altera estas regras.</CardDescription>}
        </CardHeader>
        <CardContent>{usuario.papel === "admin" ? <RegrasAtendimentoForm regras={regras} /> : <TextoRegras regras={regras} />}</CardContent>
      </Card>
    </div>
  );
}
