"use client";

import { MessageSquareIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { apagarConversaAcao } from "../acoes/conversas";
import { ConversaNexuView } from "./conversa-nexu";
import type { MensagemTela } from "./estado-conversa";
import { useConversaNexu } from "./use-conversa-nexu";

export type ConversaDaLista = { id: string; titulo: string; atualizadoEm: string };

type Props = {
  conversas: ConversaDaLista[];
  /** Conversa aberta (vinda do servidor) ou null para uma nova. */
  atual: { id: string; mensagens: MensagemTela[] } | null;
  configurado: boolean;
  motivo?: string;
  perguntasPorDia: number;
  /** Perguntas já feitas hoje; null quando não dá para saber (limite do mês). */
  usadasHoje: number | null;
};

const formato = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function TelaNexu({ conversas, atual, configurado, motivo, perguntasPorDia, usadasHoje }: Props) {
  const router = useRouter();
  const conversa = useConversaNexu(atual?.id ?? null, atual?.mensagens ?? []);
  const [apagando, iniciar] = useTransition();
  const [erroApagar, setErroApagar] = useState<string | null>(null);

  // Quando uma pergunta termina, atualiza a lista (a conversa nova passa a aparecer nela).
  const terminou = !conversa.enviando && (conversa.restantesHoje !== null || (conversa.erro !== null && conversa.conversaId !== null));
  useEffect(() => {
    if (terminou) router.refresh();
  }, [terminou, conversa.restantesHoje, conversa.erro, router]);

  const usadas = conversa.restantesHoje !== null ? perguntasPorDia - conversa.restantesHoje : usadasHoje;
  const idAberto = atual?.id ?? conversa.conversaId;

  function apagar(id: string) {
    if (!window.confirm("Apagar esta conversa? Não dá para desfazer.")) return;
    setErroApagar(null);
    iniciar(async () => {
      const r = await apagarConversaAcao(id);
      if (!r.ok) return setErroApagar(r.mensagem ?? "Não foi possível apagar.");
      if (id === idAberto) router.push("/nexu");
      else router.refresh();
    });
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[18rem_1fr]">
      <aside aria-label="Conversas" className="grid content-start gap-2 md:max-h-[calc(100dvh-10rem)] md:overflow-y-auto">
        {atual ? (
          <Button asChild variant="outline">
            <Link href="/nexu">
              <PlusIcon /> Nova conversa
            </Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={conversa.nova}>
            <PlusIcon /> Nova conversa
          </Button>
        )}
        {erroApagar && (
          <p role="alert" className="text-destructive text-sm">
            {erroApagar}
          </p>
        )}
        {conversas.length === 0 ? (
          <EstadoVazio compacto icone={MessageSquareIcon} titulo="Nenhuma conversa ainda" />
        ) : (
          <ul className="grid gap-1">
            {conversas.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <Link
                  href={`/nexu/${c.id}`}
                  aria-current={c.id === idAberto ? "page" : undefined}
                  className="hover:bg-muted aria-[current=page]:bg-muted min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="block truncate">{c.titulo}</span>
                  <span className="text-muted-foreground block text-xs">{formato.format(new Date(c.atualizadoEm))}</span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={apagando}
                  onClick={() => apagar(c.id)}
                  aria-label={`Apagar a conversa "${c.titulo}"`}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="border-border bg-card flex min-h-[28rem] min-w-0 flex-col rounded-xl border md:h-[calc(100dvh-10rem)]">
        {configurado ? (
          <>
            <div className="border-border text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
              <span>{usadas !== null ? `${usadas} de ${perguntasPorDia} perguntas hoje` : "Limite do mês atingido"}</span>
              {conversa.mensagens.length > 0 && !atual && (
                <Button type="button" variant="ghost" size="xs" onClick={conversa.nova}>
                  Nova conversa
                </Button>
              )}
            </div>
            <ConversaNexuView conversa={conversa} />
          </>
        ) : (
          <div className="m-auto grid gap-1 p-6 text-center">
            <p className="font-medium">Nexu ainda não configurado</p>
            {motivo && <p className="text-muted-foreground text-sm">{motivo}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
