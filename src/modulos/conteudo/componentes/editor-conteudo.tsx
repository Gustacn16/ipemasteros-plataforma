"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { valorInputData } from "@/modulos/tarefas/componentes/exibicao";
import { atualizarConteudoAcao, excluirConteudoAcao } from "../acoes/conteudo";
import { SeletorCanalFormato, TambemPublicarEm, type ContaComCanais } from "./seletor-formato";

const estiloCampo = "border-input bg-background w-full min-w-0 rounded-md border px-2 py-1.5 text-sm";
const ID_FORMULARIO = "form-conteudo";

type Props = {
  conteudo: {
    id: string;
    titulo: string;
    formatoRef: { id: string; canalId: string } | null;
    legenda: string | null;
    linkMaterial: string | null;
    responsavelId: string | null;
    dataGravacao: Date | null;
    dataPublicacao: Date | null;
  };
  /** A conta do conteúdo, com os canais e formatos. */
  conta: ContaComCanais;
  canaisSelecionados: string[];
  pessoas: { id: string; nome: string }[];
};

export function EditorConteudo({ conteudo, conta, canaisSelecionados, pessoas }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [escolha, setEscolha] = useState({ canalId: conteudo.formatoRef?.canalId ?? "", formatoId: conteudo.formatoRef?.id ?? "" });
  const [canalIds, setCanalIds] = useState(canaisSelecionados.filter((id) => id !== conteudo.formatoRef?.canalId));
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});

  function salvar(formData: FormData) {
    const campo = (n: string) => formData.get(n) ?? "";
    iniciar(async () => {
      const r = await atualizarConteudoAcao({
        conteudoId: conteudo.id,
        titulo: campo("titulo"),
        formatoId: escolha.formatoId,
        legenda: campo("legenda"),
        linkMaterial: campo("linkMaterial"),
        responsavelId: campo("responsavelId"),
        dataGravacao: campo("dataGravacao"),
        dataPublicacao: campo("dataPublicacao"),
        // O canal que deixou de ser o principal continua como extra, se já estava no conteúdo.
        canalIds: [
          ...new Set([...canalIds, ...canaisSelecionados.filter((id) => id !== escolha.canalId && id === conteudo.formatoRef?.canalId)]),
        ],
      });
      setErros(r.erros ?? {});
      if (r.erros) return void avisar({ ok: false, mensagem: "Confira os campos destacados." });
      avisar(r);
    });
  }

  function excluir() {
    if (!window.confirm("Excluir este conteúdo?")) return;
    iniciar(async () => {
      if (avisar(await excluirConteudoAcao(conteudo.id))) router.push("/conteudo/producao");
    });
  }

  const erro = (n: string) => erros[n] && <p className="text-destructive text-sm">{erros[n]!.join(" ")}</p>;

  return (
    <>
      <form id={ID_FORMULARIO} action={salvar} className="grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="c-titulo">Título</Label>
          <Input id="c-titulo" name="titulo" defaultValue={conteudo.titulo} required maxLength={200} />
          {erro("titulo")}
        </div>

        <SeletorCanalFormato
          contas={[conta]}
          canalId={escolha.canalId}
          formatoId={escolha.formatoId}
          formatoAtual={conteudo.formatoRef?.id}
          aoMudar={setEscolha}
          idPrefixo="c"
        />
        {erro("formatoId")}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="c-resp">Responsável</Label>
            <select id="c-resp" name="responsavelId" defaultValue={conteudo.responsavelId ?? ""} className={estiloCampo}>
              <option value="">Ninguém</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-grav">Gravação</Label>
            <input
              id="c-grav"
              type="date"
              name="dataGravacao"
              defaultValue={valorInputData(conteudo.dataGravacao)}
              className={estiloCampo}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="c-pub">Publicação prevista</Label>
            <input
              id="c-pub"
              type="date"
              name="dataPublicacao"
              defaultValue={valorInputData(conteudo.dataPublicacao)}
              className={estiloCampo}
            />
          </div>
        </div>

        <TambemPublicarEm canais={conta.canais} principal={escolha.canalId} marcados={canalIds} aoMudar={setCanalIds} />
        {erro("canalIds")}

        <div className="grid gap-1.5">
          <Label htmlFor="c-link">Pasta do material (Google Drive)</Label>
          <Input
            id="c-link"
            name="linkMaterial"
            type="url"
            defaultValue={conteudo.linkMaterial ?? ""}
            placeholder="https://drive.google.com/…"
          />
          {erro("linkMaterial")}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="c-legenda">Legenda</Label>
          <textarea id="c-legenda" name="legenda" rows={5} defaultValue={conteudo.legenda ?? ""} className={estiloCampo} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="submit" disabled={pendente} className="hidden sm:inline-flex">
            {pendente ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="ghost" className="text-destructive" onClick={excluir} disabled={pendente}>
            Excluir conteúdo
          </Button>
        </div>
      </form>
      {/* No celular o Salvar fica preso ao pé da tela. */}
      <div className="bg-background sticky bottom-0 z-10 -mx-4 border-t px-4 py-3 sm:hidden">
        <Button type="submit" form={ID_FORMULARIO} disabled={pendente} className="w-full">
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </>
  );
}
