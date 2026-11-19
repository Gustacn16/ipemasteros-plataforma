"use client";

import { EyeIcon, PencilLineIcon, SaveIcon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { publicarDocumentoAcao, salvarDocumentoAcao } from "../acoes/processos";
import { AJUDA_TIPO_DOCUMENTO, ROTULO_TIPO_DOCUMENTO, TIPOS_DOCUMENTO, type TipoDocumento } from "../esquemas/processos";
import type { Etapa } from "../regras/fluxo";
import { chaveTitulo, substituirLigacoes } from "../regras/ligacoes";
import type { DocumentoEdicao } from "../servicos/documentos";
import { EditorFluxo } from "./editor-fluxo";
import { TextoProcesso } from "./texto-processo";

type Estado = { ok: boolean; mensagem?: string; erros?: Record<string, string[] | undefined> };
type Opcao = { valor: string; rotulo: string };

const estilo = "border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="bg-card grid gap-4 rounded-2xl border p-4 sm:p-6">
      <div>
        <h2 className="text-foreground font-semibold">{titulo}</h2>
        {descricao && <p className="text-muted-foreground text-sm">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, name, erros, children, largo }: { rotulo: string; name: string; erros?: Record<string, string[] | undefined>; children: ReactNode; largo?: boolean }) {
  const e = erros?.[name];
  return (
    <div className={`grid content-start gap-1.5 ${largo ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`d-${name}`}>{rotulo}</Label>
      {children}
      {e && <p className="text-destructive text-sm">{e.join(" ")}</p>}
    </div>
  );
}

export function EditorDocumento({ doc, areas, pessoas }: { doc: DocumentoEdicao; areas: Opcao[]; pessoas: Opcao[] }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoDocumento>(doc.tipo);
  const [fluxo, setFluxo] = useState<Etapa[]>(doc.fluxo);
  const [texto, setTexto] = useState(doc.conteudo ?? "");
  const [previa, setPrevia] = useState(false);
  const [sujo, setSujo] = useState(false);
  const [pendente, setPendente] = useState(doc.alteradoAposPublicar);

  const [estado, salvar, salvando] = useActionState<Estado, FormData>(async (anterior, formData) => {
    const r = await salvarDocumentoAcao(anterior, formData);
    if (r.ok || r.mensagem) avisar(r);
    if (r.ok) {
      setSujo(false);
      setPendente(true);
      router.refresh();
    }
    return r;
  }, { ok: false });
  const [estadoPub, publicar, publicando] = useActionState<Estado, FormData>(async (anterior, formData) => {
    const r = await publicarDocumentoAcao(anterior, formData);
    if (r.ok || r.mensagem) avisar(r);
    if (r.ok) router.push(`/processos/documentos/${doc.id}`);
    return r;
  }, { ok: false });

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  const erros = estado.ok ? undefined : estado.erros;
  const titulosConhecidos = new Set([...doc.outrosTitulos, doc.titulo].map(chaveTitulo));
  // Na prévia o link não navega (fica em #); só mostra se o título existe.
  const textoPrevia = substituirLigacoes(texto, (t) => (titulosConhecidos.has(chaveTitulo(t)) ? "#" : null)).replaceAll("/processos/documentos/#", "#");

  return (
    <div className="grid gap-6">
      <form action={salvar} onChange={() => setSujo(true)} className="grid gap-6">
        <input type="hidden" name="id" value={doc.id} />
        <input type="hidden" name="fluxo" value={JSON.stringify(fluxo)} />
        <input type="hidden" name="conteudo" value={texto} />

        {erros && Object.keys(erros).length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>Confira os campos marcados: {Object.values(erros).flat().join(" ")}</AlertDescription>
          </Alert>
        )}

        <Secao titulo="Sobre o documento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Título" name="titulo" erros={erros} largo>
              <input id="d-titulo" name="titulo" defaultValue={doc.titulo} maxLength={150} required className={`${estilo} text-base font-medium`} />
            </Campo>
            <Campo rotulo="Área" name="areaId" erros={erros}>
              <select id="d-areaId" name="areaId" defaultValue={doc.areaId} className={estilo}>
                {areas.map((a) => (
                  <option key={a.valor} value={a.valor}>
                    {a.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Tipo" name="tipo" erros={erros}>
              <select id="d-tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDocumento)} className={estilo}>
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO_DOCUMENTO[t]} — {AJUDA_TIPO_DOCUMENTO[t]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Resumo (aparece na lista e na busca)" name="resumo" erros={erros} largo>
              <input id="d-resumo" name="resumo" defaultValue={doc.resumo ?? ""} maxLength={300} className={estilo} placeholder="Uma frase sobre o que este documento explica" />
            </Campo>
            <Campo rotulo="Revisar a cada (meses)" name="revisarACadaMeses" erros={erros}>
              <input id="d-revisarACadaMeses" name="revisarACadaMeses" type="number" min={1} max={36} defaultValue={doc.revisarACadaMeses ?? ""} className={estilo} placeholder="Ex.: 6" />
            </Campo>
          </div>
        </Secao>

        {/* Escondida (e não removida) no tipo Documento, para não apagar a ficha ao trocar o tipo sem querer. */}
        <div hidden={tipo !== "processo"}>
          <Secao titulo="Ficha do processo" descricao="O padrão: para que serve, quem responde, e a cadeia fornecedor → entrada → saída → cliente.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Objetivo" name="objetivo" erros={erros} largo>
                <textarea id="d-objetivo" name="objetivo" rows={2} defaultValue={doc.objetivo ?? ""} className={estilo} placeholder="Para que este processo existe" />
              </Campo>
              <Campo rotulo="Dono do processo" name="donoId" erros={erros}>
                <select id="d-donoId" name="donoId" defaultValue={doc.donoId ?? ""} className={estilo}>
                  <option value="">—</option>
                  {pessoas.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Quando acontece" name="frequencia" erros={erros}>
                <input id="d-frequencia" name="frequencia" defaultValue={doc.frequencia ?? ""} maxLength={120} className={estilo} placeholder="Ex.: toda segunda-feira" />
              </Campo>
              {(
                [
                  ["fornecedores", "Fornecedores", "De quem recebemos"],
                  ["entradas", "Entradas", "O que recebemos"],
                  ["saidas", "Saídas", "O que entregamos"],
                  ["clientes", "Clientes", "Para quem entregamos"],
                ] as const
              ).map(([nome, rotulo, dica]) => (
                <Campo key={nome} rotulo={rotulo} name={nome} erros={erros}>
                  <textarea id={`d-${nome}`} name={nome} rows={2} defaultValue={doc[nome] ?? ""} className={estilo} placeholder={dica} />
                </Campo>
              ))}
            </div>
          </Secao>
        </div>

        {tipo === "processo" && (
          <Secao titulo="Fluxo" descricao="Monte as etapas na ordem. Use Decisão para um “sim ou não”. A prévia mostra como o time vai ver.">
            <EditorFluxo
              etapas={fluxo}
              aoMudar={(e) => {
                setFluxo(e);
                setSujo(true);
              }}
            />
          </Secao>
        )}

        <Secao
          titulo={tipo === "processo" ? "Procedimento" : "Texto"}
          descricao="Use ## para títulos, - para listas e **negrito**. Para citar outro documento, escreva o título entre colchetes duplos: [[Captura de lead]]."
        >
          <div className="flex gap-1">
            <Button type="button" size="sm" variant={previa ? "ghost" : "secondary"} onClick={() => setPrevia(false)}>
              <PencilLineIcon /> Escrever
            </Button>
            <Button type="button" size="sm" variant={previa ? "secondary" : "ghost"} onClick={() => setPrevia(true)}>
              <EyeIcon /> Prévia
            </Button>
          </div>
          {previa ? (
            <div className="min-h-64 rounded-lg border p-4 sm:p-6">{texto.trim() ? <TextoProcesso texto={textoPrevia} /> : <p className="text-muted-foreground text-sm">Nada escrito ainda.</p>}</div>
          ) : (
            <textarea
              aria-label="Texto do documento"
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setSujo(true);
              }}
              rows={18}
              className={`${estilo} font-mono text-[0.85rem] leading-6`}
            />
          )}
          {doc.outrosTitulos.length > 0 && (
            <details className="text-sm">
              <summary className="text-primary cursor-pointer">Documentos que você pode citar</summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {doc.outrosTitulos.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTexto((v) => `${v}${v && !v.endsWith(" ") && !v.endsWith("\n") ? " " : ""}[[${t}]]`);
                      setSujo(true);
                    }}
                    className="bg-muted hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-0.5 text-xs"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </details>
          )}
        </Secao>

        <div className="bg-background/95 sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border-t px-1 py-3 backdrop-blur">
          <Button type="submit" disabled={salvando}>
            <SaveIcon /> {salvando ? "Salvando…" : "Salvar rascunho"}
          </Button>
          <span className="text-muted-foreground text-sm">{sujo ? "Alterações não salvas." : pendente ? "Rascunho salvo, ainda não publicado." : "Tudo publicado."}</span>
        </div>
      </form>

      <Secao titulo="Publicar" descricao={`Publicar cria a versão ${doc.versaoPublicada + 1}. O time passa a ver esta versão e a anterior fica no histórico.`}>
        <form action={publicar} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <input type="hidden" name="id" value={doc.id} />
          <div className="grid gap-1.5">
            <Label htmlFor="p-nota">O que mudou nesta versão?</Label>
            <input id="p-nota" name="nota" required minLength={3} maxLength={300} className={estilo} placeholder={doc.versaoPublicada === 0 ? "Primeira versão" : "Ex.: incluí a etapa de qualificação"} />
            {!estadoPub.ok && estadoPub.erros?.nota && <p className="text-destructive text-sm">{estadoPub.erros.nota.join(" ")}</p>}
          </div>
          <Button type="submit" disabled={publicando || sujo || !pendente} title={sujo ? "Salve o rascunho antes de publicar" : undefined}>
            <SendIcon /> {publicando ? "Publicando…" : "Publicar"}
          </Button>
        </form>
        {sujo && <p className="text-atencao text-sm">Salve o rascunho antes de publicar.</p>}
      </Secao>
    </div>
  );
}
