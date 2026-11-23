# Planejamento e metas — design

Data: 2026-11-23 · Situação: aprovado em 2026-11-23 (pela sessão principal, em nome do Gustavo)

## Por quê
Hoje o plano de 2027 vive numa planilha ("[2027] OKRs e Metas"): turmas que vamos abrir → meta de vendas → funil comercial → metas de marketing → painel "tamo no caminho?". Ela funciona como referência, mas exige digitar à mão números que a plataforma já tem (vendas, leads, mídia, Instagram, conteúdo publicado) e mistura cadastro com visualização.

O Gustavo quer uma área **Planejamento** na plataforma com:
- princípios claros de acompanhamento: indicador, meta, realizado, desempenho;
- facilidade de uso e de cadastro;
- **cadastro (entradas) separado da visualização (painéis)**.

A planilha é referência, não regra.

## Objetivos
1. Cadastrar o plano do ano: premissas por produto, calendário de turmas e metas avulsas. Daí sai a **meta de vendas por mês** (alunos e R$), por produto.
2. Calcular o **funil comercial** de trás para frente: reuniões, leads, verba de mídia, comissão e CAC necessários, mês a mês.
3. Ter **indicadores do plano** (Comercial e Marketing) com meta por mês e realizado. O realizado vem **sozinho** quando a plataforma já tem o dado; senão, é lançado num formulário simples.
4. Um **Painel** que responde "estamos no caminho?" no mês e no acumulado, com ✔ ≥ 100%, ⚠ 80–99% e ✖ < 80%, e gráficos meta × realizado mês a mês.
5. Reaproveitar as **Metas do Comercial** (por produto e vendedor), sem duplicar.

## Fora do escopo (agora)
- **Financeiro / forecasting:** caixa, MRR, receita por competência, DRE e vesting. O Gustavo vai mandar a planilha do financeiro depois. O modelo de turmas já guarda duração e contrato, então o MRR pode ser calculado nessa etapa.
- **OKRs** e **Projetos e eventos** (abas 03 e 04 da planilha).
- Ligar a turma do plano à turma do Acadêmico.
- Funil por produto e reuniões vindas do Kommo. Hoje as reuniões são lançadas à mão.

## Anti-objetivos
- Virar outra planilha: grade gigante para digitar o que a plataforma já sabe.
- Duas metas de vendas que discordam sem ninguém perceber.
- Painel que mistura telas de edição.

## Abordagens consideradas
1. **Planilha dentro da plataforma** (grades livres, copiando as abas). Rápido de entender, mas repete o problema: tudo manual, sem regras, cadastro misturado com visão.
2. **Plano estruturado + indicadores genéricos** (escolhida). O plano comercial tem estrutura própria: premissas, turmas e funil, porque tem regra de cálculo. Todo o resto, incluindo o marketing, é **indicador** com meta mensal e uma "fonte" de realizado (automática ou manual). O Painel lê só indicadores. Novos indicadores entram sem programar.
3. **Reusar os Indicadores de Processos.** Já existem farol e lançamento, mas o indicador fica preso a um documento de processo, tem uma meta só (não por mês) e não tem fonte automática. Adaptar quebraria o módulo de Processos.

O Gustavo pediu para juntar tudo e começar; a escolha da abordagem 2 foi do Claude.

## Princípios de acompanhamento
- **Indicador** = nome, frente (Comercial ou Marketing), grupo (ex.: "Newsletter"), unidade (número, R$ ou %), sentido (maior é melhor / menor é melhor), tipo e responsável.
- **Tipo** define como somar o ano:
  - **fluxo:** soma dos meses (posts, leads, vendas);
  - **estoque:** número no fim do mês; o acumulado é o último mês com dado (seguidores, inscritos);
  - **taxa:** acumulado = média dos meses com dado, ou recalculado a partir dos componentes quando é calculado (conversão, CAC).
