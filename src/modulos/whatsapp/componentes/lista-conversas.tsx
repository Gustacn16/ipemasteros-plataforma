"use client";

import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EstadoVazio } from "@/componentes/estado-vazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { definirCategoriaAcao } from "../acoes/conversas";
import type { ConversaNaTela } from "../servicos/conversas";

export const ROTULO_CATEGORIA = { aluno: "Aluno", lead: "Lead", equipe: "Equipe", pessoal: "Pessoal", outro: "Outro" } as const;

export type LinhaConversa = Omit<ConversaNaTela, "ultimaMensagemEm"> & { ultimaMensagemEm: string | null };

export function ListaConversas({
  conversas,
  numeros,
  numeroId,
  categoria,
}: {
  conversas: LinhaConversa[];
  numeros: { id: string; nome: string }[];
  numeroId: string;
  categoria: string;
}) {
  const router = useRouter();
  const [pendente, executar] = useTransition();

  const filtrar = (n: string, c: string) => {
    const q = new URLSearchParams();
    if (n) q.set("numero", n);
    if (c) q.set("categoria", c);
    router.push(`/whatsapp/conversas${q.size ? `?${q}` : ""}`);
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3 text-sm">
        <label className="grid gap-1">
          Número
          <select
            className="bg-background h-8 rounded-md border px-2"
            value={numeroId}
            onChange={(e) => filtrar(e.target.value, categoria)}
          >
            <option value="">Todos</option>
            {numeros.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Categoria
          <select
            className="bg-background h-8 rounded-md border px-2"
            value={categoria}
            onChange={(e) => filtrar(numeroId, e.target.value)}
          >
            <option value="">Todas</option>
            {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {conversas.length === 0 ? (
        <EstadoVazio
          icone={MessageCircleIcon}
          titulo="Nenhuma conversa por aqui"
          descricao="As conversas aparecem quando um número conectado troca mensagens."
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Última mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/whatsapp/conversas/${c.id}`} className="underline-offset-4 hover:underline">
                      {c.nome}
                    </Link>
                  </TableCell>
                  <TableCell>{c.numero ?? "—"}</TableCell>
                  <TableCell>
                    <select
                      aria-label={`Categoria da conversa com ${c.nome}`}
                      className="bg-background h-8 rounded-md border px-2"
                      value={c.categoria}
                      disabled={pendente}
                      onChange={(e) => {
                        const nova = e.target.value;
                        if (nova === "pessoal" && !confirm("As mensagens guardadas desta conversa serão apagadas e as próximas não serão salvas.")) return;
                        executar(async () => {
                          avisar(await definirCategoriaAcao(c.id, nova));
                          router.refresh();
                        });
                      }}
                    >
                      {Object.entries(ROTULO_CATEGORIA).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>
                          {rotulo}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{c.ultimaMensagemEm ? formatarDataHora(new Date(c.ultimaMensagemEm)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
