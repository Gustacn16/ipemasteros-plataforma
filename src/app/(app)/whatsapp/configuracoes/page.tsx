import type { Metadata } from "next";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { exigirPermissaoPagina } from "@/lib/sessao";
import { AbasWhatsapp } from "@/modulos/whatsapp/componentes/abas-whatsapp";
import { LimiteIa } from "@/modulos/whatsapp/componentes/limite-ia";
import { RegrasAtendimentoForm } from "@/modulos/whatsapp/componentes/regras-atendimento";
import { TextoRegras } from "@/modulos/whatsapp/componentes/tabela-atendimento";
import { formatarMicroUsd } from "@/modulos/whatsapp/regras/dinheiro";
import { obterRegrasAtendimento } from "@/modulos/whatsapp/servicos/configuracao";
import { saudeWhatsapp } from "@/modulos/whatsapp/servicos/saude";

export const metadata: Metadata = { title: "Ajustes do WhatsApp — IPEMaster OS" };
export const dynamic = "force-dynamic";

export default async function PaginaConfiguracoes() {
  const usuario = await exigirPermissaoPagina("whatsapp:gerenciar_numeros");
  const [regras, saude] = await Promise.all([obterRegrasAtendimento(), saudeWhatsapp()]);

  return (
    <div className="grid max-w-5xl gap-6">
      <CabecalhoPagina titulo="Ajustes do WhatsApp" descricao="Regras do atendimento e limite de gasto da IA." />
      <AbasWhatsapp papel={usuario.papel} ativa="configuracoes" />

      <Card>
        <CardHeader>
          <CardTitle>Regras de atendimento</CardTitle>
          {usuario.papel !== "admin" && <CardDescription>Só o admin altera estas regras.</CardDescription>}
        </CardHeader>
        <CardContent>{usuario.papel === "admin" ? <RegrasAtendimentoForm regras={regras} /> : <TextoRegras regras={regras} />}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso de IA do WhatsApp</CardTitle>
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
    </div>
  );
}
