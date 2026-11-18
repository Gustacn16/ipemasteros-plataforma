import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { LimiteIa } from "@/modulos/whatsapp/componentes/limite-ia";
import { formatarMicroUsd } from "@/modulos/whatsapp/regras/dinheiro";
import { saudeWhatsapp } from "@/modulos/whatsapp/servicos/saude";

export const metadata: Metadata = { title: "Saúde do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

export default async function PaginaSaude() {
  const usuario = await exigirPermissaoPagina("whatsapp:gerenciar_numeros");
  const saude = await saudeWhatsapp();
  const data = (d: Date | null) => (d ? formatarDataHora(d) : "—");

  return (
    <div className="grid max-w-5xl gap-6">
      <CabecalhoPagina titulo="Saúde do WhatsApp" descricao="Veja se o motor está respondendo e quantas mensagens cada número capturou." />

      <Card>
        <CardHeader>
          <CardTitle>Motor do WhatsApp</CardTitle>
          <CardDescription>
            {saude.motorVivo
              ? "Ligado"
              : saude.ultimoSinalEm
                ? `Sem resposta desde ${formatarDataHora(saude.ultimoSinalEm)}`
                : "Sem resposta: nenhum sinal recebido ainda"}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IA do WhatsApp</CardTitle>
          <CardDescription>
            {saude.ia.configurada
              ? `Gasto do mês: ${formatarMicroUsd(saude.ia.gastoMesMicroUsd)} de ${formatarMicroUsd(saude.ia.limiteMensalMicroUsd)}`
              : "IA não configurada: falta ANTHROPIC_API_KEY."}
          </CardDescription>
        </CardHeader>
        {usuario.papel === "admin" && (
          <CardContent>
            <LimiteIa limiteUsd={saude.ia.limiteMensalMicroUsd / 1_000_000} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="pt-6">
          {saude.numeros.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum número cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último sinal</TableHead>
                  <TableHead>Capturadas nas últimas 24 h</TableHead>
                  <TableHead>Última mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saude.numeros.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.nome}</TableCell>
                    <TableCell>{n.estado}</TableCell>
                    <TableCell>{data(n.ultimoSinalEm)}</TableCell>
                    <TableCell>{n.mensagens24h}</TableCell>
                    <TableCell>{data(n.ultimaMensagemEm)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {saude.numeros.length > 0 && (
            <p className="text-muted-foreground mt-3 text-xs">Conta pelo número que guardou a mensagem primeiro.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
