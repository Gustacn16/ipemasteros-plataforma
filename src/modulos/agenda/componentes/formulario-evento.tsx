"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { criarEventoAcao, editarEventoAcao } from "../acoes/agenda";

export type OpcaoTipo = { id: string; nome: string; cor: string };

export type EventoInicial = {
  id: string;
  tipoId: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  horaInicio: string | null;
  horaFim: string | null;
  turma: string | null;
  local: string | null;
  descricao: string | null;
  visivelProfessores: boolean;
};

export type Erros = Record<string, string[] | undefined>;

export const estiloCampo =
  "border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm disabled:opacity-70 dark:bg-input/30 dark:scheme-dark aria-invalid:border-destructive";

export function ErroCampo({ mensagens, id }: { mensagens?: string[]; id?: string }) {
  if (!mensagens?.length) return null;
  return (
    <p id={id} className="text-destructive text-sm">
      {[...new Set(mensagens)].join(" ")}
    </p>
  );
}

export function Campo({ rotulo, htmlFor, erro, children }: { rotulo: string; htmlFor: string; erro?: string[]; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{rotulo}</Label>
      {children}
      <ErroCampo mensagens={erro} />
    </div>
  );
}

const ID_LISTA_TURMAS = "turmas-agenda";

export function ListaTurmas({ turmas }: { turmas: string[] }) {
  return (
    <datalist id={ID_LISTA_TURMAS}>
      {turmas.map((t) => (
        <option key={t} value={t} />
      ))}
    </datalist>
  );
}

type PropsCampos = { erros: Erros; prefixo: string; inicial?: Partial<Pick<EventoInicial, "tipoId" | "turma" | "local">> };

