"use client";

import { AlertTriangleIcon, CalendarPlusIcon, CheckCircle2Icon, LockIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { CORES_ESPACO } from "@/modulos/tarefas/componentes/dialogos-estrutura";
import { adicionarAgendaAcao, editarAgendaAcao, removerAgendaAcao } from "../acoes/agenda";
import { SeletorCor } from "./gerenciar-tipos";

/** Só textos: a URL completa nunca chega ao navegador, apenas a versão mascarada. */
export type MinhaAgendaLinha = {
  id: string;
  nome: string;
  cor: string;
  urlMascarada: string;
  /** "Lida às HH:MM", ou nulo se nunca foi lida. */
  leitura: string | null;
  ultimoErro: string | null;
};

/** Agendas pessoais por link iCal: passo a passo, formulário e lista. Só o dono vê. */
export function MinhasAgendas({ agendas, limite }: { agendas: MinhaAgendaLinha[]; limite: number }) {
  return (
    <div className="grid max-w-2xl min-w-0 grid-cols-1 gap-4">
      <p className="bg-muted/50 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
        <LockIcon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-medium">Só você vê esses compromissos.</strong>{" "}
          <span className="text-muted-foreground">Eles aparecem na sua Agenda da plataforma e não são guardados aqui.</span>
        </span>
      </p>

      <div className="grid gap-2">
        <PassoAPasso titulo="Como pegar o link no Google Agenda">
          <li>No computador, abra o Google Agenda e clique na engrenagem → <strong>Configurações</strong>.</li>
          <li>Na coluna da esquerda, em &quot;Configurações das minhas agendas&quot;, <strong>clique na sua agenda</strong>.</li>
          <li>Desça até <strong>Integrar agenda</strong>.</li>
          <li>
            Em <strong>&quot;Endereço secreto no formato iCal&quot;</strong>, clique no botão de copiar.
          </li>
          <li>Volte aqui e cole o link no campo abaixo.</li>
        </PassoAPasso>
        <PassoAPasso titulo="Como pegar o link no Outlook">
          <li>Abra o Outlook na web e vá em Configurações → <strong>Calendário</strong> → <strong>Calendários compartilhados</strong>.</li>
          <li>
            Em <strong>Publicar um calendário</strong>, escolha a agenda, marque &quot;Pode exibir todos os detalhes&quot; e clique em <strong>Publicar</strong>.
          </li>
          <li>Copie o link <strong>ICS</strong> e cole no campo abaixo.</li>
        </PassoAPasso>
        <p className="text-muted-foreground text-xs">
          Esse link é secreto: quem tem o link vê seus compromissos. Não mande para ninguém. Se achar que vazou, gere outro no Google (botão Redefinir) e cole o novo aqui.
        </p>
      </div>

      {agendas.length > 0 ? (
        <ul className="grid min-w-0 grid-cols-1 divide-y rounded-md border">
          {agendas.map((a) => (
            <LinhaAgenda key={`${a.id}-${a.nome}-${a.cor}`} agenda={a} />
          ))}
        </ul>
      ) : (
        <EstadoVazio icone={CalendarPlusIcon} titulo="Conecte seu Google Agenda" descricao="Cole o endereço secreto iCal no formulário abaixo." />
      )}

      {agendas.length < limite ? (
        <NovaAgenda corInicial={CORES_ESPACO[agendas.length % CORES_ESPACO.length]} />
      ) : (
        <p className="text-muted-foreground text-sm">Você já tem {limite} agendas ligadas. Remova uma para ligar outra.</p>
      )}

      <p className="text-muted-foreground text-xs">Se a plataforma trocar a chave de segurança, será preciso colar o link de novo.</p>
    </div>
  );
}

function PassoAPasso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border px-3 py-2 text-sm">
      <summary className="marker:text-primary cursor-pointer font-medium">{titulo}</summary>
      <ol className="text-muted-foreground mt-2 ml-5 grid list-decimal gap-1 [&_strong]:text-foreground [&_strong]:font-medium">{children}</ol>
    </details>
  );
}

