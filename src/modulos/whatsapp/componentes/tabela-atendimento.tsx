// Partes do painel de atendimento renderizadas no servidor (sem "use client").
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/componentes/ui/table";
import { formatarDataHora } from "@/lib/datas";
import type { RegrasAtendimento } from "../esquemas/regras-atendimento";
import { formatarDuracao, textoDoHorario } from "../regras/horario";
import { ROTULO_TIME } from "../regras/time";
import type { ItemSemResposta, LinhaAtendimento } from "../servicos/painel-atendimento";

const pct = (valor: number | null) => (valor === null ? "—" : `${valor}%`);

export function TabelaAtendimento({
  linhas,
  semana,
  numeroSelecionado,
}: {
  linhas: LinhaAtendimento[];
  semana: string;
  numeroSelecionado: string | null;
}) {
  if (linhas.length === 0) return <p className="text-muted-foreground text-sm">Nenhum número cadastrado.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Número</TableHead>
          <TableHead>Time</TableHead>
          <TableHead className="text-right">Conversas-dia</TableHead>
          <TableHead className="text-right">1ª resposta</TableHead>
          <TableHead className="text-right">Resposta</TableHead>
          <TableHead className="text-right">No SLA</TableHead>
          <TableHead className="text-right">Follow-up</TableHead>
          <TableHead className="text-right">Sem resposta agora</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {linhas.map((l) => (
          <TableRow key={l.numeroId} data-state={l.numeroId === numeroSelecionado ? "selected" : undefined}>
            <TableCell>
              <Link
                href={`/whatsapp/atendimento?semana=${semana}&numero=${l.numeroId}`}
                aria-current={l.numeroId === numeroSelecionado ? "true" : undefined}
                className="font-medium underline-offset-4 hover:underline"
              >
                {l.nome}
              </Link>
              {l.dono && <span className="text-muted-foreground block text-xs">{l.dono}</span>}
            </TableCell>
            <TableCell>{ROTULO_TIME[l.time]}</TableCell>
            <TableCell className="text-right">{l.conversas}</TableCell>
            <TableCell className="text-right">{formatarDuracao(l.primeiraRespostaSeg)}</TableCell>
            <TableCell className="text-right">{formatarDuracao(l.respostaSeg)}</TableCell>
            <TableCell className="text-right">{pct(l.noSlaPct)}</TableCell>
            <TableCell className="text-right">{pct(l.followupPct)}</TableCell>
            <TableCell className="text-right">{l.semRespostaAgora}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ListaSemResposta({ itens, mostrarNumero }: { itens: ItemSemResposta[]; mostrarNumero: boolean }) {
  if (itens.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma conversa esperando resposta além do prazo.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contato</TableHead>
          {mostrarNumero && <TableHead>Número</TableHead>}
          <TableHead>Desde</TableHead>
          <TableHead className="text-right">Esperando</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="tabular-nums">
        {itens.map((i) => (
          <TableRow key={i.conversaId}>
            <TableCell>
              <Link href={`/whatsapp/conversas/${i.conversaId}`} className="font-medium underline-offset-4 hover:underline">
                {i.contatoNome}
              </Link>
            </TableCell>
            {mostrarNumero && <TableCell>{i.numeroNome}</TableCell>}
            <TableCell>{formatarDataHora(i.desde)}</TableCell>
            <TableCell className="text-right">{formatarDuracao(i.segundos)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** As regras em texto, para quem não pode editar. */
export function TextoRegras({ regras }: { regras: RegrasAtendimento }) {
  return (
    <div className="grid gap-3 text-sm">
      <ul className="grid gap-0.5">
        {textoDoHorario(regras.horario).map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      <p>Prazo de resposta (SLA): {regras.slaMinutos} min, contados só dentro do horário.</p>
      <p>
        Follow-up devido {regras.followupHoras} h depois da última mensagem da empresa, com prazo de {regras.followupDias}{" "}
        {regras.followupDias === 1 ? "dia" : "dias"}.
      </p>
    </div>
  );
}
