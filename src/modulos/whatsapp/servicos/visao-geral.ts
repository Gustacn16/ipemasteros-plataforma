import "server-only";
import type { TimeNumeroWhatsapp } from "@/generated/prisma/client";
import { ErroPermissao, temPermissao } from "@/lib/permissoes";
import type { UsuarioAtual } from "@/lib/sessao";
import { diaEmSaoPaulo } from "@/modulos/tarefas/regras/prazo";
import { janelaDeOntem, semanaDaConsulta } from "../regras/dia";
import { listarAvisos } from "./avisos";
import { listarLeads } from "./leads";
import { listarNumeros } from "./numeros";
import { listarVendasCs } from "./cs";
import { resumoDaSemana, semRespostaAgora } from "./painel-atendimento";

const ESCOPO = "whatsapp:ver_equipe";

export type NumeroPanorama = {
  id: string;
  nome: string;
  time: TimeNumeroWhatsapp;
  dono: string | null;
  estado: string;
  rotulo: string;
  desde: Date | null;
  conversasSemana: number;
  semRespostaAgora: number;
  notaDecimos: number | null;
};

export type AvisosPanorama = {
  /** `true` quando a lista de avisos não pôde ser carregada. */
  falhou: boolean;
  proximos: { id: string; titulo: string; agendadoPara: Date; grupos: number }[];
  rascunhos: number;
};

export type Panorama = {
  numeros: NumeroPanorama[];
  /** `true` quando a lista de números não pôde ser carregada (a lista vazia não prova que não há números). */
  numerosFalhou: boolean;
  /** `null` = a consulta falhou; `{ semAvaliacoes: true }` = consultou e não havia avaliações do dia. */
  oportunidades: { quentes: number; mornos: number; diaAvaliado: Date } | { semAvaliacoes: true } | null;
  /** `null` = quem pediu não tem `whatsapp:avisos`: os blocos de avisos não aparecem. */
  avisos: AvisosPanorama | null;
  atencao: { semRespostaAgora: number; semRespostaFalhou: boolean; csAguardando: number | null; desconectados: number };
};

/** Primeiro dia do mês de São Paulo de `agora`, à meia-noite de lá (03:00 UTC). */
function inicioDoMes(agora: Date): Date {
  return new Date(`${diaEmSaoPaulo(agora).slice(0, 7)}-01T03:00:00.000Z`);
}

const DIAS_PROXIMOS_ENVIOS = 7;
const MAX_PROXIMOS_ENVIOS = 5;
const DIAS_RASCUNHOS = 30;

async function avisosDoPanorama(ator: UsuarioAtual, agora: Date): Promise<AvisosPanorama> {
  try {
    const dia = 86_400_000;
    const lista = await listarAvisos(ator, agora, new Date(agora.getTime() + DIAS_RASCUNHOS * dia));
    const limite = agora.getTime() + DIAS_PROXIMOS_ENVIOS * dia;
    const proximos = lista
      .filter((a) => (a.situacao === "aprovado" || a.situacao === "enviando") && a.agendadoPara.getTime() <= limite)
      .sort((x, y) => x.agendadoPara.getTime() - y.agendadoPara.getTime())
      .slice(0, MAX_PROXIMOS_ENVIOS)
      .map((a) => ({ id: a.id, titulo: a.evento?.titulo ?? "Aviso avulso", agendadoPara: a.agendadoPara, grupos: a.grupos.length }));
    return { falhou: false, proximos, rascunhos: lista.filter((a) => a.situacao === "rascunho").length };
  } catch {
    return { falhou: true, proximos: [], rascunhos: 0 };
  }
}

/** Junta os serviços já existentes numa foto só; cada bloco tolera a falha do seu serviço. Exige `whatsapp:ver_equipe`. */
export async function panoramaWhatsapp(
  ator: UsuarioAtual,
  agora: Date = new Date(),
  opcoes: { comAvisos?: boolean } = {},
): Promise<Panorama> {
  if (!temPermissao(ator.papel, ESCOPO)) throw new ErroPermissao(ESCOPO);
  const semana = semanaDaConsulta(undefined, agora);
  const diaAvaliado = janelaDeOntem(agora).dia;

  const comAvisos = opcoes.comAvisos ?? temPermissao(ator.papel, "whatsapp:avisos");
  const [numerosR, semRespostaR, leadsR, csR, avisosR] = await Promise.allSettled([
    listarNumeros(ator),
    semRespostaAgora(ator, agora),
    listarLeads(ator, diaAvaliado, {}),
    listarVendasCs(ator, inicioDoMes(agora), agora, agora, { incluirAguardandoAnteriores: true }),
    comAvisos ? avisosDoPanorama(ator, agora) : Promise.resolve(null),
  ]);

  const numerosLista = numerosR.status === "fulfilled" ? numerosR.value : [];
  const semResposta = semRespostaR.status === "fulfilled" ? semRespostaR.value : [];
  const resumoR = await Promise.allSettled([resumoDaSemana(ator, semana, { agora, semResposta })]);
  const resumo = resumoR[0].status === "fulfilled" ? resumoR[0].value : [];
  const porNumero = new Map(resumo.map((l) => [l.numeroId, l]));

  const numeros: NumeroPanorama[] = numerosLista.map((n) => {
    const linha = porNumero.get(n.id);
    return {
      id: n.id,
      nome: n.nome,
      time: n.time,
      dono: n.dono,
      estado: n.estado,
      rotulo: n.rotulo,
      desde: n.estado === "conectado" ? n.conectadoEm : n.ultimoSinalEm,
      conversasSemana: linha?.conversas ?? 0,
      semRespostaAgora: linha?.semRespostaAgora ?? 0,
      notaDecimos: linha?.notaDecimos ?? null,
    };
  });

  let oportunidades: Panorama["oportunidades"] = null;
  if (leadsR.status === "fulfilled" && leadsR.value.itens.length === 0) {
    oportunidades = { semAvaliacoes: true };
  } else if (leadsR.status === "fulfilled") {
    const abertos = leadsR.value.itens.filter((i) => i.situacaoLead !== "fechou" && i.situacaoLead !== "perdido");
    oportunidades = {
      quentes: abertos.filter((i) => i.temperatura === "quente").length,
      mornos: abertos.filter((i) => i.temperatura === "morno").length,
      diaAvaliado,
    };
  }

  const csAguardando = csR.status === "fulfilled" && !csR.value.semNumeroCs ? csR.value.aguardando : null;

  return {
    numeros,
    numerosFalhou: numerosR.status === "rejected",
    oportunidades,
    avisos: avisosR.status === "fulfilled" ? avisosR.value : null,
    atencao: {
      semRespostaAgora: semResposta.length,
      semRespostaFalhou: semRespostaR.status === "rejected",
      csAguardando,
      desconectados: numeros.filter((n) => n.estado !== "conectado").length,
    },
  };
}