function NovaAgenda({ corInicial }: { corInicial: string }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(corInicial);
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="grid min-w-0 gap-3 rounded-md border p-3"
      action={() =>
        iniciar(async () => {
          setErro(null);
          const r = await adicionarAgendaAcao({ nome, cor, url });
          if (r.ok) {
            avisar(r);
            setNome("");
            setUrl("");
            return;
          }
          setErro(r.mensagem ?? Object.values(r.erros ?? {}).flat().filter(Boolean)[0] ?? "Não foi possível ligar a agenda.");
        })
      }
    >
      <span className="text-sm font-medium">Ligar uma agenda</span>
      <div className="flex flex-wrap items-end gap-2">
        <SeletorCor valor={cor} mudar={setCor} rotulo="Cor da agenda" />
        <div className="grid min-w-0 flex-1 basis-40 gap-1">
          <Label htmlFor="nova-agenda-nome" className="text-xs">
            Nome
          </Label>
          <Input id="nova-agenda-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pessoal" maxLength={60} className="h-9" />
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="nova-agenda-url" className="text-xs">
          Endereço secreto no formato iCal
        </Label>
        <Input
          id="nova-agenda-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          maxLength={2000}
          className="h-9 font-mono text-xs"
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? "nova-agenda-erro" : undefined}
        />
      </div>
      {erro && (
        <p id="nova-agenda-erro" role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={pendente || !nome.trim() || !url.trim()}>
          <PlusIcon /> {pendente ? "Testando o link…" : "Ligar agenda"}
        </Button>
        <span className="text-muted-foreground text-xs">Antes de salvar, eu testo se consigo ler a agenda.</span>
      </div>
    </form>
  );
}

function LinhaAgenda({ agenda }: { agenda: MinhaAgendaLinha }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(agenda.nome);
  const [cor, setCor] = useState(agenda.cor);
  const [confirmar, setConfirmar] = useState(false);
  const mudou = nome.trim() !== agenda.nome || cor !== agenda.cor;

  return (
    <li className="grid min-w-0 gap-1.5 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <SeletorCor valor={cor} mudar={setCor} rotulo={`Cor de ${agenda.nome}`} />
        <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} aria-label="Nome da agenda" className="h-8 w-44 max-w-full min-w-0" />
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={pendente || !mudou || !nome.trim()}
            onClick={() => iniciar(async () => void avisar(await editarAgendaAcao({ agendaId: agenda.id, nome, cor })))}
          >
            Salvar
          </Button>
          {confirmar ? (
            <>
              <Button size="sm" variant="destructive" disabled={pendente} onClick={() => iniciar(async () => void avisar(await removerAgendaAcao(agenda.id)))}>
                Remover mesmo
              </Button>
              <Button size="sm" variant="ghost" disabled={pendente} onClick={() => setConfirmar(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" disabled={pendente} onClick={() => setConfirmar(true)}>
              <Trash2Icon /> Remover
            </Button>
          )}
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground min-w-0 font-mono break-all">{agenda.urlMascarada}</span>
        {agenda.ultimoErro ? (
          <ChipSituacao tom="perigo" icone={AlertTriangleIcon} tamanho="sm">
            {/* O erro explica o motivo: quebra linha em vez de cortar no celular. */}
            <span className="break-words whitespace-normal">{agenda.ultimoErro}</span>
          </ChipSituacao>
        ) : agenda.leitura ? (
          <ChipSituacao tom="sucesso" icone={CheckCircle2Icon} tamanho="sm">
            {agenda.leitura}
          </ChipSituacao>
        ) : null}
      </div>
    </li>
  );
}

/** Aviso acima do calendário para cada agenda pessoal que não foi lida. O resto da tela segue normal. */
export function AvisoAgendasComErro({ agendas }: { agendas: { id: string; nome: string; erro: string | null }[] }) {
  const comErro = agendas.filter((a) => a.erro);
  if (comErro.length === 0) return null;
  return (
    <div role="status" className="bg-atencao-suave border-atencao text-foreground grid min-w-0 gap-1 rounded-md border px-3 py-2 text-sm">
      {comErro.map((a) => (
        <p key={a.id} className="flex items-start gap-2">
          <AlertTriangleIcon className="text-atencao mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            <strong className="font-medium">Não consegui ler {a.nome}.</strong> <span className="text-muted-foreground">{a.erro}</span>
          </span>
        </p>
      ))}
      <Link href="/agenda/configuracoes" className="ml-6 w-fit text-xs font-medium underline underline-offset-2">
        Ver em Configurações
      </Link>
    </div>
  );
}
