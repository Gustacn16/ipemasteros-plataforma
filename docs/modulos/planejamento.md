# Módulo: Planejamento e metas

## Objetivo
O plano do ano da IPEMaster dentro da plataforma, no lugar da planilha "[2027] OKRs e Metas": turmas que vamos abrir → meta de vendas → funil comercial → metas de marketing → Painel "estamos no caminho?". Princípios:
- **ver separado de preencher**;
- o realizado vem **sozinho** quando a plataforma já tem o dado;
- **meta de mês fechado não muda**.

- Especificação: `docs/superpowers/specs/2026-11-23-planejamento-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-11-23-planejamento.md`

## Entidades
| Entidade | Campos principais |
|---|---|
| `PlanoAnual` | ano (único) e premissas do funil: convLeadAgendada, comparecimento, convReuniaoVenda (frações), custoPorLead (R$), comissaoPct, tetoCacPct |
| `PremissaProdutoPlano` | plano + produto do catálogo (único): contratoMedio, alunosPorTurma, janelaVendasMeses, duracaoMeses |
| `TurmaPlano` | produto, codigo (T5…), mesAbertura; alunos, contratoMedio, janela e duração opcionais (vazio = premissa); exclusão lógica |
| `MetaAvulsaPlano` | produto e mês (único por plano): alunos e valor. Para o que vende sem turma |
| `FechamentoMesPlano` | plano e mês (único): retrato JSON das metas por produto e do funil, gravado quando o mês fecha |
| `IndicadorPlano` | frente (`comercial`/`marketing`), grupo, nome, unidade (`numero`/`reais`/`percentual`), sentido, tipo (`fluxo`/`estoque`/`taxa`), metaCalculada (chave) ou meta digitada, fonte (chave; `manual` = lançado) + fonteParametros, responsável, noPainel, ordem |
| `MetaMensalIndicador` | indicador e mês (único): valor |
| `RealizadoMensalIndicador` | indicador e mês (único): valor, observação, quem lançou |

Percentuais ficam como fração (0,35 = 35%); na tela são digitados como "35".

## Regras
1. **Turma → meta de vendas** (`regras/turmas.ts`): os alunos são divididos pelos meses da janela, que termina no mês de abertura. A sobra vai para os meses mais perto da abertura (15 em 4 meses = 3, 4, 4, 4). R$ do mês = alunos × contrato. O que cai fora do ano vai para "antes" ou "depois do período". Meta avulsa soma com a das turmas. Turmas cadastradas em outro plano também entram nos meses deste ano em que vendem (ex.: turma de jan/2028 com janela de 4 meses vende out–dez/2027 no plano de 2027), com a premissa do plano onde foram cadastradas; a tela de turmas lista essas turmas.
2. **Funil** (`regras/funil.ts`): reuniões realizadas = alunos ÷ conversão da reunião; agendadas = realizadas ÷ comparecimento; leads = agendadas ÷ conversão do lead (cada passo arredonda para cima); verba = leads × custo por lead; comissão = R$ × %; CAC = verba + comissão. CAC % acima do teto fica vermelho. A **meta do CAC por aluno** é o teto: teto (% do vendido) × R$ ÷ alunos; mudar o teto muda a meta no Painel. Retratos de meses fechados antes dessa regra usam o CAC previsto. Conversão zerada deixa as contagens "—".
3. **Congelamento** (`regras/fechamento.ts`, `servicos/fechamento.ts`): antes de qualquer mudança no plano, e ao abrir as telas, todo mês fechado sem retrato é congelado em `FechamentoMesPlano`. Daí em diante, telas e Painel usam o retrato. Metas digitadas de mês fechado não podem ser editadas.
4. **Desempenho** (`regras/desempenho.ts`): % = realizado ÷ meta (ou meta ÷ realizado quando menor é melhor). ✔ ≥ 100%, ⚠ 80–99%, ✖ < 80%. Meta zero ou vazia, ou realizado vazio, dá "—". Só meses que já começaram têm status; o mês corrente aparece como "parcial".
5. **Acumulado** (do 1º mês até o mês escolhido): fluxo soma; estoque usa o último mês com dado; taxa faz a média. CAC e conversão somam os componentes antes de dividir.
6. **Realizado automático** (`servicos/realizado.ts`):
   - vendas (R$ e quantidade): `Venda` não excluída dos produtos do plano, pela data da venda;
   - leads e investimento: Meta Ads, contas ativas em BRL;
   - seguidores: último dia do mês em `MetricaContaInstagram`;
   - alcance: a linha mensal;
   - conteúdos publicados: `Publicacao` publicada no canal (e formatos escolhidos), pelo mês em São Paulo;
   - CAC = (investimento + vendas × comissão) ÷ alunos;
   - conversão = alunos ÷ leads.