- **Meta:** por mês. Pode ser **digitada** (com "repetir em todos os meses") ou **calculada pelo plano** (vendas, alunos, leads, reuniões, verba, CAC, conversão).
- **Realizado:** **automático** (fonte da plataforma) ou **manual** (lançado). Indicador automático não aceita lançamento.
- **Desempenho:** % = realizado ÷ meta. Para "menor é melhor", % = meta ÷ realizado. ✔ ≥ 100%, ⚠ 80–99%, ✖ < 80%. Sem meta ou sem realizado: "—". Só meses que já começaram contam. O mês em andamento aparece como "parcial".
- **Acumulado:** do 1º mês do plano até o mês escolhido.

## Plano do ano
- Um plano por ano civil (`PlanoAnual`, `ano` único). Exemplo: 2027 = jan/27 a dez/27.
- "Criar plano de 2027" já cria os indicadores padrão (lista abaixo) e as premissas do funil com os valores da planilha.

### Premissas por produto
Usa os produtos do catálogo do Comercial. Para cada produto do plano:
- contrato médio por aluno (R$);
- alunos por turma;
- janela de vendas (meses, contando o mês de abertura);
- duração (meses), com padrão vindo de `Produto.duracaoMeses`.

### Calendário de turmas
Cada turma tem produto, código (T5…) e mês de abertura. Alunos, contrato e janela são opcionais: vazio usa a premissa do produto.

A turma gera a meta de vendas: os alunos são divididos pelos meses da janela, que **termina no mês de abertura**. A sobra da divisão vai para os meses mais perto da abertura.
- Exemplo: 15 alunos em 4 meses dá 3, 4, 4, 4.
- R$ do mês = alunos do mês × contrato.
- Meses fora do ano do plano aparecem como "antes do período" ou "depois do período", como na planilha, e não entram na meta do ano.

### Metas avulsas
Por produto e mês: alunos e R$. Servem para curso livre, paciente modelo e assinatura, que vendem sem turma. A meta do produto no mês é a soma do que vem das turmas com a meta avulsa.

### Premissas do funil
Um conjunto por plano:
- lead → reunião agendada;
- comparecimento;
- reunião realizada → venda;
- custo por lead (R$);
- comissão (% da venda);
- teto de CAC (% do valor vendido).

Cálculo de cada mês, igual à aba "Funil Comercial":
- reuniões realizadas = alunos ÷ conversão da reunião;
- reuniões agendadas = realizadas ÷ comparecimento;
- leads = agendadas ÷ conversão do lead;
- verba = leads × custo por lead;
- comissão = R$ × %;
- CAC total = verba + comissão;
- CAC por aluno = CAC total ÷ alunos;
- CAC % = CAC total ÷ R$.

Arredondamento para cima nas contagens. O CAC % acima do teto ganha alerta.

## Ligação com as Metas do Comercial
- A meta de vendas por **produto e mês** é do plano (meta da empresa).
- As `MetaVenda` (por produto e vendedor) continuam sendo **a divisão entre vendedores**, cadastradas onde já são.
- Em `/comercial/metas/cadastro`, cada cartão de produto passa a mostrar "Plano: N alunos · R$ X". Abaixo vem a diferença para a soma dos vendedores: "faltam distribuir R$ Y" ou "R$ Y acima do plano".
- Nada é gravado automaticamente nas metas dos vendedores.
- O dashboard do Comercial não muda.

## Indicadores padrão
**Comercial** (meta calculada pelo plano):

| Indicador | Realizado |
|---|---|
| Vendas (R$) | automático: soma de `Venda.valorTotal` no mês, produtos do plano |
| Alunos vendidos | automático: contagem de vendas no mês, produtos do plano |
| Leads gerados | automático: leads da Meta (formulário + site + conversas), mesma regra do dashboard |
| Reuniões agendadas | manual |
| Reuniões realizadas | manual |
| Investimento em mídia (R$) | automático: Meta Ads |
| CAC por aluno (menor é melhor) | calculado: (investimento + comissão estimada) ÷ alunos |
| Conversão lead → venda | calculado: alunos ÷ leads |

**Marketing** (meta digitada; os números da planilha entram como valor inicial):

