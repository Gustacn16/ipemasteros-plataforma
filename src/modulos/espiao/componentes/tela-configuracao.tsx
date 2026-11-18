"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Label } from "@/componentes/ui/label";
import type { EstadoAcao } from "@/lib/acoes";
import {
  coletarAgoraAcao,
  excluirConcorrenteAcao,
  excluirPaginaAcao,
  salvarConcorrenteAcao,
  salvarPaginaAcao,
  salvarTetoAcao,
} from "../acoes/configuracao";

type Acao = (estado: EstadoAcao, formData: FormData) => Promise<EstadoAcao>;

function Aviso({ estado }: { estado: EstadoAcao }) {
  if (!estado.mensagem) return null;
  return (
    <Alert variant={estado.ok ? "default" : "destructive"}>
      <AlertDescription>{estado.mensagem}</AlertDescription>
    </Alert>
  );
}

function Caixa({ name, rotulo, marcada }: { name: string; rotulo: string; marcada: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <input id={`${name}-${rotulo}`} type="checkbox" name={name} value="true" defaultChecked={marcada} className="size-4" />
      <Label htmlFor={`${name}-${rotulo}`}>{rotulo}</Label>
    </div>
  );
}

function BotaoAcao({ acao, rotulo, campos, variante = "outline", confirmar }: { acao: Acao; rotulo: string; campos?: Record<string, string>; variante?: "outline" | "destructive" | "default"; confirmar?: string }) {
  const [estado, executar, pendente] = useActionState(acao, { ok: false });
  return (
    <form
      action={executar}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
      className="grid gap-2"
    >
      {Object.entries(campos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant={variante} disabled={pendente}>
        {pendente ? "Aguarde…" : rotulo}
      </Button>
      <Aviso estado={estado} />
    </form>
  );
}

export type ConcorrenteTela = {
  id: string;
  nome: string;
  instagram: string | null;
  site: string | null;
  observacoes: string | null;
  ativo: boolean;
  /** Erros deste concorrente na última coleta. */
  erros?: string[];
  paginas: { id: string; url: string; rotulo: string; ativa: boolean; legivel: boolean; ultimaCapturaEm: string | null }[];
};

export function FormularioConcorrente({ concorrente }: { concorrente?: ConcorrenteTela }) {
  const [estado, executar, pendente] = useActionState(salvarConcorrenteAcao, { ok: false });
  return (
    <form action={executar} className="grid gap-3 sm:grid-cols-2">
      {concorrente && <input type="hidden" name="id" value={concorrente.id} />}
      <Campo rotulo="Nome" name="nome" id={`nome-${concorrente?.id ?? "novo"}`} defaultValue={concorrente?.nome} erros={estado.erros?.nome} required />
      <Campo rotulo="@ do Instagram" name="instagram" id={`ig-${concorrente?.id ?? "novo"}`} defaultValue={concorrente?.instagram ?? ""} erros={estado.erros?.instagram} placeholder="@perfil" />
      <Campo rotulo="Site (domínio)" name="site" id={`site-${concorrente?.id ?? "novo"}`} defaultValue={concorrente?.site ?? ""} erros={estado.erros?.site} placeholder="concorrente.com.br" />
      <Campo rotulo="Observações" name="observacoes" id={`obs-${concorrente?.id ?? "novo"}`} defaultValue={concorrente?.observacoes ?? ""} erros={estado.erros?.observacoes} />
      <Caixa name="ativo" rotulo="Acompanhar" marcada={concorrente?.ativo ?? true} />
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : concorrente ? "Salvar" : "Adicionar concorrente"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

function FormularioPagina({ concorrenteId }: { concorrenteId: string }) {
  const [estado, executar, pendente] = useActionState(salvarPaginaAcao, { ok: false });
  return (
    <form action={executar} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
      <input type="hidden" name="concorrenteId" value={concorrenteId} />
      <input type="hidden" name="ativa" value="true" />
      <Campo rotulo="Rótulo" name="rotulo" id={`rotulo-${concorrenteId}`} placeholder="Pós Dermato" erros={estado.erros?.rotulo} required />
      <Campo rotulo="Endereço" name="url" id={`url-${concorrenteId}`} placeholder="https://…" erros={estado.erros?.url} required />
      <Button type="submit" size="sm" variant="outline" disabled={pendente}>
        Adicionar página
      </Button>
      <div className="sm:col-span-3">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "nunca");

export function CartaoConcorrente({ concorrente }: { concorrente: ConcorrenteTela }) {
  return (
    <div className="grid gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{concorrente.nome}</strong>
        {!concorrente.ativo && <Badge variant="secondary">pausado</Badge>}
      </div>
      {concorrente.erros?.length ? (
        <Alert variant="destructive">
          <AlertDescription>
            Na última coleta: {concorrente.erros.join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}
      <FormularioConcorrente concorrente={concorrente} />
      <div className="grid gap-2">
        <p className="font-medium text-sm">Páginas acompanhadas ({concorrente.paginas.length}/10)</p>
        {concorrente.paginas.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">
              <strong>{p.rotulo}</strong> ·{" "}
              <a href={p.url} target="_blank" rel="noreferrer noopener" className="underline">
                {p.url}
              </a>{" "}
              · {p.ultimaCapturaEm ? (p.legivel ? "legível" : "não legível (página feita só em JavaScript?)") : "ainda não lida"} · última leitura {data(p.ultimaCapturaEm)}
            </span>
            <BotaoAcao acao={excluirPaginaAcao} rotulo="Remover" campos={{ id: p.id }} confirmar="Remover esta página?" />
          </div>
        ))}
        <FormularioPagina concorrenteId={concorrente.id} />
      </div>
      <div className="flex justify-end">
        <BotaoAcao acao={excluirConcorrenteAcao} rotulo="Excluir concorrente" variante="destructive" campos={{ id: concorrente.id }} confirmar={`Excluir ${concorrente.nome}? O histórico some da tela.`} />
      </div>
    </div>
  );
}

export function FormularioTeto({ tetoUsd }: { tetoUsd: string }) {
  const [estado, executar, pendente] = useActionState(salvarTetoAcao, { ok: false });
  return (
    <form action={executar} className="flex max-w-sm flex-wrap items-end gap-2">
      <Campo rotulo="Teto do mês (US$)" name="tetoUsd" defaultValue={tetoUsd} inputMode="decimal" erros={estado.erros?.tetoUsd} ajuda="Entre US$ 1 e US$ 100. Ao atingir, a coleta para até o mês seguinte." />
      <Button type="submit" size="sm" disabled={pendente}>
        Salvar teto
      </Button>
      <div className="w-full">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

export function BotaoColetarAgora() {
  return <BotaoAcao acao={coletarAgoraAcao} rotulo="Coletar agora" variante="default" />;
}
