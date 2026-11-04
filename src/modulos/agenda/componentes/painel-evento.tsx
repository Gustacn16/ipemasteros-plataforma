"use client";

import { CalendarIcon, ClockIcon, EyeIcon, EyeOffIcon, MapPinIcon, PencilIcon, Trash2Icon, UsersIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ChipSituacao } from "@/componentes/chip-situacao";
import { Button } from "@/componentes/ui/button";
import { avisar } from "@/modulos/tarefas/componentes/avisar";
import { CLASSE_TITULO_SECAO } from "@/modulos/tarefas/componentes/exibicao";
import { excluirEventoAcao } from "../acoes/agenda";
import type { obterEvento } from "../servicos/eventos";
import { FormularioEvento, type OpcaoTipo } from "./formulario-evento";
import { ID_MODELO_EVENTO } from "./item-agenda";

type Dados = Awaited<ReturnType<typeof obterEvento>>;

const formatoExtenso = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const formatoSemAno = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const formatoCurto = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

const extenso = (dia: string) => formatoExtenso.format(new Date(`${dia}T00:00:00Z`));
const curto = (dia: string) => formatoCurto.format(new Date(`${dia}T00:00:00Z`)).replace(/\./g, "");

/** "Sábado, 7 de novembro de 2026" ou "Sábado, 7 de novembro a domingo, 8 de novembro de 2026". */
export function datasPorExtenso(inicio: string, fim: string): string {
  const deInicio = inicio.slice(0, 4) === fim.slice(0, 4) ? formatoSemAno.format(new Date(`${inicio}T00:00:00Z`)) : extenso(inicio);
  const texto = inicio === fim ? extenso(inicio) : `${deInicio} a ${extenso(fim)}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function horario(horaInicio: string | null, horaFim: string | null): string {
  if (horaInicio === null) return "Dia inteiro";
  return horaFim ? `${horaInicio} às ${horaFim}` : horaInicio;
}

/** Casca do painel lateral (tela cheia no celular). Esc ou clique fora fecha. */
export function PainelLateral({
  urlFechar,
  rotulo,
  cabecalho,
  acoes,
  children,
}: {
  urlFechar: string;
  rotulo: string;
  cabecalho: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const fechar = () => router.push(urlFechar, { scroll: false });
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && router.push(urlFechar, { scroll: false });
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [router, urlFechar]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label={`Fechar ${rotulo}`} className="absolute inset-0 bg-black/20 dark:bg-black/50" onClick={fechar} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-painel"
        className="bg-background relative flex h-full w-full flex-col overflow-y-auto shadow-xl sm:max-w-xl"
      >
        <div className="bg-background sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-5 py-3">
          <div id="titulo-painel" className="min-w-0 text-sm">
            {cabecalho}
          </div>
          <div className="flex shrink-0 gap-1">
            {acoes}
            <Button type="button" variant="ghost" size="icon" onClick={fechar} aria-label="Fechar">
              <XIcon />
            </Button>
          </div>
        </div>
        <div className="min-w-0 p-5">{children}</div>
      </aside>
    </div>
  );
}

function Linha({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-muted-foreground mt-0.5 shrink-0 [&_svg]:size-4">{icone}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

type Props = {
  dados: Dados | null;
  urlFechar: string;
  modeloUrlEvento: string;
  tipos: OpcaoTipo[];
  turmas: string[];
};

/** Painel com o detalhe do evento institucional. `dados` nulo mostra "Não encontrado.". */
export function PainelEvento({ dados, urlFechar, modeloUrlEvento, tipos, turmas }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();

  if (!dados) {
    return (
      <PainelLateral urlFechar={urlFechar} rotulo="evento" cabecalho={<span className="text-muted-foreground">Evento</span>}>
        <div className="grid justify-items-start gap-4">
          <p className="text-sm">Não encontrado.</p>
          <Button type="button" variant="outline" onClick={() => router.push(urlFechar, { scroll: false })}>
            Fechar
          </Button>
        </div>
      </PainelLateral>
    );
  }

  const evento = dados;

  function excluir() {
    if (!window.confirm("Excluir este evento?")) return;
    iniciar(async () => {
      if (avisar(await excluirEventoAcao(evento.id))) router.push(urlFechar, { scroll: false });
    });
  }

  const cabecalho = (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <ChipSituacao cor={evento.tipo.cor} tamanho="sm">
        {evento.tipo.nome}
      </ChipSituacao>
      {evento.visivelProfessores && (
        <ChipSituacao tom="informacao" icone={EyeIcon} tamanho="sm">
          Visível para professores
        </ChipSituacao>
      )}
    </span>
  );

  const acoes = evento.podeEditar && !editando && (
    <>
      <Button type="button" variant="ghost" size="icon" onClick={() => setEditando(true)} disabled={pendente} aria-label="Editar evento">
        <PencilIcon />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={excluir} disabled={pendente} aria-label="Excluir evento">
        <Trash2Icon />
      </Button>
    </>
  );

  // Um tipo desativado continua disponível no evento que já o usa.
  const tiposDoFormulario = tipos.some((t) => t.id === evento.tipoId)
    ? tipos
    : [...tipos, { id: evento.tipoId, nome: `${evento.tipo.nome} (inativo)`, cor: evento.tipo.cor }];

  return (
    <PainelLateral urlFechar={urlFechar} rotulo="evento" cabecalho={cabecalho} acoes={acoes}>
      {editando ? (
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold">Editar evento</h2>
          <FormularioEvento tipos={tiposDoFormulario} turmas={turmas} evento={evento} urlFechar={urlFechar} aoTerminar={() => setEditando(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <h2 className="text-xl font-semibold tracking-tight break-words">{evento.titulo}</h2>

          <section className="grid grid-cols-1 gap-3" aria-labelledby="titulo-detalhes">
            <h3 id="titulo-detalhes" className={CLASSE_TITULO_SECAO}>
              Detalhes
            </h3>
            <Linha icone={<CalendarIcon />}>{datasPorExtenso(evento.dataInicio, evento.dataFim)}</Linha>
            <Linha icone={<ClockIcon />}>{horario(evento.horaInicio, evento.horaFim)}</Linha>
            {evento.turma && (
              <Linha icone={<UsersIcon />}>
                <span className="text-muted-foreground">Turma </span>
                {evento.turma}
              </Linha>
            )}
            {evento.local && <Linha icone={<MapPinIcon />}>{evento.local}</Linha>}
            {!evento.visivelProfessores && <Linha icone={<EyeOffIcon />}>Não visível para professores</Linha>}
            {evento.descricao && <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">{evento.descricao}</p>}
          </section>

          {evento.doLote.length > 0 && (
            <section className="grid grid-cols-1 gap-2 border-t pt-5" aria-labelledby="titulo-lote">
              <h3 id="titulo-lote" className={CLASSE_TITULO_SECAO}>
                Outras datas deste lote
              </h3>
              <ul className="grid grid-cols-1 gap-1">
                {evento.doLote.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={modeloUrlEvento.replace(ID_MODELO_EVENTO, e.id)}
                      scroll={false}
                      className="hover:bg-muted flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm sm:flex-row sm:items-center sm:gap-3"
                    >
                      <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap tabular-nums sm:w-40">
                        {e.dataInicio === e.dataFim ? curto(e.dataInicio) : `${curto(e.dataInicio)} a ${curto(e.dataFim)}`}
                      </span>
                      <span className="min-w-0 break-words sm:truncate">{e.titulo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </PainelLateral>
  );
}
