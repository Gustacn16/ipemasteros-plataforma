import { formatarDataHora } from "@/lib/datas";
import type { MensagemNaTela } from "../servicos/conversas";

export function MensagensConversa({ mensagens }: { mensagens: MensagemNaTela[] }) {
  if (mensagens.length === 0) {
    return <p className="text-muted-foreground text-sm">Nenhuma mensagem guardada.</p>;
  }
  return (
    <ol className="bg-card grid gap-3 rounded-xl border p-4">
      {mensagens.map((m) => (
        <li key={m.id} className={m.deMim ? "justify-self-end text-right" : "justify-self-start"}>
          <div className="text-muted-foreground text-xs">
            {m.autor} · {formatarDataHora(m.enviadaEm)}
          </div>
          <p className="bg-muted max-w-prose rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words">{m.texto || "—"}</p>
        </li>
      ))}
    </ol>
  );
}
