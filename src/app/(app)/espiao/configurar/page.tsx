import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Badge } from "@/componentes/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { BotaoColetarAgora, CartaoConcorrente, FormularioConcorrente, FormularioTeto } from "@/modulos/espiao/componentes/tela-configuracao";
import { TestarPerfil } from "@/modulos/espiao/componentes/testar-perfil";
import { situacaoConfiguracao } from "@/modulos/espiao/servicos/concorrentes";

export const metadata: Metadata = { title: "Configurar espião — IPEMaster OS" };

const usd = (micro: number) => `US$ ${(micro / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quando = (d: Date | null) => (d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—");
const STATUS = { rodando: "rodando", concluida: "concluída", parcial: "parcial", falhou: "falhou", sem_saldo: "sem saldo" } as const;

function Chave({ ok, rotulo, detalhe }: { ok: boolean; rotulo: string; detalhe: string }) {
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant={ok ? "default" : "destructive"}>{ok ? "ok" : "falta"}</Badge>
      <strong>{rotulo}</strong>
      <span className="text-muted-foreground">{detalhe}</span>
    </li>
  );
}

export default async function PaginaConfigurarEspiao() {
  const ator = await exigirPermissaoPagina("espiao:configurar");
  const s = await situacaoConfiguracao(ator);
  const pct = Math.min(100, Math.round((s.gastoMesMicroUsd / Math.max(1, s.tetoMicroUsd)) * 100));
  const ativos = s.concorrentes.filter((c) => c.ativo).length;
  return (
    <div className="grid gap-6">
      <CabecalhoPagina titulo="Configurar espião" descricao="Concorrentes, páginas acompanhadas, teto de gasto e coletas." />

      <Card>
        <CardHeader>
          <CardTitle>Chaves e conexões</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            <Chave ok={s.chaves.meta} rotulo="Instagram (Meta)" detalhe={s.chaves.contaInstagram ? `lendo como @${s.chaves.contaInstagram}` : "ligue a conta em Conteúdo → Integração Instagram"} />
            <Chave ok={s.chaves.groq} rotulo="Transcrição (Groq)" detalhe={s.chaves.transcricao ? "GROQ_API_KEY na Hostinger" : "desligada (ESPIAO_TRANSCRICAO=desligada)"} />
            <Chave ok={s.chaves.ia} rotulo="Resumos e análise (Claude)" detalhe="ANTHROPIC_API_KEY na Hostinger" />
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gasto do mês</CardTitle>
          <CardDescription>
            {usd(s.gastoMesMicroUsd)} de {usd(s.tetoMicroUsd)} ({pct}%). Soma a transcrição e o Claude usados pelo espião; o Claude também conta no limite geral da IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="h-2 w-full overflow-hidden rounded bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <FormularioTeto tetoUsd={(s.tetoMicroUsd / 1_000_000).toFixed(2).replace(".", ",")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Concorrentes ({ativos}/10 acompanhados)</CardTitle>
          <CardDescription>O espião coleta toda semana os concorrentes marcados como “Acompanhar”.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {s.concorrentes.map((c) => (
            <CartaoConcorrente
              key={c.id}
              concorrente={{ ...c, paginas: c.paginas.map((p) => ({ ...p, ultimaCapturaEm: p.ultimaCapturaEm?.toISOString() ?? null })) }}
            />
          ))}
          <div className="grid gap-2 rounded-lg border border-dashed p-4">
            <p className="font-medium text-sm">Novo concorrente</p>
            <FormularioConcorrente />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coletas</CardTitle>
          <CardDescription>A coleta automática roda uma vez por semana. “Coletar agora” roda em segundo plano.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="max-w-xs">
            <BotaoColetarAgora />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Erros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {s.coletas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{quando(c.iniciadaEm)}</TableCell>
                  <TableCell>{quando(c.finalizadaEm)}</TableCell>
                  <TableCell>{c.origem === "manual" ? "manual" : "automática"}</TableCell>
                  <TableCell>{STATUS[c.status]}</TableCell>
                  <TableCell className="text-right">{c.erros}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testar perfil</CardTitle>
          <CardDescription>Mostra o que a Meta devolve de um perfil profissional do Instagram, sem guardar nada.</CardDescription>
        </CardHeader>
        <CardContent>
          <TestarPerfil />
        </CardContent>
      </Card>
    </div>
  );
}
