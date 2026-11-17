"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo } from "@/componentes/campo";
import { Alert, AlertDescription } from "@/componentes/ui/alert";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { SeletorCor } from "@/modulos/tarefas/componentes/dialogos-estrutura";
import {
  criarCanalAcao,
  criarFormatoAcao,
  criarMarcaAcao,
  editarCanalAcao,
  editarFormatoAcao,
  editarMarcaAcao,
  excluirMarcaAcao,
} from "../acoes/conteudo";
import { PLATAFORMAS, ROTULO_PLATAFORMA, type Plataforma } from "../esquemas/conteudo";
import type { Conta } from "../servicos/contas";
import { SeloPlataforma } from "./selo-plataforma";

const estiloSelect = "border-input bg-background h-9 min-w-0 rounded-md border px-2 text-sm";

export function NovaMarca() {
  const [estado, executar, pendente] = useActionState(criarMarcaAcao, { ok: false });
  return (
    <form action={executar} className="bg-card text-card-foreground grid max-w-md min-w-0 gap-4 rounded-xl border p-4">
      <h2 className="font-semibold">Nova conta</h2>
      {estado.mensagem && (
        <Alert variant={estado.ok ? "default" : "destructive"}>
          <AlertDescription>{estado.mensagem}</AlertDescription>
        </Alert>
      )}
      <Campo rotulo="Nome" name="nome" placeholder="Ex.: Pedro Prado" erros={estado.erros?.nome} required maxLength={60} />
      <SeletorCor name="cor" padrao="#8b5cf6" />
      <Button type="submit" disabled={pendente} className="justify-self-start">
        Criar conta
      </Button>
    </form>
  );
}

function Formato({ formato }: { formato: Conta["canais"][number]["formatos"][number] }) {
  const [nome, setNome] = useState(formato.nome);
  const [pendente, iniciar] = useTransition();
  const salvar = (ativo: boolean) => iniciar(async () => void avisar(await editarFormatoAcao({ formatoId: formato.id, nome, ativo })));
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-2">
      <Input aria-label="Nome do formato" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className="h-8 w-full min-w-0 sm:w-44" />
      <Button size="sm" variant="outline" disabled={pendente || nome.trim() === formato.nome} onClick={() => salvar(formato.ativo)}>
        Renomear
      </Button>
      <Button size="sm" variant="ghost" disabled={pendente} onClick={() => salvar(!formato.ativo)}>
        {formato.ativo ? "Desativar" : "Reativar"}
      </Button>
      {!formato.ativo && <span className="text-muted-foreground text-xs">inativo</span>}
    </li>
  );
}

/** Formatos do canal (ex.: YouTube → Avulso, Entrevista, Vlog). Desativado some dos formulários; os conteúdos ficam. */
function FormatosDoCanal({ canal }: { canal: Conta["canais"][number] }) {
  const [novo, setNovo] = useState("");
  const [pendente, iniciar] = useTransition();
  return (
    <details className="group w-full pl-2">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
        Formatos: {canal.formatos.filter((f) => f.ativo).map((f) => f.nome).join(", ") || "nenhum"}
      </summary>
      <div className="grid gap-2 py-2">
        <ul className="grid gap-2">
          {canal.formatos.map((f) => (
            <Formato key={`${f.id}-${f.nome}-${f.ativo}`} formato={f} />
          ))}
        </ul>
        <form
          className="flex min-w-0 flex-wrap items-center gap-2"
          action={() =>
            iniciar(async () => {
              if (avisar(await criarFormatoAcao({ canalId: canal.id, nome: novo }))) setNovo("");
            })
          }
        >
          <Input aria-label="Formato novo" value={novo} onChange={(e) => setNovo(e.target.value)} placeholder="Ex.: Entrevista" maxLength={60} className="h-8 w-full min-w-0 sm:w-44" />
          <Button type="submit" size="sm" disabled={pendente || !novo.trim()}>
            Adicionar formato
          </Button>
        </form>
      </div>
    </details>
  );
}

function Canal({ canal }: { canal: Conta["canais"][number] }) {
  const [identificador, setIdentificador] = useState(canal.identificador ?? "");
  const [pendente, iniciar] = useTransition();
  const salvar = (ativo: boolean) =>
    iniciar(async () => void avisar(await editarCanalAcao({ canalId: canal.id, identificador, ativo })));

  return (
    <li className="flex min-w-0 flex-wrap items-center gap-2 py-2">
      <span className="flex w-36 min-w-0 items-center gap-2 text-sm">
        <SeloPlataforma plataforma={canal.plataforma} />
        {ROTULO_PLATAFORMA[canal.plataforma]}
      </span>
      <Input
        aria-label={`Perfil em ${ROTULO_PLATAFORMA[canal.plataforma]}`}
        value={identificador}
        onChange={(e) => setIdentificador(e.target.value)}
        placeholder="@perfil"
        maxLength={100}
        className="h-8 w-full min-w-0 sm:w-48"
      />
      <Button size="sm" variant="outline" disabled={pendente} onClick={() => salvar(canal.ativo)}>
        Salvar
      </Button>
      <Button size="sm" variant="ghost" disabled={pendente} onClick={() => salvar(!canal.ativo)}>
        {canal.ativo ? "Desativar" : "Reativar"}
      </Button>
      {!canal.ativo && <span className="text-muted-foreground text-xs">inativo</span>}
      <FormatosDoCanal canal={canal} />
    </li>
  );
}

export function CartaoMarca({ conta }: { conta: Conta }) {
  const [pendente, iniciar] = useTransition();
  const [nome, setNome] = useState(conta.nome);
  const [plataforma, setPlataforma] = useState<Plataforma>("instagram");
  const [identificador, setIdentificador] = useState("");

  return (
    <section className="bg-card text-card-foreground grid min-w-0 gap-3 rounded-xl border p-4" aria-label={conta.nome}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: conta.cor }} />
        <Input aria-label="Nome da conta" value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 w-full min-w-0 font-semibold sm:w-56" maxLength={60} />
        <Button
          size="sm"
          variant="outline"
          disabled={pendente || nome === conta.nome}
          onClick={() => iniciar(async () => void avisar(await editarMarcaAcao({ marcaId: conta.id, nome, cor: conta.cor })))}
        >
          Renomear
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive ml-auto"
          disabled={pendente}
          onClick={() => {
            if (window.confirm(`Excluir a conta ${conta.nome}? Os conteúdos dela deixam de aparecer.`)) {
              iniciar(async () => void avisar(await excluirMarcaAcao(conta.id)));
            }
          }}
        >
          Excluir conta
        </Button>
      </div>

      <ul className="divide-y">
        {conta.canais.map((k) => (
          <Canal key={k.id} canal={k} />
        ))}
      </ul>

      <form
        className="flex min-w-0 flex-wrap items-center gap-2 border-t pt-3"
        action={() =>
          iniciar(async () => {
            if (avisar(await criarCanalAcao({ marcaId: conta.id, plataforma, identificador }))) setIdentificador("");
          })
        }
      >
        <select aria-label="Plataforma" className={estiloSelect} value={plataforma} onChange={(e) => setPlataforma(e.target.value as Plataforma)}>
          {PLATAFORMAS.map((p) => (
            <option key={p} value={p}>
              {ROTULO_PLATAFORMA[p]}
            </option>
          ))}
        </select>
        <Input aria-label="Perfil" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="@perfil (opcional)" maxLength={100} className="h-9 w-full min-w-0 sm:w-48" />
        <Button type="submit" size="sm" disabled={pendente}>
          Adicionar canal
        </Button>
      </form>
    </section>
  );
}