| Grupo | Indicador | Realizado |
|---|---|---|
| Conteúdo e audiência | Posts no feed — IPEMaster | automático: conteúdos publicados no mês no canal/formato escolhido |
| Conteúdo e audiência | Reels / vídeos curtos | automático: conteúdos publicados |
| Conteúdo e audiência | Vídeos no YouTube | automático: conteúdos publicados |
| Conteúdo e audiência | Seguidores Instagram IPEMaster (estoque) | automático: `MetricaContaInstagram` |
| Conteúdo e audiência | Alcance no mês | automático: `MetricaContaInstagram` |
| Conteúdo e audiência | Seguidores Pedro Prado (estoque) | automático, se a conta estiver conectada; senão, manual |
| Newsletter | Edições enviadas | manual |
| Newsletter | Inscritos (estoque) | manual |
| Newsletter | Taxa de abertura (taxa) | manual |
| Podcast | Episódios publicados | manual |
| Podcast | Plays / views | manual |
| Eventos | Eventos realizados | manual |
| Eventos | Leads vindos de conteúdo orgânico | manual |

A gestão pode criar, editar, ordenar e excluir indicadores, e escolher a fonte numa lista fixa definida em código:
- vendas (R$ e alunos);
- leads Meta;
- investimento Meta;
- seguidores ou alcance de uma conta do Instagram;
- conteúdos publicados por canal e formato;
- manual.

Indicadores calculados pelo plano não podem ser excluídos, só escondidos do Painel.

## Telas
Menu lateral: **Planejamento** (ícone de alvo/gráfico). Abas no topo, separando **ver** de **cadastrar**:

**Visualização**
- `/planejamento` — **Painel**:
  - seletor de ano e mês;
  - status geral ("X de Y indicadores no caminho");
  - tabela por frente: indicador, meta do mês, realizado, %, status, meta acumulada, realizado acumulado, % e status acumulados;
  - gráficos "Vendas: meta × realizado" e "Leads: necessários × gerados", mês a mês.
- `/planejamento/comercial` — **Plano comercial**:
  - meta de vendas por mês (total e por produto, com antes e depois do período);
  - "o que precisa acontecer no mês" (o funil);
  - realizado × meta mês a mês com ✔/⚠/✖.
- `/planejamento/marketing` — **Plano de marketing**: grade por grupo, meta × realizado mês a mês, com ✔/⚠/✖ e "% dos indicadores batidos no mês".

**Cadastro** (aba "Cadastrar", só gestão)
- `/planejamento/cadastro/premissas` — premissas por produto e do funil.
- `/planejamento/cadastro/turmas` — calendário de turmas (lista com adicionar, editar e excluir) e metas avulsas.
- `/planejamento/cadastro/indicadores` — indicadores e metas mensais (grade de 12 meses por indicador, com "repetir em todos").
- `/planejamento/lancar` — **Lançar resultados do mês**: escolhe o mês e mostra só os indicadores manuais (os da pessoa, para quem é responsável). Cada um traz um campo e uma observação opcional. Fica aberto para os responsáveis, além da gestão.

## Permissões
| Permissão | admin | gestor | colaborador | comercial |
|---|---|---|---|---|
| `planejamento:ver` (Painel e planos) | ✅ | ✅ | — | — |
| `planejamento:editar` (plano, premissas, turmas, indicadores e metas) | ✅ | ✅ | — | — |
| `planejamento:lancar` | ✅ | ✅ | 🔸 só indicadores em que é responsável | 🔸 idem |

O responsável sem `planejamento:ver` entra só em `/planejamento/lancar`.

