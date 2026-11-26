"use client";

import { GripVerticalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { salvarRoteiroAcao } from "../acoes/conteudo";
import {
  type Bloco,
  ROTULO_BLOCO,
  TIPOS_BLOCO,
  type TipoBloco,
  atalhoDoBloco,
  escreverBlocos,
  lerBlocos,
  novoBloco,
} from "../regras/blocos";

/** Espera depois da última tecla antes de salvar. */
const ESPERA_SALVAR_MS = 1000;
type Situacao = "salvo" | "pendente" | "salvando" | "erro";
const TEXTO_SITUACAO: Record<Situacao, string> = { salvo: "Salvo", pendente: "Alterado", salvando: "Salvando…", erro: "Não salvou" };
const ESTILO_TEXTO: Partial<Record<TipoBloco, string>> = {
  titulo: "text-lg font-semibold",
  texto: "text-sm",
  lista: "text-sm",
  tarefa: "text-sm",
};

/** Menu de tipos: o "/" num bloco vazio e o botão ao lado de cada bloco. */
function MenuTipos({ aoEscolher, aoExcluir, fechar }: { aoEscolher: (t: TipoBloco) => void; aoExcluir?: () => void; fechar: () => void }) {
  const [ativo, setAtivo] = useState(0);
  const opcoes = [
    ...TIPOS_BLOCO.map((t) => ({ rotulo: ROTULO_BLOCO[t], agir: () => aoEscolher(t) })),
    ...(aoExcluir ? [{ rotulo: "Excluir bloco", agir: aoExcluir }] : []),
  ];
  const lista = useRef<HTMLUListElement>(null);
  useEffect(() => lista.current?.focus(), []);
  return (
    <ul
      ref={lista}
      role="menu"
      tabIndex={-1}
      aria-label="Tipo do bloco"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") setAtivo((a) => (a + 1) % opcoes.length);
        else if (e.key === "ArrowUp") setAtivo((a) => (a - 1 + opcoes.length) % opcoes.length);
        else if (e.key === "Enter") opcoes[ativo]!.agir();
        else if (e.key === "Escape") fechar();
        else return;
        e.preventDefault();
      }}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && fechar()}
      className="bg-popover text-popover-foreground absolute top-full left-0 z-20 mt-1 grid w-44 gap-0.5 rounded-md border p-1 shadow-md focus:outline-none"
    >
      {opcoes.map((o, i) => (
        <li key={o.rotulo} role="none">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={o.agir}
            onMouseEnter={() => setAtivo(i)}
            className={cn(
              "w-full rounded px-2 py-1 text-left text-sm",
              i === ativo && "bg-muted",
              o.rotulo === "Excluir bloco" && "text-destructive",
            )}
          >
            {o.rotulo}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Anotações e roteiro, num editor livre de blocos (texto, título, lista, checklist e divisória).
 * "/" num bloco vazio escolhe o tipo; "# ", "- ", "[] " e "---" também funcionam. Salva sozinho.
 */
export function EditorBlocos({ conteudoId, roteiro }: { conteudoId: string; roteiro: string | null }) {
  const router = useRouter();
  const [blocos, setBlocos] = useState<Bloco[]>(() => lerBlocos(roteiro));
  const [menu, setMenu] = useState<{ id: string; origem: "barra" | "alca" } | null>(null);
  const [situacao, setSituacao] = useState<Situacao>("salvo");
  const campos = useRef(new Map<string, HTMLTextAreaElement>());
  const foco = useRef<{ id: string; posicao: number | "fim" } | null>(null);
  const salvoPor = useRef(escreverBlocos(lerBlocos(roteiro)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Última versão dos blocos, para o salvamento que roda depois da espera.
  const atual = useRef(blocos);

  const salvar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const texto = escreverBlocos(atual.current);
    if (texto === salvoPor.current) return setSituacao("salvo");
    setSituacao("salvando");
    const r = await salvarRoteiroAcao({ conteudoId, roteiro: texto ?? "" });
    if (!r.ok) {
      setSituacao("erro");
      return void avisar(r);
    }
    salvoPor.current = texto;
    setSituacao(escreverBlocos(atual.current) === texto ? "salvo" : "pendente");
    if (r.dados?.voltouParaRevisao) {
      avisar({ ok: true, mensagem: "O texto mudou, então o conteúdo voltou para edição." });
      router.refresh();
    }
  }, [conteudoId, router]);

  // Salva ao sair da página com alteração pendente.
  useEffect(() => {
    const sair = () => timer.current && void salvar();
    window.addEventListener("pagehide", sair);
    return () => {
      window.removeEventListener("pagehide", sair);
      sair();
    };
  }, [salvar]);

  // Coloca o cursor no bloco pedido depois de criar, juntar ou apagar blocos.
  useEffect(() => {
    if (!foco.current) return;
    const campo = campos.current.get(foco.current.id);
    if (campo) {
      const p = foco.current.posicao === "fim" ? campo.value.length : foco.current.posicao;
      campo.focus();
      campo.setSelectionRange(p, p);
    }
    foco.current = null;
  });

  function mudar(proximos: Bloco[], focar?: { id: string; posicao: number | "fim" }) {
    if (focar) foco.current = focar;
    const lista = proximos.length ? proximos : [novoBloco()];
    atual.current = lista;
    setBlocos(lista);
    setSituacao("pendente");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void salvar(), ESPERA_SALVAR_MS);
  }

  const alterar = (id: string, dados: Partial<Bloco>) => mudar(blocos.map((b) => (b.id === id ? { ...b, ...dados } : b)));

  function escolherTipo(id: string, tipo: TipoBloco) {
    setMenu(null);
    const i = blocos.findIndex((b) => b.id === id);
    const bloco = blocos[i]!;
    // Com "/" o texto era só a barra: o bloco fica vazio.
    const texto = tipo === "divisoria" ? "" : bloco.texto === "/" ? "" : bloco.texto;
    const proximos = blocos.map((b) => (b.id === id ? { ...b, tipo, texto } : b));
    if (tipo === "divisoria") {
      // Depois da divisória, um bloco de texto para continuar escrevendo.
      const seguinte = proximos[i + 1] ?? novoBloco();
      if (!proximos[i + 1]) proximos.push(seguinte);
      return mudar(proximos, { id: seguinte.id, posicao: 0 });
    }
    mudar(proximos, { id, posicao: "fim" });
  }

  function excluir(id: string) {
    setMenu(null);
    const i = blocos.findIndex((b) => b.id === id);
    const anterior = blocos[i - 1] ?? blocos[i + 1];
    mudar(
      blocos.filter((b) => b.id !== id),
      anterior ? { id: anterior.id, posicao: "fim" } : undefined,
    );
  }

  function teclas(e: KeyboardEvent<HTMLTextAreaElement>, bloco: Bloco, i: number) {
    const campo = e.currentTarget;
    const inicio = campo.selectionStart === 0 && campo.selectionEnd === 0;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      // Lista ou checklist vazia + Enter: sai da lista.
      if ((bloco.tipo === "lista" || bloco.tipo === "tarefa") && !bloco.texto) return alterar(bloco.id, { tipo: "texto" });
      const antes = bloco.texto.slice(0, campo.selectionStart);
      const depois = bloco.texto.slice(campo.selectionEnd);
      const tipo: TipoBloco = bloco.tipo === "lista" || bloco.tipo === "tarefa" ? bloco.tipo : "texto";
      const novo = novoBloco(tipo, depois);
      const proximos = [...blocos];
      proximos.splice(i, 1, { ...bloco, texto: antes }, novo);
      return mudar(proximos, { id: novo.id, posicao: 0 });
    }
    if (e.key === "Backspace" && inicio) {
      if (bloco.tipo !== "texto") {
        e.preventDefault();
        return alterar(bloco.id, { tipo: "texto" });
      }
      const anterior = blocos[i - 1];
      if (!anterior) return;
      e.preventDefault();
      if (anterior.tipo === "divisoria")
        return mudar(
          blocos.filter((b) => b.id !== anterior.id),
          { id: bloco.id, posicao: 0 },
        );
      // Junta com o bloco de cima, com o cursor no ponto da junção.
      const proximos = blocos
        .filter((b) => b.id !== bloco.id)
        .map((b) => (b.id === anterior.id ? { ...b, texto: b.texto + bloco.texto } : b));
      return mudar(proximos, { id: anterior.id, posicao: anterior.texto.length });
    }
    if (e.key === "ArrowUp" && inicio && i > 0) {
      e.preventDefault();
      const alvo = blocos.slice(0, i).findLast((b) => b.tipo !== "divisoria");
      if (alvo) campos.current.get(alvo.id)?.focus();
    }
    if (e.key === "ArrowDown" && campo.selectionStart === campo.value.length) {
      const alvo = blocos.slice(i + 1).find((b) => b.tipo !== "divisoria");
      if (alvo) {
        e.preventDefault();
        const c = campos.current.get(alvo.id);
        c?.focus();
        c?.setSelectionRange(0, 0);
      }
    }
  }

  function digitar(bloco: Bloco, valor: string) {
    if (bloco.tipo === "texto") {
      if (valor === "/") {
        setMenu({ id: bloco.id, origem: "barra" });
        return alterar(bloco.id, { texto: valor });
      }
      const atalho = atalhoDoBloco(valor);
      if (atalho) return atalho.tipo === "divisoria" ? escolherTipo(bloco.id, "divisoria") : alterar(bloco.id, atalho);
    }
    if (menu?.id === bloco.id && menu.origem === "barra") setMenu(null);
    alterar(bloco.id, { texto: valor });
  }

  const ultimo = blocos.at(-1);
  return (
    <div
      className="grid gap-1"
      onBlur={(e) => {
        // Saiu do editor (ex.: foi clicar em Salvar): salva já, sem esperar.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && timer.current) void salvar();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Escreva livre. <kbd className="rounded border px-1">/</kbd> num bloco vazio escolhe o tipo: título, lista, checklist, divisória.
        </p>
        <p className={cn("text-xs", situacao === "erro" ? "text-destructive" : "text-muted-foreground")} role="status">
          {TEXTO_SITUACAO[situacao]}
        </p>
      </div>
      <div className="bg-card grid gap-0.5 rounded-xl border px-2 py-3 sm:px-3">
        {blocos.map((bloco, i) => (
          <div key={bloco.id} className="group/bloco relative flex min-w-0 items-start gap-1">
            <div className="relative shrink-0">
              <button
                type="button"
                aria-label="Mudar o tipo ou excluir o bloco"
                onClick={() => setMenu(menu?.id === bloco.id ? null : { id: bloco.id, origem: "alca" })}
                className="text-muted-foreground hover:bg-muted mt-1 rounded p-0.5 opacity-0 group-hover/bloco:opacity-100 focus-visible:opacity-100"
              >
                <GripVerticalIcon className="size-4" aria-hidden />
              </button>
              {menu?.id === bloco.id && menu.origem === "alca" && (
                <MenuTipos aoEscolher={(t) => escolherTipo(bloco.id, t)} aoExcluir={() => excluir(bloco.id)} fechar={() => setMenu(null)} />
              )}
            </div>
            {bloco.tipo === "divisoria" ? (
              <div className="flex min-h-7 flex-1 items-center">
                <hr className="w-full" />
                <button
                  type="button"
                  aria-label="Excluir divisória"
                  onClick={() => excluir(bloco.id)}
                  className="text-muted-foreground hover:text-destructive ml-1 opacity-0 group-hover/bloco:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2Icon className="size-3.5" aria-hidden />
                </button>
              </div>
            ) : (
              <div className="relative flex min-w-0 flex-1 items-start gap-2">
                {bloco.tipo === "lista" && (
                  <span className="text-muted-foreground mt-1.5 leading-5 select-none" aria-hidden>
                    •
                  </span>
                )}
                {bloco.tipo === "tarefa" && (
                  <input
                    type="checkbox"
                    aria-label={`Feito: ${bloco.texto || "item"}`}
                    checked={bloco.feito}
                    onChange={(e) => alterar(bloco.id, { feito: e.target.checked })}
                    className="accent-primary mt-2 size-4 shrink-0"
                  />
                )}
                <textarea
                  ref={(el) => {
                    if (el) campos.current.set(bloco.id, el);
                    else campos.current.delete(bloco.id);
                  }}
                  rows={1}
                  value={bloco.texto}
                  aria-label={ROTULO_BLOCO[bloco.tipo]}
                  placeholder={
                    i === 0 && blocos.length === 1
                      ? "Comece a escrever, ou digite / para escolher o tipo…"
                      : bloco.tipo === "titulo"
                        ? "Título"
                        : ""
                  }
                  onChange={(e) => digitar(bloco, e.target.value)}
                  onKeyDown={(e) => teclas(e, bloco, i)}
                  className={cn(
                    "placeholder:text-muted-foreground/70 w-full min-w-0 resize-none bg-transparent py-1 leading-6 [field-sizing:content] focus:outline-none",
                    ESTILO_TEXTO[bloco.tipo],
                    bloco.tipo === "tarefa" && bloco.feito && "text-muted-foreground line-through",
                  )}
                />
                {menu?.id === bloco.id && menu.origem === "barra" && (
                  <MenuTipos aoEscolher={(t) => escolherTipo(bloco.id, t)} fechar={() => setMenu(null)} />
                )}
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            // Último bloco vazio de texto: só leva o cursor até ele.
            if (ultimo && ultimo.tipo === "texto" && !ultimo.texto) return campos.current.get(ultimo.id)?.focus();
            const novo = novoBloco();
            mudar([...blocos, novo], { id: novo.id, posicao: 0 });
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-muted mt-1 flex items-center gap-1 justify-self-start rounded px-2 py-1 text-xs"
        >
          <PlusIcon className="size-3.5" aria-hidden /> Adicionar bloco
        </button>
      </div>
    </div>
  );
}