/** Tipo do evento (só os ativos chegam aqui). */
export function CampoTipo({ tipos, erros, prefixo, inicial }: PropsCampos & { tipos: OpcaoTipo[] }) {
  return (
    <Campo rotulo="Tipo" htmlFor={`${prefixo}-tipo`} erro={erros.tipoId}>
      <select id={`${prefixo}-tipo`} name="tipoId" className={estiloCampo} defaultValue={inicial?.tipoId ?? ""} required aria-invalid={!!erros.tipoId}>
        <option value="" disabled>
          Escolha o tipo
        </option>
        {tipos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Turma (com sugestões das já usadas) e local, iguais no evento e no lote. */
export function CamposTurmaLocal({ turmas, erros, prefixo, inicial }: PropsCampos & { turmas: string[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo rotulo="Turma (opcional)" htmlFor={`${prefixo}-turma`} erro={erros.turma}>
        <Input id={`${prefixo}-turma`} name="turma" list={ID_LISTA_TURMAS} maxLength={100} defaultValue={inicial?.turma ?? ""} autoComplete="off" />
        <ListaTurmas turmas={turmas} />
      </Campo>
      <Campo rotulo="Local (opcional)" htmlFor={`${prefixo}-local`} erro={erros.local}>
        <Input id={`${prefixo}-local`} name="local" maxLength={150} defaultValue={inicial?.local ?? ""} />
      </Campo>
    </div>
  );
}

export function CamposFinais({ prefixo, erros, inicial }: { prefixo: string; erros: Erros; inicial?: Pick<EventoInicial, "descricao" | "visivelProfessores"> }) {
  return (
    <>
      <Campo rotulo="Descrição (opcional)" htmlFor={`${prefixo}-descricao`} erro={erros.descricao}>
        <textarea id={`${prefixo}-descricao`} name="descricao" rows={4} maxLength={5000} defaultValue={inicial?.descricao ?? ""} className={estiloCampo} />
      </Campo>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="visivelProfessores" defaultChecked={inicial?.visivelProfessores ?? false} className="accent-[#5F45F4]" />
        Visível para professores
      </label>
    </>
  );
}

/** Horas do evento. "Dia inteiro" esconde os campos e manda as horas nulas. */
export function CamposHora({
  prefixo,
  diaInteiro,
  aoMudarDiaInteiro,
  inicial,
  erros,
}: {
  prefixo: string;
  diaInteiro: boolean;
  aoMudarDiaInteiro: (v: boolean) => void;
  inicial?: { horaInicio: string | null; horaFim: string | null };
  erros?: string[];
}) {
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={diaInteiro} onChange={(e) => aoMudarDiaInteiro(e.target.checked)} className="accent-[#5F45F4]" />
        Dia inteiro
      </label>
      {!diaInteiro && (
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefixo}-hora-inicio`}>Hora de início</Label>
            <input id={`${prefixo}-hora-inicio`} type="time" name="horaInicio" className={estiloCampo} defaultValue={inicial?.horaInicio ?? ""} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefixo}-hora-fim`}>Hora de fim</Label>
            <input
              id={`${prefixo}-hora-fim`}
              type="time"
              name="horaFim"
              className={estiloCampo}
              defaultValue={inicial?.horaFim ?? ""}
              aria-invalid={!!erros?.length}
            />
          </div>
        </div>
      )}
      <ErroCampo mensagens={erros} />
    </div>
  );
}

const texto = (f: FormData, campo: string) => {
  const v = f.get(campo);
  return typeof v === "string" ? v : "";
};

/** Campos comuns lidos do formulário, no formato dos esquemas. */
export function lerCamposComuns(f: FormData, diaInteiro: boolean) {
  return {
    tipoId: texto(f, "tipoId"),
    titulo: texto(f, "titulo"),
    turma: texto(f, "turma"),
    local: texto(f, "local"),
    descricao: texto(f, "descricao"),
    visivelProfessores: f.get("visivelProfessores") === "on",
    horaInicio: diaInteiro ? null : texto(f, "horaInicio") || null,
    horaFim: diaInteiro ? null : texto(f, "horaFim") || null,
  };
}

type Props = {
  tipos: OpcaoTipo[];
  turmas: string[];
  /** Dia inicial de um evento novo. */
  hoje?: string;
  /** Presente ao editar. */
  evento?: EventoInicial;
  urlFechar: string;
  /** Ao editar no painel: volta para o detalhe em vez de fechar. */
  aoTerminar?: () => void;
};

export function FormularioEvento({ tipos, turmas, hoje, evento, urlFechar, aoTerminar }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erros, setErros] = useState<Erros>({});
  const [diaInteiro, setDiaInteiro] = useState(evento ? evento.horaInicio === null : true);
  const [dataInicio, setDataInicio] = useState(evento?.dataInicio ?? hoje ?? "");
  const [dataFim, setDataFim] = useState(evento?.dataFim ?? hoje ?? "");
  const prefixo = evento ? "editar-evento" : "novo-evento";

  const terminar = () => (aoTerminar ? aoTerminar() : router.push(urlFechar, { scroll: false }));

  function salvar(f: FormData) {
    const dados = { ...lerCamposComuns(f, diaInteiro), dataInicio, dataFim };
    iniciar(async () => {
      const r = evento ? await editarEventoAcao({ ...dados, eventoId: evento.id }) : await criarEventoAcao(dados);
      setErros(r.erros ?? {});
      if (avisar(r)) terminar();
    });
  }

  return (
    <form action={salvar} className="grid grid-cols-1 gap-4" noValidate>
      <fieldset disabled={pendente} className="grid min-w-0 grid-cols-1 gap-4">
        <CampoTipo tipos={tipos} erros={erros} prefixo={prefixo} inicial={evento} />
        <Campo rotulo="Título" htmlFor={`${prefixo}-titulo`} erro={erros.titulo}>
          <Input id={`${prefixo}-titulo`} name="titulo" maxLength={150} defaultValue={evento?.titulo ?? ""} required aria-invalid={!!erros.titulo} />
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo rotulo="Início" htmlFor={`${prefixo}-inicio`} erro={erros.dataInicio}>
            <input
              id={`${prefixo}-inicio`}
              type="date"
              className={estiloCampo}
              value={dataInicio}
              required
              onChange={(e) => {
                setDataInicio(e.target.value);
                setDataFim(e.target.value);
              }}
            />
          </Campo>
          <Campo rotulo="Fim" htmlFor={`${prefixo}-fim`} erro={erros.dataFim}>
            <input
              id={`${prefixo}-fim`}
              type="date"
              className={estiloCampo}
              value={dataFim}
              min={dataInicio}
              required
              aria-invalid={!!erros.dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </Campo>
        </div>
        <CamposHora
          prefixo={prefixo}
          diaInteiro={diaInteiro}
          aoMudarDiaInteiro={setDiaInteiro}
          inicial={evento}
          erros={[...(erros.horaInicio ?? []), ...(erros.horaFim ?? [])]}
        />
        <CamposTurmaLocal turmas={turmas} erros={erros} prefixo={prefixo} inicial={evento} />
        <CamposFinais prefixo={prefixo} erros={erros} inicial={evento} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit">{pendente ? "Salvando…" : evento ? "Salvar alterações" : "Criar evento"}</Button>
          <Button type="button" variant="ghost" onClick={terminar}>
            Cancelar
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
