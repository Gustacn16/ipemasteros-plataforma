"use client";

import { CheckCircle2Icon, ExternalLinkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { registrarPublicacaoAcao, salvarMetricasAcao } from "../acoes/conteudo";
import { ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import { SeloPlataforma } from "./selo-plataforma";

type Publicacao = {
  id: string;
  status: "pendente" | "publicado";
  url: string | null;
  publicadoEm: Date | null;
  alcance: number | null;
  visualizacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  salvamentos: number | null;
  canal: { plataforma: Plataforma; identificador: string | null };
};

const METRICAS = [
  ["alcance", "Alcance"],
  ["visualizacoes", "Visualizações"],
  ["curtidas", "Curtidas"],
  ["comentarios", "Comentários"],
  ["compartilhamentos", "Compartilhamentos"],
  ["salvamentos", "Salvos"],
] as const;

const diaSP = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);

function LinhaPublicacao({ p, liberada }: { p: Publicacao; liberada: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const publicado = p.status === "publicado";

  function registrar(formData: FormData) {
    iniciar(async () => {
      const r = await registrarPublicacaoAcao({
        publicacaoId: p.id,
        publicado: true,
        url: formData.get("url") ?? "",
        data: formData.get("data") ?? "",
      });
      if (r.erros) return void avisar({ ok: false, mensagem: r.erros.url?.[0] ?? "Confira o link e a data." });
      if (avisar(r)) setEditando(false);
    });
  }

  function desmarcar() {
    if (!window.confirm("Desmarcar esta publicação? O conteúdo volta para aprovado.")) return;
    iniciar(async () => void avisar(await registrarPublicacaoAcao({ publicacaoId: p.id, publicado: false, url: p.url ?? "", data: "" })));
  }

  function salvarMetricas(formData: FormData) {
    iniciar(async () => {
      const dados = Object.fromEntries(METRICAS.map(([k]) => [k, formData.get(k) ?? ""]));
      const r = await salvarMetricasAcao({ publicacaoId: p.id, ...dados });
      if (r.erros) return void avisar({ ok: false, mensagem: "Use só números inteiros, sem pontos." });
      avisar(r);
    });
  }

  return (
    <li className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <SeloPlataforma plataforma={p.canal.plataforma} publicado={publicado} />
          {ROTULO_PLATAFORMA[p.canal.plataforma]}
          {p.canal.identificador && <span className="text-muted-foreground font-normal">{p.canal.identificador}</span>}
        </span>
        {publicado ? (
          <span className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2Icon className="size-4" aria-hidden /> Publicado {p.publicadoEm && `em ${diaSP(p.publicadoEm).split("-").reverse().join("/")}`}
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline">
                abrir <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Pendente</span>
        )}
      </div>

      {!publicado && !editando && (
        <div>
          <Button size="sm" variant="outline" disabled={!liberada || pendente} onClick={() => setEditando(true)}>
            Marcar como publicado
          </Button>
          {!liberada && <p className="text-muted-foreground mt-1 text-xs">Disponível depois da aprovação.</p>}
        </div>
      )}

      {editando && (
        <form action={registrar} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor={`url-${p.id}`}>Link da publicação</Label>
            <Input id={`url-${p.id}`} name="url" type="url" placeholder="https://instagram.com/p/…" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`data-${p.id}`}>Data</Label>
            <input id={`data-${p.id}`} name="data" type="date" defaultValue={diaSP(new Date())} className="border-input h-9 rounded-md border px-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pendente}>
              Confirmar
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {publicado && (
        <form action={salvarMetricas} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {METRICAS.map(([k, rotulo]) => (
              <div key={k} className="grid gap-1">
                <Label htmlFor={`${k}-${p.id}`} className="text-xs">
                  {rotulo}
                </Label>
                <Input id={`${k}-${p.id}`} name={k} inputMode="numeric" pattern="[0-9]*" defaultValue={p[k] ?? ""} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={pendente}>
              Salvar métricas
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={desmarcar} disabled={pendente}>
              Desmarcar publicação
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

export function PublicacoesConteudo({ publicacoes, liberada }: { publicacoes: Publicacao[]; liberada: boolean }) {
  if (publicacoes.length === 0) {
    return <p className="text-muted-foreground text-sm">Escolha os canais de destino acima e salve.</p>;
  }
  return (
    <ul className="grid gap-3">
      {publicacoes.map((p) => (
        <LinhaPublicacao key={p.id} p={p} liberada={liberada} />
      ))}
    </ul>
  );
}
