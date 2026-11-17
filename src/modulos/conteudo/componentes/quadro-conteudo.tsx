"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { mudarEtapaAcao } from "../acoes/conteudo";
import { COR_ETAPA, ETAPAS_DO_QUADRO, ROTULO_ETAPA } from "../regras/etapas";
import type { CartaoConteudo } from "../servicos/conteudos";
import { Cartao } from "./exibicao";
import { BotaoNovoConteudo } from "./novo-conteudo";
import { SeletorEtapa } from "./seletor-etapa";

type EtapaQuadro = (typeof ETAPAS_DO_QUADRO)[number];
type Quadro = Record<EtapaQuadro, CartaoConteudo[]>;
const TIPO_ARRASTE = "application/x-conteudo";

/** Move o cartão de coluna no quadro local (antes do servidor responder). */
function mover(quadro: Quadro, id: string, para: EtapaQuadro): Quadro {
  const item = ETAPAS_DO_QUADRO.flatMap((e) => quadro[e]).find((i) => i.id === id);
  if (!item || item.etapa === para) return quadro;
  const novo = { ...quadro, [item.etapa]: quadro[item.etapa as EtapaQuadro].filter((i) => i.id !== id) } as Quadro;
  novo[para] = [{ ...item, etapa: para }, ...quadro[para]];
  return novo;
}

/**
 * Quadro de planejamento: arrastar um cartão para outra coluna muda a etapa.
 * O seletor no cartão continua para celular e teclado.
 */
export function QuadroConteudo({ quadro: doServidor, agora }: { quadro: Quadro; agora: Date }) {
  const router = useRouter();
  const [quadro, setQuadro] = useState(doServidor);
  const [base, setBase] = useState(doServidor);
  const [sobre, setSobre] = useState<EtapaQuadro | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  // Dados novos do servidor (outra pessoa mexeu, ou a ação terminou) substituem o quadro local.
  if (doServidor !== base) {
    setBase(doServidor);
    setQuadro(doServidor);
  }

  function soltar(id: string, para: EtapaQuadro) {
    const antes = quadro;
    const item = ETAPAS_DO_QUADRO.flatMap((e) => quadro[e]).find((i) => i.id === id);
    if (!item || item.etapa === para) return;
    setQuadro(mover(quadro, id, para));
    iniciar(async () => {
      const r = await mudarEtapaAcao(id, para);
      if (!avisar(r)) setQuadro(antes);
      router.refresh();
    });
  }

  return (
    // No celular as colunas empilham; da tela média em diante o quadro rola dentro do próprio espaço.
    <div className="relative min-w-0 md:overflow-x-auto md:pb-2">
      <div className="flex flex-col gap-3 md:flex-row">
        {ETAPAS_DO_QUADRO.map((etapa) => (
          <section
            key={etapa}
            aria-labelledby={`col-${etapa}`}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TIPO_ARRASTE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setSobre(etapa);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre((s) => (s === etapa ? null : s));
            }}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const id = e.dataTransfer.getData(TIPO_ARRASTE);
              if (id) soltar(id, etapa);
            }}
            className={cn(
              "bg-muted/40 grid min-w-0 content-start gap-2 rounded-xl border p-2 transition-colors md:min-h-40 md:w-64 md:shrink-0",
              sobre === etapa && "border-primary bg-primary/5",
            )}
          >
            <h2 id={`col-${etapa}`} className="flex items-center gap-2 px-1 py-0.5 text-sm font-semibold">
              <ChipSituacao cor={COR_ETAPA[etapa]} tamanho="sm">
                {ROTULO_ETAPA[etapa]}
              </ChipSituacao>
              <span className="text-muted-foreground font-normal tabular-nums">{quadro[etapa].length}</span>
              <BotaoNovoConteudo icone etapa={etapa} rotulo={`Novo conteúdo em ${ROTULO_ETAPA[etapa]}`} className="ml-auto" />
            </h2>
            {quadro[etapa].map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TIPO_ARRASTE, item.id);
                  e.dataTransfer.effectAllowed = "move";
                  setArrastando(item.id);
                }}
                onDragEnd={() => {
                  setArrastando(null);
                  setSobre(null);
                }}
                className={cn("cursor-grab active:cursor-grabbing", arrastando === item.id && "opacity-50")}
              >
                <Cartao
                  item={item}
                  agora={agora}
                  mostrarGravacao={etapa === "a_gravar"}
                  acoes={<SeletorEtapa conteudoId={item.id} etapa={item.etapa} compacto />}
                />
              </div>
            ))}
            {quadro[etapa].length === 0 && (
              <p className="text-muted-foreground px-1 py-2 text-xs">{arrastando ? "Solte aqui" : "Vazio"}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
