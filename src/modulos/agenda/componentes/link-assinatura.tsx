"use client";

import { CheckIcon, ClockIcon, CopyIcon, LinkIcon, RefreshCwIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { gerarLinkAssinaturaAcao } from "../acoes/agenda";

/**
 * "Levar para o Google": gera o link de assinatura .ics do calendário da IPEMaster.
 * O link completo só existe nesta tela logo depois de gerado; o servidor guarda apenas o hash.
 */
export function LinkAssinatura({ temLink }: { temLink: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const jaTem = temLink || link !== null;

  function gerar() {
    setConfirmar(false);
    iniciar(async () => {
      const r = await gerarLinkAssinaturaAcao();
      if (avisar(r) && r.dados) setLink(r.dados.link);
    });
  }

  return (
    <div className="grid max-w-2xl min-w-0 grid-cols-1 gap-4">
      <ol className="text-muted-foreground ml-5 grid list-decimal gap-1 text-sm [&_strong]:text-foreground [&_strong]:font-medium">
        <li>Clique em <strong>{jaTem ? "Gerar novo link" : "Gerar link"}</strong> e copie o link.</li>
        <li>
          No computador, abra o <strong>Google Agenda</strong>. Na coluna da esquerda, ao lado de <strong>Outras agendas</strong>, clique em <strong>+</strong> e depois em{" "}
          <strong>&quot;Do URL&quot;</strong>.
        </li>
        <li>Cole o link e clique em <strong>Adicionar agenda</strong>. Ela aparece também no celular.</li>
      </ol>

      {link ? (
        <LinkGerado link={link} />
      ) : (
        temLink && (
          <p className="text-muted-foreground text-sm">
            Você já gerou um link. Por segurança ele não é mostrado de novo. Se perdeu o link, gere um novo.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center gap-2">
        {jaTem && confirmar ? (
          <>
            <span className="text-sm">O link anterior para de funcionar na hora. Continuar?</span>
            <Button size="sm" variant="destructive" disabled={pendente} onClick={gerar}>
              Gerar novo link
            </Button>
            <Button size="sm" variant="ghost" disabled={pendente} onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button size="sm" variant={jaTem ? "outline" : "default"} disabled={pendente} onClick={jaTem ? () => setConfirmar(true) : gerar}>
            {jaTem ? <RefreshCwIcon /> : <LinkIcon />} {pendente ? "Gerando…" : jaTem ? "Gerar novo link" : "Gerar link"}
          </Button>
        )}
      </div>

      <p className="flex items-start gap-2 text-sm">
        <ClockIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          O Google pode levar algumas horas para atualizar. <span className="text-muted-foreground">A Agenda da plataforma é sempre imediata.</span>
        </span>
      </p>
      <p className="text-muted-foreground text-xs">
        O link leva só o calendário da IPEMaster que você vê aqui. Não leva suas agendas pessoais nem suas tarefas. Quem tiver o link vê esse calendário: se ele vazar, gere um novo.
      </p>
    </div>
  );
}

/** Link recém-gerado, com Copiar. Se a área de transferência falhar, seleciona o texto para copiar à mão. */
export function LinkGerado({ link }: { link: string }) {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      toast.success("Link copiado.");
    } catch {
      campo.current?.focus();
      campo.current?.select();
      toast.info("Link selecionado. Copie com Ctrl+C (ou Cmd+C).");
    }
  }

  return (
    <div className="bg-informacao-suave border-informacao grid min-w-0 gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Copie agora: este link não será mostrado de novo.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          ref={campo}
          readOnly
          value={link}
          aria-label="Link de assinatura"
          onFocus={(e) => e.currentTarget.select()}
          className="bg-background h-9 min-w-0 flex-1 font-mono text-xs"
        />
        <Button size="sm" className="h-9" onClick={copiar}>
          {copiado ? <CheckIcon /> : <CopyIcon />} {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
