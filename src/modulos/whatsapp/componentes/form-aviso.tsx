"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { aprovarAvisoAcao, aprovarTodosAcao, cancelarAvisoAcao, salvarAvisoAcao } from "../acoes/avisos";
import { MAX_GRUPOS_POR_AVISO, MAX_TEXTO_AVISO } from "../regras/avisos";

export type GrupoOpcao = { id: string; nome: string };

export type DadosFormAviso = {
  id?: string;
  texto: string;
  /** `YYYY-MM-DDTHH:MM`, horário de São Paulo. */
  agendadoPara: string;
  grupos: string[];
  situacao?: "rascunho" | "aprovado";
};

type Estado = { ok: boolean; mensagem?: string; erros?: Record<string, string[] | undefined>; vez: number } | null;

/** Formulário de um aviso: texto, data e hora, grupos (com busca no cliente) e botões Salvar / Aprovar / Cancelar. */
export function FormAviso({ aviso, grupos, aoConcluir }: { aviso: DadosFormAviso; grupos: GrupoOpcao[]; aoConcluir?: () => void }) {
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set(aviso.grupos));
  const [texto, setTexto] = useState(aviso.texto);
  const [agendadoPara, setAgendadoPara] = useState(aviso.agendadoPara);
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();

  const [estado, acao, pendente] = useActionState<Estado, FormData>(async (anterior, dados) => {
    const intencao = String(dados.get("intencao") ?? "salvar");
    const vez = (anterior?.vez ?? 0) + 1;
    if (intencao === "cancelar" && aviso.id) {
      const r = await cancelarAvisoAcao(aviso.id);
      return { ...r, vez };
    }
    const salvo = await salvarAvisoAcao({
      id: aviso.id,
      texto: String(dados.get("texto") ?? ""),
      agendadoPara: String(dados.get("agendadoPara") ?? ""),
      grupos: dados.getAll("grupos").map(String),
    });
    if (!salvo.ok || intencao !== "aprovar") return { ...salvo, vez };
    const id = salvo.dados?.id;
    if (!id) return { ok: false, mensagem: "Não foi possível aprovar o aviso.", vez };
    return { ...(await aprovarAvisoAcao(id)), vez };
  }, null);

  const ultima = useRef(0);
  useEffect(() => {
    if (!estado || estado.vez === ultima.current) return;
    ultima.current = estado.vez;
    if (estado.ok || estado.mensagem) avisar(estado);
    else if (estado.erros) avisar({ ok: false, mensagem: Object.values(estado.erros).flat().find(Boolean) });
    if (estado.ok) aoConcluir?.();
  }, [estado, aoConcluir]);

  const alternar = (id: string, marcado: boolean) =>
    setEscolhidos((atual) => {
      const novo = new Set(atual);
      if (marcado) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  return (
    <form action={acao} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        Texto do aviso
        <textarea
          name="texto"
          required
          rows={6}
          maxLength={MAX_TEXTO_AVISO}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Data e hora do envio (horário de São Paulo)
        <Input type="datetime-local" name="agendadoPara" required value={agendadoPara} onChange={(e) => setAgendadoPara(e.target.value)} className="w-64" />
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm">
          Grupos ({escolhidos.size} de até {MAX_GRUPOS_POR_AVISO})
        </legend>
        <Input type="search" placeholder="Buscar grupo" aria-label="Buscar grupo" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-xs" />
        {grupos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum grupo monitorado. Ative o monitoramento em Grupos.</p>
        ) : (
          <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
            {grupos.map((g) => (
              <label key={g.id} className={termo !== "" && !g.nome.toLowerCase().includes(termo) ? "hidden" : "flex items-center gap-2 text-sm"}>
                <input type="checkbox" name="grupos" value={g.id} checked={escolhidos.has(g.id)} onChange={(e) => alternar(g.id, e.target.checked)} />
                {g.nome}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="intencao" value="salvar" size="sm" disabled={pendente}>
          Salvar
        </Button>
        {aviso.situacao !== "aprovado" && (
          <Button type="submit" name="intencao" value="aprovar" size="sm" variant="secondary" disabled={pendente}>
            Aprovar
          </Button>
        )}
        {aviso.id && (
          <Button type="submit" name="intencao" value="cancelar" size="sm" variant="outline" formNoValidate
            disabled={pendente}
            onClick={(e) => {
              if (!window.confirm("Cancelar este aviso? Ele não será enviado.")) e.preventDefault();
            }}
          >
            Cancelar aviso
          </Button>
        )}
      </div>
      {aviso.situacao === "aprovado" && (
        <p className="text-muted-foreground text-xs">Ao salvar, o aviso volta para rascunho e precisa ser aprovado de novo.</p>
      )}
    </form>
  );
}

/** Botão "Novo aviso": abre o formulário vazio no topo da lista. */
export function NovoAviso({ grupos, sugestao }: { grupos: GrupoOpcao[]; sugestao: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <Button size="sm" onClick={() => setAberto(true)}>
        Novo aviso
      </Button>
    );
  }
  return (
    <div className="w-full rounded-lg border p-4">
      <p className="mb-3 text-sm font-medium">Novo aviso</p>
      <FormAviso aviso={{ texto: "", agendadoPara: sugestao, grupos: [] }} grupos={grupos} aoConcluir={() => setAberto(false)} />
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAberto(false)}>
        Fechar
      </Button>
    </div>
  );
}

/** Aprova de uma vez os rascunhos da semana; mostra os recusados com o motivo. */
export function AprovarTodos({ de, ate, titulos }: { de: string; ate: string; titulos: Record<string, string> }) {
  const [pendente, executar] = useTransition();
  const [recusados, setRecusados] = useState<{ id: string; motivo: string }[]>([]);
  return (
    <div className="grid gap-2">
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={pendente}
          onClick={() =>
            executar(async () => {
              const r = await aprovarTodosAcao({ de, ate });
              avisar(r);
              setRecusados(r.dados?.recusados ?? []);
            })
          }
        >
          Aprovar todos os rascunhos da semana
        </Button>
      </div>
      {recusados.length > 0 && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Não foram aprovados:</p>
          <ul className="list-disc pl-5">
            {recusados.map((r) => (
              <li key={r.id}>
                {titulos[r.id] ?? "Aviso"}: {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
