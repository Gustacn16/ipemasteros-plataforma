// Lista de cartões da aba Leads, renderizada no servidor.
import type { ItemLead } from "../servicos/leads";
import { AvaliacaoConversa } from "./avaliacao-conversa";

export function ListaLeads({ itens }: { itens: ItemLead[] }) {
  if (itens.length === 0) return <p className="text-muted-foreground text-sm">Nenhuma avaliação de lead neste dia.</p>;
  return (
    <div className="grid gap-3">
      {itens.map((i) => (
        <AvaliacaoConversa key={i.avaliacaoId} item={i} />
      ))}
    </div>
  );
}
