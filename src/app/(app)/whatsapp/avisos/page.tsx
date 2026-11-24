import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { ListaAvisos } from "@/modulos/whatsapp/componentes/avisos";
import { AprovarTodos, NovoAviso } from "@/modulos/whatsapp/componentes/form-aviso";
import { paraCampoDataHora } from "@/modulos/whatsapp/regras/aviso-tela";
import { semanaDaConsulta } from "@/modulos/whatsapp/regras/dia";
import { listarAvisos, listarGruposParaAviso } from "@/modulos/whatsapp/servicos/avisos";

export const metadata: Metadata = { title: "Avisos nos grupos — IPEMaster OS" };
export const dynamic = "force-dynamic";

export default async function PaginaAvisos({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const usuario = await exigirPermissaoPagina("whatsapp:avisos");
  const { semana: valorSemana } = await searchParams;
  const agora = new Date();
  const semana = semanaDaConsulta(valorSemana, agora);
  const atual = semanaDaConsulta(undefined, agora);
  const de = semana.inicio;
  const ate = new Date(semana.fim.getTime() - 1);

  const [avisos, grupos] = await Promise.all([listarAvisos(usuario, de, ate), listarGruposParaAviso(usuario)]);
  const rascunhos = avisos.filter((a) => a.situacao === "rascunho");
  const titulos = Object.fromEntries(avisos.map((a) => [a.id, a.evento?.titulo ?? "Aviso avulso"]));
  // Sugestão para um aviso novo: amanhã às 09:00 de São Paulo.
  const amanha = new Date(`${somarDias(paraCampoDataHora(agora).slice(0, 10), 1)}T09:00:00-03:00`);

  const anterior = somarDias(semana.texto, -7);
  const proxima = semana.texto < atual.texto ? somarDias(semana.texto, 7) : null;

  return (
    <div className="grid max-w-5xl gap-6">
      <CabecalhoPagina titulo="Avisos nos grupos" descricao="Revise, aprove e acompanhe os avisos enviados aos grupos de WhatsApp." />
      <AbasWhatsapp papel={usuario.papel} ativa="avisos" />

      <Card>
        <CardHeader>
          <CardTitle>Semana de {semana.rotulo}</CardTitle>
          <CardDescription>
            Os avisos só saem depois de aprovados, entre 8h e 20h. Editar um aviso aprovado o devolve a rascunho.
          </CardDescription>
          <nav aria-label="Escolher semana" className="flex flex-wrap gap-3 text-sm">
            <Link href={`/whatsapp/avisos?semana=${anterior}`} className="underline-offset-4 hover:underline">
              ← Semana anterior
            </Link>
            {proxima && (
              <Link href={`/whatsapp/avisos?semana=${proxima}`} className="underline-offset-4 hover:underline">
                Próxima semana →
              </Link>
            )}
            {semana.texto !== atual.texto && (
              <Link href={`/whatsapp/avisos?semana=${atual.texto}`} className="underline-offset-4 hover:underline">
                Semana atual
              </Link>
            )}
          </nav>
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-start gap-3">
        <NovoAviso grupos={grupos} sugestao={paraCampoDataHora(amanha)} />
        {rascunhos.length > 0 && <AprovarTodos de={de.toISOString()} ate={ate.toISOString()} titulos={titulos} />}
      </div>

      <ListaAvisos avisos={avisos} grupos={grupos} />
    </div>
  );
}
