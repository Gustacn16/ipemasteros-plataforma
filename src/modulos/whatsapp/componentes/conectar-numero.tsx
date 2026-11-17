"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { conectarNumeroAcao, situacaoNumeroAcao } from "../acoes/numeros";
import type { EstadoTela } from "../regras/conexao";

const INTERVALO_MS = 2000;
const FECHAR_APOS_CONECTAR_MS = 2000;
/** Nestes estados a consulta para e a tela oferece "Tentar de novo". */
const ESTADOS_DE_PARADA: readonly EstadoTela[] = ["qr_expirado", "erro", "motor_sem_resposta", "removido_no_celular"];

type Situacao = { estado: EstadoTela; rotulo: string; qrSvg: string | null };

export function ConectarNumero({ numeroId, nome }: { numeroId: string; nome: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [falhou, setFalhou] = useState(false);

  const fechar = useCallback(() => {
    setAberto(false);
    setSituacao(null);
    setFalhou(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!aberto) return;
    // Flag por execução: um pedido em voo de uma execução antiga nunca reinicia a consulta.
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    function falha(r?: { mensagem?: string }) {
      avisar({ ok: false, mensagem: r?.mensagem ?? "Não foi possível consultar a conexão." });
      setFalhou(true);
    }

    async function consultar() {
      try {
        const r = await situacaoNumeroAcao(numeroId);
        if (cancelado) return;
        if (!r.ok || !r.dados) return falha(r);
        setSituacao(r.dados);
        if (r.dados.estado === "conectado") {
          temporizador = setTimeout(fechar, FECHAR_APOS_CONECTAR_MS);
          return;
        }
        if (ESTADOS_DE_PARADA.includes(r.dados.estado)) return;
        temporizador = setTimeout(consultar, INTERVALO_MS);
      } catch {
        if (!cancelado) falha();
      }
    }

    (async () => {
      try {
        const pedido = await conectarNumeroAcao(numeroId);
        if (cancelado) return;
        if (!pedido.ok) return falha(pedido);
        await consultar();
      } catch {
        if (!cancelado) falha();
      }
    })();

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [aberto, numeroId, tentativa, fechar]);

  const parou = falhou || (situacao !== null && ESTADOS_DE_PARADA.includes(situacao.estado));

  return (
    <>
      <Button size="sm" onClick={() => setAberto(true)}>
        Conectar
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => (v ? setAberto(true) : fechar())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar {nome}</DialogTitle>
            <DialogDescription>No celular: WhatsApp › Aparelhos conectados › Conectar um aparelho</DialogDescription>
          </DialogHeader>
          <div className="grid justify-items-center gap-3 py-2 text-center" aria-live="polite">
            {situacao?.estado === "conectado" ? (
              <p className="text-lg font-semibold">Conectado!</p>
            ) : situacao?.qrSvg ? (
              // SVG gerado no servidor pela biblioteca qrcode a partir do QR do motor: não é texto digitado por ninguém.
              <div className="size-64 rounded-lg bg-white p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: situacao.qrSvg }} />
            ) : (
              <p className="text-muted-foreground text-sm">{situacao ? situacao.rotulo : falhou ? "Não foi possível conectar." : "Preparando o QR…"}</p>
            )}
            {situacao?.qrSvg && <p className="text-muted-foreground text-sm">{situacao.rotulo}</p>}
            {parou && <Button onClick={() => {
                  setSituacao(null);
                  setFalhou(false);
                  setTentativa((t) => t + 1);
                }}>Tentar de novo</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
