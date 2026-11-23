"use client";

import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/componentes/ui/card";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarAvisoVendaAcao, testarAvisoVendaAcao } from "../acoes/aviso-venda";
import type { SituacaoAvisoVenda } from "../servicos/aviso-venda";

/** Configuração do aviso de venda nova no grupo do C.S (webhook do Make). */
export function AvisoVenda({ situacao: s }: { situacao: SituacaoAvisoVenda }) {
  const [url, setUrl] = useState("");
  const [ativo, setAtivo] = useState(s.ativo);
  const [salvando, salvar] = useTransition();
  const [testando, testar] = useTransition();
  const ligado = s.configurado && s.ativo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aviso de venda no grupo do C.S</CardTitle>
        <CardDescription>
          Toda venda nova registrada no sistema (pela tela ou pelo Nexu) é enviada ao Make, que manda a mensagem no grupo. Editar ou
          importar vendas não gera aviso.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 text-sm">
        <p>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              ligado ? "bg-green-100 text-green-800" : s.configurado ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700",
            )}
          >
            {ligado ? "Ligado" : s.configurado ? "Desligado" : "Sem link"}
          </span>
          {s.mascarado && <span className="text-muted-foreground ml-2">Link salvo: {s.mascarado}</span>}
        </p>

        <div className="grid max-w-xl gap-1.5">
          <Label htmlFor="url-webhook">{s.configurado ? "Trocar o link do webhook" : "Link do webhook do Make"}</Label>
          <Input
            id="url-webhook"
            type="url"
            autoComplete="off"
            placeholder="https://hook.us2.make.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">O link fica guardado cifrado; depois de salvo, só o final dele aparece aqui.</p>
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="size-4" />
          Enviar aviso a cada venda nova
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={salvando}
            onClick={() =>
              salvar(async () => {
                const r = await salvarAvisoVendaAcao({ url: url.trim() || null, ativo });
                avisar(r);
                if (r.ok) setUrl("");
              })
            }
          >
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={testando || !s.configurado}
            onClick={() =>
              testar(async () => {
                avisar(await testarAvisoVendaAcao());
              })
            }
          >
            {testando ? "Enviando…" : "Enviar teste"}
          </Button>
        </div>

        <details className="text-muted-foreground">
          <summary className="cursor-pointer">O que é enviado</summary>
          <p className="mt-2">
            Um POST com <code>{'{ "value": "<JSON em texto>" }'}</code>. O JSON tem os campos Tipo, Curso, Canal, Data de primeiro contato,
            Data da venda, Vendedor, Valor, Forma de pagamento, Nome, Wpp, Iniciará em, Observações, Entrada, Mensalidades e Próximas ações,
            e o campo Mensagem com o texto pronto para o grupo.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
