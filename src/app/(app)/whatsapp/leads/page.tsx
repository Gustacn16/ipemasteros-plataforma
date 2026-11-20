import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { somarDias } from "@/modulos/tarefas/regras/prazo";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { ListaLeads } from "@/modulos/whatsapp/componentes/lista-leads";
import { ROTULO_SITUACAO_LEAD, ROTULO_TEMPERATURA } from "@/modulos/whatsapp/regras/avaliacao";
import { diaDaConsulta, janelaDeOntem } from "@/modulos/whatsapp/regras/dia";
import { listarLeads } from "@/modulos/whatsapp/servicos/leads";

export const metadata: Metadata = { title: "Leads do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

type Busca = { dia?: string; temperatura?: string; situacao?: string; numero?: string };

const temperaturas = Object.keys(ROTULO_TEMPERATURA) as (keyof typeof ROTULO_TEMPERATURA)[];
const situacoes = Object.keys(ROTULO_SITUACAO_LEAD) as (keyof typeof ROTULO_SITUACAO_LEAD)[];

export default async function PaginaLeads({ searchParams }: { searchParams: Promise<Busca> }) {
  const usuario = await exigirPermissaoPagina("whatsapp:ver_equipe");
  const busca = await searchParams;
  const agora = new Date();
  const ontem = janelaDeOntem(agora).dia.toISOString().slice(0, 10);
  let { texto, dia } = diaDaConsulta(busca.dia, agora);
  if (texto > ontem) ({ texto, dia } = diaDaConsulta(undefined, agora));

  const temperatura = temperaturas.find((t) => t === busca.temperatura);
  const situacao = situacoes.find((s) => s === busca.situacao);
  const numeroId = busca.numero || undefined;

  const { itens, semVerba, falhas, pendentes } = await listarLeads(usuario, dia, { temperatura, situacao, numeroId });

  const link = (d: string) => {
    const p = new URLSearchParams({ dia: d });
    if (temperatura) p.set("temperatura", temperatura);
    if (situacao) p.set("situacao", situacao);
    if (numeroId) p.set("numero", numeroId);
    return `/whatsapp/leads?${p}`;
  };
  const [a, m, d] = texto.split("-");

  return (
    <div className="grid max-w-4xl gap-6">
      <CabecalhoPagina titulo="Leads do WhatsApp" descricao="Avaliação da IA das conversas de vendas, dos leads mais quentes aos mais frios." />
      <AbasWhatsapp papel={usuario.papel} ativa="leads" />

      {semVerba > 0 && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          {semVerba} {semVerba === 1 ? "conversa ficou sem avaliação porque o limite mensal de IA do WhatsApp foi atingido." : "conversas ficaram sem avaliação porque o limite mensal de IA do WhatsApp foi atingido."}
        </p>
      )}
      {pendentes > 0 && <p role="status" className="text-muted-foreground text-sm">Avaliações de ontem ainda em processamento.</p>}
      {falhas > 0 && (
        <p role="status" className="text-muted-foreground text-sm">
          {falhas} {falhas === 1 ? "avaliação falhou" : "avaliações falharam"} e não aparece{falhas === 1 ? "" : "m"} aqui.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dia {d}/{m}/{a}</CardTitle>
          <CardDescription>Leads avaliados nas conversas dos números de vendas.</CardDescription>
          <nav aria-label="Escolher dia" className="flex flex-wrap gap-3 text-sm">
            <Link href={link(somarDias(texto, -1))} className="underline-offset-4 hover:underline">← Dia anterior</Link>
            {texto < ontem && (
              <Link href={link(somarDias(texto, 1))} className="underline-offset-4 hover:underline">Próximo dia →</Link>
            )}
          </nav>
          <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="dia" value={texto} />
            {numeroId && <input type="hidden" name="numero" value={numeroId} />}
            <label className="grid gap-1">
              Temperatura
              <select name="temperatura" defaultValue={temperatura ?? ""} className="bg-background h-8 rounded-md border px-2">
                <option value="">Todas</option>
                {temperaturas.map((t) => <option key={t} value={t}>{ROTULO_TEMPERATURA[t]}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              Situação
              <select name="situacao" defaultValue={situacao ?? ""} className="bg-background h-8 rounded-md border px-2">
                <option value="">Todas</option>
                {situacoes.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO_LEAD[s]}</option>)}
              </select>
            </label>
            <button type="submit" className="bg-primary text-primary-foreground h-8 rounded-md px-3">Filtrar</button>
          </form>
        </CardHeader>
        <CardContent>
          <ListaLeads itens={itens} />
        </CardContent>
      </Card>
    </div>
  );
}
