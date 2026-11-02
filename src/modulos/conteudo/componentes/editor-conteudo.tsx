"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { valorInputData } from "@/modulos/tarefas/componentes/exibicao";
import { atualizarConteudoAcao, excluirConteudoAcao } from "../acoes/conteudo";
import { FORMATOS, ROTULO_FORMATO, ROTULO_PLATAFORMA, type Formato, type Plataforma } from "../esquemas/conteudo";

const estiloCampo = "border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm";

type Props = {
  conteudo: {
    id: string;
    titulo: string;
    formato: Formato;
    roteiro: string | null;
    legenda: string | null;
    linkMaterial: string | null;
    responsavelId: string | null;
    dataGravacao: Date | null;
    dataPublicacao: Date | null;
  };
  canais: { id: string; plataforma: Plataforma; identificador: string | null; ativo: boolean }[];
  canaisSelecionados: string[];
  pessoas: { id: string; nome: string }[];
};

export function EditorConteudo({ conteudo, canais, canaisSelecionados, pessoas }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [canalIds, setCanalIds] = useState(canaisSelecionados);
  const [erros, setErros] = useState<Record<string, string[] | undefined>>({});
  // Canal inativo só aparece se já estiver no conteúdo.
  const visiveis = canais.filter((k) => k.ativo || canaisSelecionados.includes(k.id));

  function salvar(formData: FormData) {
    const campo = (n: string) => formData.get(n) ?? "";
    iniciar(async () => {
      const r = await atualizarConteudoAcao({
        conteudoId: conteudo.id,
        titulo: campo("titulo"),
        formato: campo("formato"),
        roteiro: campo("roteiro"),
        legenda: campo("legenda"),
        linkMaterial: campo("linkMaterial"),
        responsavelId: campo("responsavelId"),
        dataGravacao: campo("dataGravacao"),
        dataPublicacao: campo("dataPublicacao"),
        canalIds,
      });
      setErros(r.erros ?? {});
      if (r.erros) return void avisar({ ok: false, mensagem: "Confira os campos destacados." });
      avisar(r);
    });
  }

  function excluir() {
    if (!window.confirm("Excluir este conteúdo?")) return;
    iniciar(async () => {
      if (avisar(await excluirConteudoAcao(conteudo.id))) router.push("/conteudo/planejamento");
    });
  }

  const erro = (n: string) => erros[n] && <p className="text-destructive text-sm">{erros[n]!.join(" ")}</p>;

  return (
    <form action={salvar} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="c-titulo">Título</Label>
        <Input id="c-titulo" name="titulo" defaultValue={conteudo.titulo} required maxLength={200} />
        {erro("titulo")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="c-formato">Formato</Label>
          <select id="c-formato" name="formato" defaultValue={conteudo.formato} className={estiloCampo}>
            {FORMATOS.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FORMATO[f]}
              </option>
            ))}
          </select>
        </div>
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
          <input id="c-grav" type="date" name="dataGravacao" defaultValue={valorInputData(conteudo.dataGravacao)} className={estiloCampo} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-pub">Publicação prevista</Label>
          <input id="c-pub" type="date" name="dataPublicacao" defaultValue={valorInputData(conteudo.dataPublicacao)} className={estiloCampo} />
        </div>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Canais de destino</legend>
        <div className="flex flex-wrap gap-4">
          {visiveis.map((k) => (
            <label key={k.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={canalIds.includes(k.id)}
                onChange={(e) => setCanalIds((a) => (e.target.checked ? [...a, k.id] : a.filter((x) => x !== k.id)))}
              />
              {ROTULO_PLATAFORMA[k.plataforma]}
              {k.identificador && <span className="text-muted-foreground">{k.identificador}</span>}
            </label>
          ))}
        </div>
        {erro("canalIds")}
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="c-link">Pasta do material (Google Drive)</Label>
        <Input id="c-link" name="linkMaterial" type="url" defaultValue={conteudo.linkMaterial ?? ""} placeholder="https://drive.google.com/…" />
        {erro("linkMaterial")}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="c-roteiro">Roteiro / briefing</Label>
        <textarea id="c-roteiro" name="roteiro" rows={8} defaultValue={conteudo.roteiro ?? ""} className={estiloCampo} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="c-legenda">Legenda</Label>
        <textarea id="c-legenda" name="legenda" rows={5} defaultValue={conteudo.legenda ?? ""} className={estiloCampo} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="ghost" className="text-destructive" onClick={excluir} disabled={pendente}>
          Excluir conteúdo
        </Button>
      </div>
    </form>
  );
}
