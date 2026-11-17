import { CoinsIcon, MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { CartaoNumero } from "@/componentes/cartao-numero";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { iaConfigurada } from "@/lib/ia/cliente";
import { obterConfiguracaoIa } from "@/lib/ia/configuracao";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { FormularioConfiguracao } from "@/modulos/nexu/componentes/tela-configuracao";
import { obterPainelUso } from "@/modulos/nexu/servicos/configuracao";

export const metadata: Metadata = { title: "Nexu — IPEMaster OS" };

const usd = (micro: number) => `US$ ${(micro / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dia = (d: string) => d.split("-").reverse().join("/");

export default async function PaginaNexu() {
  const ator = await exigirPermissaoPagina("nexu:configurar");
  const [config, painel] = await Promise.all([obterConfiguracaoIa(), obterPainelUso(ator)]);
  const percentual =
    painel.limiteMensalMicroUsd > 0 ? Math.min(100, Math.round((painel.gastoMesMicroUsd / painel.limiteMensalMicroUsd) * 100)) : 0;

  return (
    <div className="grid max-w-5xl gap-6">
      <CabecalhoPagina
        titulo="Nexu"
        descricao="Configuração e uso do assistente de IA neste mês. Você vê só números, nunca as conversas."
      />

      {!iaConfigurada() && (
        <Alert variant="destructive">
          <AlertDescription>Nexu ainda não configurado: falta a chave ANTHROPIC_API_KEY no hPanel.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <CartaoNumero
          rotulo="Gasto no mês"
          icone={CoinsIcon}
          valor={usd(painel.gastoMesMicroUsd)}
          tom={percentual >= 90 ? "perigo" : "neutro"}
        >
          <div className="grid gap-1.5">
            <div
              role="progressbar"
              aria-label="Gasto do mês em relação ao limite"
              aria-valuenow={percentual}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <div className="bg-primary h-full" style={{ width: `${percentual}%` }} />
            </div>
            <span>
              {percentual}% do limite de {usd(painel.limiteMensalMicroUsd)}
            </span>
          </div>
        </CartaoNumero>
        <CartaoNumero rotulo="Perguntas no mês" icone={MessageSquareIcon} valor={painel.perguntasMes.toLocaleString("pt-BR")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por pessoa</CardTitle>
            <CardDescription>Mês atual</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="text-right">Perguntas</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.porPessoa.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground text-center">
                      Nenhum uso neste mês.
                    </TableCell>
                  </TableRow>
                )}
                {painel.porPessoa.map((p) => (
                  <TableRow key={p.usuarioId || "sem-usuario"}>
                    <TableCell>{p.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.perguntas}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(p.gastoMicroUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por dia</CardTitle>
            <CardDescription>Mês atual</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {painel.porDia.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground text-center">
                      Nenhum uso neste mês.
                    </TableCell>
                  </TableRow>
                )}
                {painel.porDia.map((d) => (
                  <TableRow key={d.dia}>
                    <TableCell>{dia(d.dia)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(d.gastoMicroUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
          <CardDescription>Vale para todas as pessoas.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioConfiguracao
            modelo={config.modelo}
            limiteMensalUsd={(config.limiteMensalMicroUsd / 1_000_000).toFixed(2)}
            perguntasPorDia={config.perguntasPorDia}
          />
        </CardContent>
      </Card>
    </div>
  );
}