## Modelo de dados (novo)
- `PlanoAnual`: id, ano (único), observacoes, e as premissas do funil (convLeadAgendada, comparecimento, convReuniaoVenda, custoPorLead, comissaoPct, tetoCacPct).
- `PremissaProdutoPlano`: planoId, produtoId (único por plano), contratoMedio, alunosPorTurma, janelaVendasMeses, duracaoMeses.
- `TurmaPlano`: planoId, produtoId, codigo, mesAbertura (dia 1), e alunos, contrato, janela e duração opcionais; observacoes, excluidoEm.
- `MetaAvulsaPlano`: planoId, produtoId, mes; alunos e valor (único por plano, produto e mês).
- `IndicadorPlano`: planoId, frente (`comercial`/`marketing`), grupo, nome, unidade (`numero`/`reais`/`percentual`), sentido, tipo (`fluxo`/`estoque`/`taxa`), metaCalculada (chave ou nulo), fonte (chave, com `manual` como padrão), fonteParametros (JSON: contaId, canalId, formatoId), responsavelId, noPainel, ordem, excluidoEm.
- `FechamentoMesPlano`: planoId, mes (único por plano e mês), dados (JSON), criadoEm.
- `MetaMensalIndicador`: indicadorId, mes, valor (único por indicador e mês).
- `RealizadoMensalIndicador`: indicadorId, mes, valor, observacao, registradoPorId (único por indicador e mês).

Regras:
- Dinheiro em `Decimal(12,2)`; percentuais e valores de indicador em `Decimal(18,4)`.
- Regras de cálculo puras em `src/modulos/planejamento/regras/`, com testes: distribuição da turma, funil, desempenho, acumulado.

Auditoria:
- `planejamento.plano_criado`, `planejamento.turma_excluida`, `planejamento.indicador_excluido`, `planejamento.realizado_lancado`;
- só ids e nomes de campos.

## Entregas (todas agora, nesta ordem, publicadas no `teste`)
1. Plano, premissas, turmas, metas avulsas, funil, a tela do Plano comercial e o aviso nas Metas do Comercial.
2. Indicadores, metas mensais, fontes automáticas, lançamento e a tela do Plano de marketing.
3. Painel.

## Metas de meses fechados ficam congeladas
Decisão do Gustavo: mudar o plano não muda a meta de um mês que já fechou.
- **Metas calculadas** (vendas por produto e funil): quando um mês fecha, o cálculo dele é guardado num retrato (`FechamentoMesPlano`: planoId, mes, dados em JSON com alunos e R$ por produto e os números do funil). Daí em diante, telas e Painel usam o retrato.
- **Quando o retrato é tirado:** antes de salvar qualquer mudança no plano (premissas, turmas, metas avulsas, premissas do funil), o sistema congela todos os meses fechados que ainda não têm retrato. Isso garante que a mudança não alcança o passado. Ao abrir as telas, um mês fechado sem retrato também é congelado.
- **Metas digitadas** de indicadores: a meta de um mês fechado não pode mais ser editada.
- Telas de cadastro avisam: "Mudanças valem do mês atual em diante."

## Decisões do Claude (aceitas na aprovação)
1. **Valores iniciais:** ao criar o plano entram as premissas do funil da planilha (20%, 75%, 25%, R$ 150, 5%, 10%) e as metas de marketing (posts 20, reels 12, YouTube 4, newsletter 4 edições e 35% de abertura, podcast 4, eventos 1 por mês). Premissas por produto e turmas são cadastradas na tela, porque dependem dos produtos do catálogo (Cosmiatria e IP Club podem ainda não existir lá).
2. **Comissão no CAC realizado:** % de comissão do plano × R$ vendido no mês (estimativa, igual à planilha), não a comissão real da aba Comissões.
3. **Conteúdos publicados:** conta cada `Publicacao` com status `publicado` cujo `publicadoEm` cai no mês, no canal escolhido (o canal já define a marca) e, opcionalmente, no formato do conteúdo. Uma peça em 2 canais conta 1 em cada canal.
4. **Vendas e alunos realizados:** só vendas (não excluídas) dos produtos que estão no plano (com premissa, turma ou meta avulsa). Cada venda = 1 aluno, inclusive assinatura e paciente modelo.
5. **Alcance do Instagram:** usa a linha mensal (`periodo = mes`); se ela não existir, "—".
6. **Meta zero = sem meta:** mostra "—" e não entra no status geral. CAC realizado sem nenhuma venda também fica "—".

## Fica para quem constrói
Layout das grades e dos gráficos (seguir o visual do Comercial e do Processos), nomes de componentes, índices do banco e a ordem dos testes.
