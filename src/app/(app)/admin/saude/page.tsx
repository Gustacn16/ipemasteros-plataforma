import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { saudeWhatsapp } from "@/modulos/whatsapp/servicos/saude";

export const metadata: Metadata = { title: "Saúde do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

export default async function PaginaSaude() {
  await exigirPermissaoPagina("whatsapp:gerenciar_numeros");
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
                  <TableHead>Mensagens nas últimas 24 h</TableHead>
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
        </CardContent>
      </Card>
    </div>
  );
}
