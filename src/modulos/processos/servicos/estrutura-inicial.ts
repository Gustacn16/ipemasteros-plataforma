import type { IconeCategoria, TipoDocumento } from "../esquemas/processos";
import type { Etapa } from "../regras/fluxo";

// Estrutura sugerida para começar. Tudo entra como rascunho: o time só vê
// depois que alguém revisar e publicar.

type DocInicial = {
  titulo: string;
  tipo: TipoDocumento;
  resumo: string;
  conteudo: string;
  objetivo?: string;
  fornecedores?: string;
  entradas?: string;
  saidas?: string;
  clientes?: string;
  frequencia?: string;
  revisarACadaMeses?: number;
  fluxo?: Etapa[];
};

const etapa = (id: string, titulo: string, descricao: string, extra: Partial<Etapa> = {}): Etapa => ({
  id,
  tipo: "etapa",
  titulo,
  descricao,
  responsavel: "",
  sim: null,
  nao: null,
  ...extra,
});

export const ESTRUTURA_INICIAL: {
  nome: string;
  descricao: string;
  icone: IconeCategoria;
  areas: { nome: string; descricao: string; documentos: DocInicial[] }[];
}[] = [
  {
    nome: "Institucional",
    descricao: "Quem somos e no que acreditamos.",
    icone: "bussola",
    areas: [
      {
        nome: "Cultura",
        descricao: "Missão, visão, valores e o jeito IPEMaster de trabalhar.",
        documentos: [
          {
            titulo: "Missão, visão e valores",
            tipo: "texto",
            resumo: "Por que a IPEMaster existe, aonde quer chegar e o que não negocia.",
            revisarACadaMeses: 12,
            conteudo: `## Missão
_Por que a IPEMaster existe? Escreva em uma frase o que entregamos e para quem._

## Visão
_Aonde queremos chegar nos próximos anos? Seja concreto: número, posição, prazo._

## Valores
1. **Valor 1** — o que significa na prática e um exemplo do dia a dia.
2. **Valor 2** — …
3. **Valor 3** — …

> Dica: depois de publicar, ligue este documento aos processos com [[Como documentar um processo]].`,
          },
        ],
      },
    ],
  },
  {
    nome: "Gestão",
    descricao: "Como acompanhamos resultados e melhoramos a rotina.",
    icone: "grafico",
    areas: [
      {
        nome: "Rotina",
        descricao: "Gerenciamento da rotina do dia a dia.",
        documentos: [
          {
            titulo: "Como documentar um processo",
            tipo: "texto",
            resumo: "Como escrever um processo aqui: ficha, fluxo, procedimento e revisão.",
            conteudo: `Aqui cada processo segue o **gerenciamento da rotina** (Vicente Falconi): primeiro padronizar, para que todos façam do mesmo jeito. As metas e os indicadores ficam no Planejamento.

## 1. Padrão (a ficha)
- **Objetivo:** para que o processo existe.
- **Dono:** quem responde pelo resultado.
- **Fornecedores → Entradas → Saídas → Clientes:** de quem recebemos, o que recebemos, o que entregamos e para quem.
- **Frequência:** quando o processo acontece.

## 2. Fluxo
Desenhe as etapas na ordem. Use **Decisão** quando houver um "sim ou não", por exemplo: "O lead respondeu?".

## 3. Procedimento
O passo a passo em texto: detalhes de cada etapa, regras, modelos e links das ferramentas.

## 4. Revisão
Defina a cada quantos meses o padrão é revisado. O sistema avisa quando vence.

Para citar outro documento, escreva o título entre colchetes duplos, assim: [[Missão, visão e valores]].`,
          },
        ],
      },
    ],
  },
  {
    nome: "Marketing",
    descricao: "Como atraímos e nutrimos médicos interessados.",
    icone: "megafone",
    areas: [
      {
        nome: "Aquisição",
        descricao: "Captação de leads e campanhas.",
        documentos: [
          {
            titulo: "Captura de lead",
            tipo: "processo",
            resumo: "Do anúncio ao lead registrado e entregue ao comercial.",
            objetivo: "Gerar leads qualificados de médicos para as pós-graduações, no custo planejado.",
            fornecedores: "Meta Ads, Instagram, site, indicações",
            entradas: "Campanha ativa, formulário, verba aprovada",
            saidas: "Lead registrado e distribuído para o comercial",
            clientes: "Time comercial",
            frequencia: "Contínuo (campanhas sempre ativas)",
            revisarACadaMeses: 6,
            conteudo: `## Passo a passo
1. Descreva aqui o detalhe de cada etapa do fluxo.
2. Inclua links das ferramentas e modelos usados.

## Regras
- Todo lead precisa de origem (campanha) registrada.

Ver também: [[Funil de marketing]].`,
            fluxo: [
              etapa("e1", "Campanha no ar", "Anúncio publicado com público e verba definidos"),
              etapa("e2", "Lead preenche o formulário", "Nome, telefone e especialidade"),
              etapa("e3", "Lead é válido?", "Telefone e especialidade conferidos", { tipo: "decisao", nao: "e6" }),
              etapa("e4", "Distribuir ao comercial", "Entra na fila do vendedor da vez"),
              { ...etapa("e5", "Lead entregue", "Comercial faz o primeiro contato"), tipo: "fim" },
              { ...etapa("e6", "Descartar e ajustar campanha", "Registrar o motivo e revisar o público"), tipo: "fim" },
            ],
          },
        ],
      },
      {
        nome: "Funil",
        descricao: "Etapas do funil e conversões.",
        documentos: [
          {
            titulo: "Funil de marketing",
            tipo: "processo",
            resumo: "Etapas do funil, da atenção à matrícula, e as conversões que acompanhamos.",
            objetivo: "Levar o médico do primeiro contato com a marca até a matrícula.",
            clientes: "Comercial e Acadêmico",
            revisarACadaMeses: 6,
            conteudo: `## Etapas do funil
| Etapa | O que acontece | Conteúdo/ação |
|---|---|---|
| Atenção | Conhece a IPEMaster | Reels, anúncios |
| Interesse | Segue e consome conteúdo | Lives, carrosséis |
| Lead | Deixa o contato | [[Captura de lead]] |
| Oportunidade | Conversa com o comercial | Atendimento |
| Matrícula | Compra | Contrato e boas-vindas |`,
            fluxo: [
              etapa("f1", "Atenção", "Conteúdo e anúncios"),
              etapa("f2", "Interesse", "Seguidor engajado"),
              etapa("f3", "Lead", "Contato registrado"),
              etapa("f4", "Oportunidade", "Atendimento comercial"),
              { ...etapa("f5", "Matrícula", "Aluno IPEMaster"), tipo: "fim" },
            ],
          },
        ],
      },
    ],
  },
  {
    nome: "Comercial",
    descricao: "Do primeiro contato à matrícula.",
    icone: "dinheiro",
    areas: [{ nome: "Vendas", descricao: "Atendimento e fechamento.", documentos: [] }],
  },
  {
    nome: "Acadêmico",
    descricao: "Operação das turmas e experiência do aluno.",
    icone: "graduacao",
    areas: [{ nome: "Turmas", descricao: "Abertura, aulas e formatura.", documentos: [] }],
  },
];
