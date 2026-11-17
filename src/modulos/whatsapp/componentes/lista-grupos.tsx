"use client";

import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirMonitoramentoAcao, ligarTurmaAcao } from "../acoes/conversas";
import type { GrupoNaTela } from "../servicos/conversas";

// Datas chegam como string ISO do servidor para o componente de cliente.
export type LinhaGrupo = Omit<GrupoNaTela, "provisoriaAte" | "ultimaMensagemEm"> & {
  provisoriaAte: string | null;
  ultimaMensagemEm: string | null;
};

export function ListaGrupos({ grupos, turmas }: { grupos: LinhaGrupo[]; turmas: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [pendente, executar] = useTransition();

  const rodar = (acao: () => Promise<{ ok: boolean; mensagem?: string }>) =>
    executar(async () => {
      avisar(await acao());
      router.refresh();
    });

  if (grupos.length === 0) {
    return (
      <EstadoVazio
        icone={UsersIcon}
        titulo="Nenhum grupo por aqui"
        descricao="Os grupos aparecem quando um número conectado participa deles."
      />
    );
  }

  return (
    <div className="bg-card overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Grupo</TableHead>
            <TableHead>Números da empresa</TableHead>
            <TableHead>Mensagens (7 dias)</TableHead>
            <TableHead>Turma</TableHead>
            <TableHead>Acompanhar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">
                <Link href={`/whatsapp/conversas/${g.id}`} className="underline-offset-4 hover:underline">
                  {g.nome}
                </Link>
                {!g.monitorada && g.provisoriaAte && (
                  <span className="text-muted-foreground block text-xs font-normal">
                    Histórico guardado até {formatarDataHora(new Date(g.provisoriaAte))}
                  </span>
                )}
              </TableCell>
              <TableCell>{g.numeros.length > 0 ? g.numeros.join(", ") : "—"}</TableCell>
              <TableCell>{g.totalMensagens7d}</TableCell>
              <TableCell>
                <select
                  aria-label={`Turma do grupo ${g.nome}`}
                  className="bg-background h-8 rounded-md border px-2"
                  value={g.turma?.id ?? ""}
                  disabled={pendente}
                  onChange={(e) => rodar(() => ligarTurmaAcao(g.id, e.target.value || null))}
                >
                  <option value="">Sem turma</option>
                  {turmas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-4"
                    checked={g.monitorada}
                    disabled={pendente}
                    onChange={(e) => {
                      const ligar = e.target.checked;
                      if (!ligar && !confirm("As mensagens guardadas deste grupo serão apagadas.")) return;
                      rodar(() => definirMonitoramentoAcao(g.id, ligar));
                    }}
                  />
                  Acompanhar
                </label>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
