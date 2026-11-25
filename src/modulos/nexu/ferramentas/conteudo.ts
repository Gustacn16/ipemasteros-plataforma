import { z } from "zod";
import { listarCalendario } from "@/modulos/conteudo/servicos/conteudos";
import { relatorioInstagram } from "@/modulos/conteudo/servicos/visao-instagram";
import { limitarLista } from "./lista";
import type { FerramentaNexu } from "./tipos";
import { validarMes } from "./validacao";

const MES = "no formato AAAA-MM";
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const entradaMes = z.object({ mes: z.string().describe(`mês, ${MES}`) });

export const ferramentaCalendarioConteudo: FerramentaNexu<typeof entradaMes> = {
  nome: "calendario_conteudo",
  descricao:
    "Posts do calendário de conteúdo do mês (publicações e gravações): título, formato, etapa (inclui aprovação), marca, responsável e datas. Máximo de 50 por resposta, com o total.",
  entrada: entradaMes,
  permissao: "conteudo:usar",
  rotulo: "Consultando o calendário de conteúdo…",
  tipo: "consulta",
  async executar(ator, { mes }) {
    validarMes(mes);
    const { itens } = await listarCalendario(ator, mes, {}, true);
    return limitarLista(
      itens.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        formato: c.formatoRef?.nome ?? null,
        etapa: c.etapa,
        marca: c.marca.nome,
        responsavel: c.responsavel?.nome ?? null,
        dataPublicacao: dia(c.dataPublicacao),
        dataGravacao: dia(c.dataGravacao),
        publicacoes: c.publicacoes.map((p) => ({ canal: p.canal.plataforma, status: p.status })),
      })),
    );
  },
};

export const ferramentaMetricasInstagram: FerramentaNexu<typeof entradaMes> = {
  nome: "metricas_instagram",
  descricao: "Números do Instagram no mês (seguidores, alcance, visualizações, interações) e os 5 posts com mais alcance.",
  entrada: entradaMes,
  permissao: "conteudo:usar",
  rotulo: "Consultando o Instagram…",
  tipo: "consulta",
  async executar(ator, { mes }) {
    validarMes(mes);
    const r = await relatorioInstagram(ator, {}, mes);
    if (!r) return { mes, mensagem: "Nenhuma conta do Instagram conectada." };
    return {
      mes,
      parcial: r.parcial,
      publicacoes: r.publicacoes,
      engajamento: r.engajamento,
      cartoes: r.cartoes,
      maisAlcance: r.maisAlcance.map((m) => ({
        tipo: m.tipo,
        legenda: m.legenda?.slice(0, 120) ?? null,
        publicadoEm: m.publicadoEm,
        alcance: m.alcance,
        interacoes: m.interacoes,
        curtidas: m.curtidas,
        comentarios: m.comentarios,
        salvamentos: m.salvamentos,
        compartilhamentos: m.compartilhamentos,
      })),
    };
  },
};