7. **Lançamento:** só indicadores manuais, só meses que já começaram. Lançar de novo substitui; vazio apaga.
8. **Criar plano** já traz as premissas do funil da planilha (20%, 75%, 25%, R$ 150, 5%, 10%) e 22 indicadores (9 do Comercial: 8 com meta do plano e "Pacientes modelo", com meta digitada e realizado lançado à mão; 13 do Marketing, com as metas mensais da planilha). A migração `20261125100000_paciente_modelo` acrescenta "Pacientes modelo" aos planos que já existiam. As fontes de Instagram e de conteúdos são ligadas sozinhas quando a conta ou o canal da marca IPEMaster existem.
9. **Campos de reais** formatam enquanto digita ("R$ 1.234,56", `mascararReais` em `src/lib/dinheiro.ts`), inclusive metas e lançamentos de indicadores em reais. A conversão geral (lead → venda) nas premissas do funil é recalculada enquanto digita.
10. Indicadores do Comercial (meta do plano) não podem ser excluídos, só escondidos do Painel; neles só mudam nome, responsável e "no Painel".

## Ligação com o Comercial
A meta do produto no mês é do plano. As `MetaVenda` continuam sendo a divisão entre vendedores, em `/comercial/metas/cadastro`. Cada cartão de produto mostra "Plano: N alunos · R$ X" e a diferença para a soma dos vendedores ("Faltam distribuir", "acima do plano" ou "Distribuído ✔"). Nada é gravado sozinho nas metas dos vendedores. O dashboard do Comercial não muda.

## Permissões
| Permissão | admin | gestor | colaborador | comercial |
|---|---|---|---|---|
| `planejamento:ver` (Painel e planos) | ✅ | ✅ | — | — |
| `planejamento:editar` (plano, premissas, turmas, indicadores e metas) | ✅ | ✅ | — | — |
| `planejamento:lancar` | ✅ | ✅ | 🔸 só indicadores em que é responsável | 🔸 idem |

O responsável sem `planejamento:ver` vê "Planejamento" no menu apontando direto para Lançar resultados.

## Auditoria
`planejamento.plano_criado`, `planejamento.turma_excluida`, `planejamento.indicador_excluido`, `planejamento.realizado_lancado` (só ids, mês e nomes de campos).

## Telas
Abas: **Ver** (Painel · Comercial · Marketing) | **Preencher** (Cadastrar · Lançar resultados). Ano e mês na URL (`?ano=2027&mes=2027-03`).
- `/planejamento` — **Painel**: status geral do mês, tabela mês × acumulado de cada indicador marcado "no Painel" e gráficos de vendas (meta × realizado) e leads (necessários × gerados).
- `/planejamento/comercial` — meta de vendas por produto (antes, 12 meses, depois, total; 🔒 nos meses congelados), **meta × realizado por produto** no mês escolhido e no acumulado (vendas de todos os produtos; status pelo valor), "o que precisa acontecer no mês" (funil) e a grade meta × realizado dos indicadores do Comercial.
- `/planejamento/marketing` — % dos indicadores batidos por mês e uma grade por grupo.
- `/planejamento/cadastro/premissas` — premissas por produto e do funil.
- `/planejamento/cadastro/turmas` — calendário de turmas e metas avulsas.
- `/planejamento/cadastro/indicadores` — indicadores por frente (nome, grupo, responsável, unidade, sentido, tipo, fonte, no Painel, ordem) e grade de metas com "Repetir em todos os meses".
- `/planejamento/lancar` — indicadores manuais do mês para lançar, com observação.

### Resumo do mês no Início
Quem tem `comercial:ver` vê no `/inicio` o bloco "Resumo de {mês}" com vendas (quantidade), faturamento e leads do mês atual. Os números vêm do dashboard do Comercial (`obterDashboard` e `obterProjecao` com os filtros padrão), então batem com `/comercial`; o vendedor sem visão da equipe vê só os próprios, e leads só aparecem para quem vê mídia. A meta é a de Comercial → Metas (soma de produtos e vendedores); só onde ela não existe entra a do Planejamento (para quem vê o Planejamento), marcada "(Planejamento)". Leads não têm meta no Comercial: usa a do Planejamento ou fica "—". Barra com marca de "esperado hoje" (meta × dias passados ÷ dias do mês); cor pelo ritmo: ≥ 100% ✔, 80–99% ⚠, < 80% ✖. Sem meta: "Meta: —" e sem barra. Se falhar, o bloco aparece com "—" e um aviso. Regra em `regras/resumo-mes.ts` (`resumoDoInicio`); serviço `obterResumoDoInicio`.

## Fora do escopo (por enquanto)
Financeiro (caixa, MRR, receita por competência, DRE e vesting), OKRs, Projetos e eventos, ligar a turma do plano à turma do Acadêmico, funil por produto e reuniões vindas do Kommo.
