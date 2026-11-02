"use client";

import { FilterIcon, XIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { cn } from "@/lib/utils";
import { COOKIE_FILTRO, FORMATOS, ROTULO_FORMATO, ROTULO_PLATAFORMA, limparFiltro, type FiltroConteudo } from "../esquemas/conteudo";
import { ETAPAS, ROTULO_ETAPA } from "../regras/etapas";
import type { Conta } from "../servicos/contas";

const UM_ANO = 60 * 60 * 24 * 365;

/** Salva o filtro no cookie e recarrega os dados da tela. Retorna a função para os componentes do módulo. */
export function useAplicarFiltro() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const aplicar = (filtro: FiltroConteudo) => {
    const limpo = limparFiltro(filtro);
    const vazio = Object.keys(limpo).length === 0;
    document.cookie = `${COOKIE_FILTRO}=${vazio ? "" : encodeURIComponent(JSON.stringify(limpo))}; path=/conteudo; max-age=${vazio ? 0 : UM_ANO}; samesite=lax`;
    iniciar(() => router.refresh());
  };
  return { aplicar, pendente };
}

const estiloSelect = "border-input bg-background h-8 max-w-48 rounded-md border px-2 text-sm";
const ativo = "border-orange-500 bg-orange-50 font-medium dark:bg-orange-950";

type Props = { filtro: FiltroConteudo; contas: Conta[]; pessoas: { id: string; nome: string }[] };

/** Filtros das visões do módulo. Ficam salvos ao trocar de tela e ao voltar outro dia, até clicar em Limpar. */
export function BarraFiltros({ filtro, contas, pessoas }: Props) {
  const caminho = usePathname();
  const { aplicar, pendente } = useAplicarFiltro();
  // Só nas visões (o detalhe e as configurações não usam filtro).
  if (caminho.startsWith("/conteudo/itens") || caminho.startsWith("/conteudo/configuracoes")) return null;

  const canais = contas.filter((c) => !filtro.marca || c.id === filtro.marca).flatMap((c) => c.canais.map((k) => ({ ...k, conta: c.nome })));
  const total = Object.keys(limparFiltro(filtro)).length;
  const mudar = (campo: keyof FiltroConteudo, valor: string) => {
    const novo = { ...filtro, [campo]: valor || undefined };
    // Trocar de conta solta o canal de outra conta.
    if (campo === "marca" && novo.canal && !contas.find((c) => c.id === valor)?.canais.some((k) => k.id === novo.canal)) novo.canal = undefined;
    aplicar(novo);
  };

  return (
    <div role="group" aria-label="Filtros" className={cn("mb-4 flex flex-wrap items-center gap-2", pendente && "opacity-60")}>
      <FilterIcon className="text-muted-foreground size-4" aria-hidden />
      <select aria-label="Conta" className={cn(estiloSelect, filtro.marca && ativo)} value={filtro.marca ?? ""} onChange={(e) => mudar("marca", e.target.value)}>
        <option value="">Todas as contas</option>
        {contas.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <select aria-label="Canal" className={cn(estiloSelect, filtro.canal && ativo)} value={filtro.canal ?? ""} onChange={(e) => mudar("canal", e.target.value)}>
        <option value="">Todos os canais</option>
        {canais.map((k) => (
          <option key={k.id} value={k.id}>
            {filtro.marca ? "" : `${k.conta} · `}
            {ROTULO_PLATAFORMA[k.plataforma]}
          </option>
        ))}
      </select>
      <select
        aria-label="Responsável"
        className={cn(estiloSelect, filtro.responsavel && ativo)}
        value={filtro.responsavel ?? ""}
        onChange={(e) => mudar("responsavel", e.target.value)}
      >
        <option value="">Todos os responsáveis</option>
        {pessoas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>
      <select aria-label="Formato" className={cn(estiloSelect, filtro.formato && ativo)} value={filtro.formato ?? ""} onChange={(e) => mudar("formato", e.target.value)}>
        <option value="">Todos os formatos</option>
        {FORMATOS.map((f) => (
          <option key={f} value={f}>
            {ROTULO_FORMATO[f]}
          </option>
        ))}
      </select>
      <select aria-label="Etapa" className={cn(estiloSelect, filtro.etapa && ativo)} value={filtro.etapa ?? ""} onChange={(e) => mudar("etapa", e.target.value)}>
        <option value="">Todas as etapas</option>
        {ETAPAS.map((e) => (
          <option key={e} value={e}>
            {ROTULO_ETAPA[e]}
          </option>
        ))}
      </select>
      {total > 0 && (
        <Button size="sm" variant="ghost" onClick={() => aplicar({})} disabled={pendente}>
          <XIcon /> Limpar filtros ({total})
        </Button>
      )}
    </div>
  );
}
