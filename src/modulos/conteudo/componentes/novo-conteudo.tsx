"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/componentes/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/componentes/ui/dialog";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarConteudoAcao } from "../acoes/conteudo";
import type { FiltroConteudo } from "../esquemas/conteudo";
import { ROTULO_ETAPA, type Etapa } from "../regras/etapas";
import { SeletorCanalFormato, TambemPublicarEm, type ContaComCanais } from "./seletor-formato";

const estiloCampo = "border-input bg-background h-9 w-full min-w-0 rounded-md border px-2 text-sm";

/** Valores que já vêm preenchidos: a coluna do quadro (etapa) ou o dia do calendário (data). */
type Padrao = { etapa?: Etapa; dataPublicacao?: string };
const Contexto = createContext<((p?: Padrao) => void) | null>(null);

/** Abre a janela de novo conteúdo de qualquer tela do módulo. */
export function useNovoConteudo() {
  const abrir = useContext(Contexto);
  if (!abrir) throw new Error("useNovoConteudo fora do ProvedorNovoConteudo");
  return abrir;
}

/** Fica no layout do Conteúdo: uma janela só, aberta pelos botões das telas ou pela tecla N. */
export function ProvedorNovoConteudo({ contas, filtro, children }: { contas: ContaComCanais[]; filtro: FiltroConteudo; children: ReactNode }) {
  const [padrao, setPadrao] = useState<Padrao | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo?.closest("input, textarea, select, [contenteditable='true']");
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey && !digitando) {
        e.preventDefault();
        setPadrao({});
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  return (
    <Contexto.Provider value={(p) => setPadrao(p ?? {})}>
      {children}
      <Dialog open={padrao !== null} onOpenChange={(sim) => !sim && setPadrao(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo conteúdo</DialogTitle>
            <DialogDescription>
              {padrao?.etapa && padrao.etapa !== "ideia"
                ? `Entra direto em ${ROTULO_ETAPA[padrao.etapa]}.`
                : "Começa como ideia. O resto você completa no conteúdo."}{" "}
              Atalho: tecla N.
            </DialogDescription>
          </DialogHeader>
          {padrao !== null &&
            (contas.every((c) => c.canais.length === 0) ? (
              <p className="text-sm">Antes, cadastre pelo menos uma conta com seus canais (engrenagem em Contas).</p>
            ) : (
              <Formulario contas={contas} filtro={filtro} padrao={padrao} fechar={() => setPadrao(null)} />
            ))}
        </DialogContent>
      </Dialog>
    </Contexto.Provider>
  );
}

/** Canal e formato iniciais: os do filtro atual, senão o primeiro canal da conta filtrada (ou de todas). */
function inicial(contas: ContaComCanais[], f: FiltroConteudo) {
  const canais = contas.filter((c) => !f.marca || c.id === f.marca).flatMap((c) => c.canais.filter((k) => k.ativo));
  const peloFormato = f.formato ? canais.find((k) => k.formatos.some((x) => x.id === f.formato && x.ativo)) : undefined;
  const canal = peloFormato ?? canais.find((k) => k.id === f.canal) ?? canais[0] ?? contas.flatMap((c) => c.canais).find((k) => k.ativo);
  const formatoId = peloFormato ? f.formato! : (canal?.formatos.find((x) => x.ativo)?.id ?? "");
  return { canalId: canal?.id ?? "", formatoId };
}

function Formulario({
  contas,
  filtro,
  padrao,
  fechar,
}: {
  contas: ContaComCanais[];
  filtro: FiltroConteudo;
  padrao: Padrao;
  fechar: () => void;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [escolha, setEscolha] = useState(() => inicial(contas, filtro));
  const [extras, setExtras] = useState<string[]>([]);
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState(padrao.dataPublicacao ?? "");
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  const campoTitulo = useRef<HTMLInputElement>(null);
  const conta = contas.find((c) => c.canais.some((k) => k.id === escolha.canalId));

  function criar(outro: boolean) {
    iniciar(async () => {
      const r = await criarConteudoAcao({
        titulo,
        formatoId: escolha.formatoId,
        canalIds: extras,
        dataPublicacao: data,
        etapa: padrao.etapa ?? "ideia",
      });
      setErros(r.erros ?? {});
      if (r.erros || !avisar(r) || !r.dados) return;
      if (outro) {
        // Continua na janela com o mesmo canal, formato e data: só troca o título.
        setTitulo("");
        router.refresh();
        campoTitulo.current?.focus();
      } else {
        fechar();
        router.push(`/conteudo/itens/${r.dados.id}`);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        criar(false);
      }}
      className="grid gap-4"
    >
      <SeletorCanalFormato
        contas={contas}
        canalId={escolha.canalId}
        formatoId={escolha.formatoId}
        aoMudar={(v) => {
          // Outra conta: os canais extras eram da conta anterior.
          if (!conta?.canais.some((k) => k.id === v.canalId)) setExtras([]);
          setEscolha(v);
        }}
        idPrefixo="novo"
      />
      {erros.formatoId && <p className="text-destructive text-sm">{erros.formatoId.join(" ")}</p>}
      <div className="grid gap-1.5">
        <Label htmlFor="novo-titulo">Título</Label>
        <Input
          ref={campoTitulo}
          id="novo-titulo"
          required
          maxLength={200}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: 3 erros na prova de residência"
        />
        {erros.titulo && <p className="text-destructive text-sm">{erros.titulo.join(" ")}</p>}
      </div>
      {conta && (
        <TambemPublicarEm
          canais={conta.canais}
          principal={escolha.canalId}
          marcados={extras.filter((x) => x !== escolha.canalId)}
          aoMudar={setExtras}
        />
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="novo-data">Publicação prevista (opcional)</Label>
        <input id="novo-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={estiloCampo} />
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <Button type="button" variant="outline" disabled={pendente || !escolha.formatoId} onClick={() => criar(true)}>
          Criar e adicionar outro
        </Button>
        <Button type="submit" disabled={pendente || !escolha.formatoId}>
          {pendente ? "Criando…" : "Criar conteúdo"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Botão que abre a janela de novo conteúdo. `icone` é o + pequeno das colunas e dos dias. */
export function BotaoNovoConteudo({
  etapa,
  dataPublicacao,
  icone,
  rotulo = "Novo conteúdo",
  className,
}: Padrao & { icone?: boolean; rotulo?: string; className?: string }) {
  const abrir = useNovoConteudo();
  if (icone)
    return (
      <button
        type="button"
        onClick={() => abrir({ etapa, dataPublicacao })}
        aria-label={rotulo}
        title={rotulo}
        className={cn(
          "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-6 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none",
          className,
        )}
      >
        <PlusIcon className="size-4" aria-hidden />
      </button>
    );
  return (
    <Button size="sm" className={className} onClick={() => abrir({ etapa, dataPublicacao })}>
      <PlusIcon /> {rotulo}
    </Button>
  );
}
