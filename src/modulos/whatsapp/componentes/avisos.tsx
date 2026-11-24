import { MegaphoneIcon } from "lucide-react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Badge } from "@/componentes/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/componentes/ui/card";
import { formatarDataHora } from "@/lib/datas";
import { avisoEditavel, paraCampoDataHora, ROTULO_SITUACAO_AVISO, rotuloEnvio } from "../regras/aviso-tela";
import type { AvisoNaTela } from "../servicos/avisos";
import { FormAviso, type GrupoOpcao } from "./form-aviso";

function variante(s: AvisoNaTela["situacao"]) {
  if (s === "falhou") return "destructive" as const;
  if (s === "aprovado" || s === "concluido") return "default" as const;
  if (s === "cancelado") return "outline" as const;
  return "secondary" as const;
}

/** Cartões dos avisos da semana. Só o formulário (dentro de cada cartão editável) roda no cliente. */
export function ListaAvisos({ avisos, grupos }: { avisos: AvisoNaTela[]; grupos: GrupoOpcao[] }) {
  if (avisos.length === 0) {
    return <EstadoVazio icone={MegaphoneIcon} titulo="Nenhum aviso nesta semana" descricao='Use "Novo aviso" ou espere os avisos da agenda aparecerem como rascunho.' />;
  }
  return (
    <div className="grid gap-4">
      {avisos.map((a) => (
        <Card key={a.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{a.evento?.titulo ?? "Aviso avulso"}</CardTitle>
              <Badge variant={variante(a.situacao)}>{ROTULO_SITUACAO_AVISO[a.situacao]}</Badge>
              {a.textoPorIa && <Badge variant="outline">Escrito pela IA</Badge>}
              <span className="text-muted-foreground text-sm">{formatarDataHora(a.agendadoPara)}</span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {a.alerta && (
              <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                {a.alerta}
              </p>
            )}
            {avisoEditavel(a.situacao) ? (
              <FormAviso
                aviso={{
                  id: a.id,
                  texto: a.texto,
                  agendadoPara: paraCampoDataHora(a.agendadoPara),
                  grupos: a.grupos.map((g) => g.conversaId),
                  situacao: a.situacao === "aprovado" ? "aprovado" : "rascunho",
                }}
                grupos={grupos}
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{a.texto}</p>
            )}
            {!(a.situacao === "rascunho" || a.situacao === "aprovado") && a.grupos.length > 0 && (
              <ul className="grid gap-1 text-sm">
                {a.grupos.map((g) => (
                  <li key={g.conversaId} className={g.situacao === "falhou" ? "text-red-700" : undefined}>
                    {g.nome}: {rotuloEnvio(g.situacao, g.erro)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
