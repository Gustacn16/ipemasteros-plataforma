"use client";

import { AlertTriangleIcon, CheckCircle2Icon, CircleSlashIcon, CameraIcon, RefreshCwIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { CabecalhoPagina } from "@/componentes/cabecalho-pagina";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { EstadoVazio } from "@/componentes/estado-vazio";
import type { Tom } from "@/componentes/regras-visuais";
import { Button } from "@/componentes/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { atualizarInstagramAgoraAcao, definirContaInstagramAtivaAcao, ligarContaCanalAcao } from "../acoes/instagram";
import type { Situacao, SituacaoIntegracaoInstagram } from "../servicos/integracao-instagram";

const formatoDataHora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

const SITUACAO: Record<Situacao, { rotulo: string; tom: Tom; icone: typeof CheckCircle2Icon }> = {
  conectada: { rotulo: "Conectada", tom: "sucesso", icone: CheckCircle2Icon },
  falta_permissao: { rotulo: "Falta permissão", tom: "atencao", icone: AlertTriangleIcon },
  nao_configurada: { rotulo: "Não configurada", tom: "neutro", icone: CircleSlashIcon },
  chave_invalida: { rotulo: "Chave inválida", tom: "perigo", icone: XCircleIcon },
  erro: { rotulo: "Sem resposta da Meta", tom: "atencao", icone: AlertTriangleIcon },
};

const ROTULO_STATUS = { concluida: "Concluída", falhou: "Falhou", em_andamento: "Em andamento" } as const;
const TOM_STATUS: Record<keyof typeof ROTULO_STATUS, Tom> = { concluida: "sucesso", falhou: "perigo", em_andamento: "atencao" };

function detalhe(s: SituacaoIntegracaoInstagram): string {
  if (s.situacao === "nao_configurada") return "Falta colocar a chave META_ACCESS_TOKEN na Hostinger.";
  if (s.situacao === "falta_permissao")
    return `A chave não tem: ${s.faltando.join(", ")}. Gere uma nova chave do usuário do sistema com essas permissões e troque na Hostinger.`;
  if (s.situacao === "chave_invalida") return "Gere uma nova chave no portfólio da Meta e troque na Hostinger.";
  if (s.situacao === "erro") return s.mensagem ?? "Tente de novo em alguns minutos.";
  if (s.contas.length === 0) return 'A chave funciona. Clique em "Atualizar agora" para encontrar as contas do Instagram.';
  if (!s.contas.some((c) => c.canalId)) return "Ligue a conta ao canal do Instagram para começar a importar.";
  return "Os números são atualizados todo dia às 4h, e os stories de hora em hora.";
}

const INTERVALO_ATUALIZACAO_MS = 5000;

/** `rodando`: há uma atualização em andamento; a tela se atualiza a cada 5 segundos até ela terminar. */
export function IntegracaoInstagram({ situacao: s, rodando }: { situacao: SituacaoIntegracaoInstagram; rodando: boolean }) {
  const router = useRouter();
  const [iniciando, iniciar] = useTransition();
  const [alterando, alterar] = useTransition();
  const atual = SITUACAO[s.situacao];
  const atualizando = iniciando || rodando;

  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => router.refresh(), INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(id);
  }, [rodando, router]);

  const executar = (acao: () => Promise<Parameters<typeof avisar>[0]>) =>
    alterar(async () => {
      if (avisar(await acao())) router.refresh();
    });

  return (
    <div className="grid max-w-5xl gap-6">
      <CabecalhoPagina
        titulo="Integração Instagram"
        descricao="Liga o Instagram da IPEMaster ao Conteúdo para trazer os posts, os stories e os números sozinhos."
        acoes={
          <Button
            disabled={atualizando || s.situacao === "nao_configurada"}
            onClick={() =>
              iniciar(async () => {
                try {
                  avisar(await atualizarInstagramAgoraAcao());
                } catch {
                  avisar({
                    ok: false,
                    mensagem: "A conexão caiu. Se a atualização começou, ela continua no servidor; recarregue em alguns minutos.",
                  });
                }
                router.refresh();
              })
            }
          >
            <RefreshCwIcon className={cn(atualizando && "animate-spin")} />
            {atualizando ? "Atualizando… a primeira vez pode levar alguns minutos" : "Atualizar agora"}
          </Button>
        }
      />

      <section className="bg-card grid gap-2 rounded-xl border p-4">
        <ChipSituacao tom={atual.tom} icone={atual.icone}>
          {atual.rotulo}
        </ChipSituacao>
        <p className="text-muted-foreground text-sm">{detalhe(s)}</p>
        <p className="text-muted-foreground text-xs">
          Passo a passo da configuração: <code>docs/runbooks/instagram.md</code>.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Contas do Instagram</h2>
        {s.contas.length === 0 ? (
          <EstadoVazio compacto icone={CameraIcon} titulo="Nenhuma conta encontrada ainda" />
        ) : (
          <ul className="bg-card divide-y rounded-xl border">
            {s.contas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                {c.fotoUrl ? (
                  // Link da Meta, que expira: sem otimização do Next.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.fotoUrl} alt="" className="size-9 rounded-full object-cover" />
                ) : (
                  <CameraIcon className="text-muted-foreground size-9 p-2" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium">@{c.usuario}</span> {c.nome && <span className="text-muted-foreground">{c.nome}</span>}
                </span>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">Canal</span>
                  <select
                    className="bg-background rounded-md border px-2 py-1"
                    value={c.canalId ?? ""}
                    disabled={alterando}
                    onChange={(e) => executar(() => ligarContaCanalAcao({ contaId: c.id, canalId: e.target.value || null }))}
                  >
                    <option value="">Nenhum</option>
                    {s.canais.map((canal) => (
                      <option key={canal.id} value={canal.id}>
                        {canal.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={c.ativa}
                    disabled={alterando}
                    onChange={(e) => executar(() => definirContaInstagramAtivaAcao(c.id, e.target.checked))}
                  />
                  Importar
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Últimas atualizações</h2>
        {s.atualizacoes.length === 0 ? (
          <EstadoVazio compacto icone={RefreshCwIcon} titulo="Nenhuma atualização ainda" />
        ) : (
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.atualizacoes.map((a) => (
                  <TableRow key={a.id} className="align-top">
                    <TableCell className="whitespace-nowrap">{formatoDataHora.format(new Date(a.iniciadoEm))}</TableCell>
                    <TableCell>{a.tipo === "completa" ? "Completa" : "Stories"}</TableCell>
                    <TableCell>{a.origem === "agendada" ? "Automática" : "Manual"}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.registros}</TableCell>
                    <TableCell className="max-w-md">
                      <ChipSituacao tamanho="sm" tom={TOM_STATUS[a.status]}>
                        {ROTULO_STATUS[a.status]}
                      </ChipSituacao>
                      {a.erro && <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">{a.erro}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
