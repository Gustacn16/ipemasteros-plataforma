# Visual do app — etapa 1: tema da marca e módulo Tarefas

- **Status:** Em revisão
- **Data:** 2026-11-02
- **Escopo:** primeira etapa da melhoria visual, feita módulo por módulo (decisão do usuário). As próximas etapas (Início, Agenda, Conteúdo, Comercial, Acadêmico) terão especificação própria.

## 1. Objetivo
Dar a cara da IPEMaster ao app e deixar as telas de Tarefas no padrão de bons sistemas do mercado. São quatro incômodos, todos apontados pelo usuário:
- visual cinza e genérico;
- números pouco visuais;
- telas inconsistentes entre si;
- uso difícil no celular.

Nenhuma regra de negócio, permissão ou dado muda.

**Critério de sucesso:**
- O usuário troca entre claro e escuro no menu, e todas as telas de Tarefas ficam legíveis e bonitas nos dois temas, no computador e no celular (375 px), sem rolagem horizontal da página.
- No Relatório, admin e gestor veem de relance quem entregou mais no prazo e como as entregas evoluíram nas semanas.

## 2. Decisões do usuário (2026-11-02)
- **Tema:** claro e escuro, à escolha de cada pessoa. O padrão segue o aparelho.
- **Ordem do trabalho:** módulo por módulo, começando por Tarefas.
- **Parte 1, cores e tema:** aprovada.
- **Parte 2, telas de Tarefas:** aprovada, incluindo o pódio, o gráfico por semana e a comparação com o período anterior.
- **Referências de estilo** (inspiração, não cópia):
  - chips de status com ícone;
  - pódio de ranking;
  - cartões de número em blocos (bento);
  - aviso escuro com ícone.

## 3. Tema e cores (vale para o app inteiro)
Os tokens ficam em `src/app/globals.css`, em `:root` (claro) e `.dark` (escuro). Os componentes de `src/componentes/ui` passam a usá-los sem mudança de código.

| Token | Claro | Escuro |
|---|---|---|
| `--background` | branco-gelo `#F7F7F9` | `#0B0C0E` |
| `--card`, `--popover` | `#FFFFFF` | `#16181B` |
| `--foreground` | `#111416` | `#F4F4F5` |
| `--muted` / `--muted-foreground` | `#F1F1F4` / `#62656B` | `#1E2024` / `#9A9CA3` |
| `--border`, `--input` | `#E6E6EB` | `rgb(255 255 255 / 10%)` |
| `--primary` / `--primary-foreground` | `#5F45F4` / `#FFFFFF` | `#7B66F6` / `#FFFFFF` |
| `--ring` | `#5F45F4` | `#7B66F6` |
| `--accent` (fundo de hover) | `#F0EDFE` | `rgb(123 102 246 / 14%)` |

**Situação:** tokens novos `--sucesso`, `--atencao`, `--perigo` e `--informacao`, cada um com uma variante `-suave` para o fundo de chip. Ficam expostos ao Tailwind como `text-sucesso`, `bg-sucesso-suave` etc.

| | Claro | Escuro |
|---|---|---|
| sucesso | `#16A34A` / suave `#DCFCE7` | `#4ADE80` / suave `rgb(74 222 128 / 14%)` |
| atenção | `#B45309` / suave `#FEF3C7` | `#FBBF24` / suave `rgb(251 191 36 / 14%)` |
| perigo | `#DC2626` / suave `#FEE2E2` | `#F87171` / suave `rgb(248 113 113 / 14%)` |
| informação | `#5F45F4` / suave `#EDE9FE` | `#A594F9` / suave `rgb(123 102 246 / 16%)` |

**Gráficos:** `--chart-1` a `--chart-5` usam roxo `#5F45F4`, ciano `#06B6D4`, âmbar `#F59E0B`, verde `#22C55E` e rosa `#EC4899`. No escuro, cada um fica um tom mais claro.

**Outras regras do tema:**
- O menu lateral continua chumbo nos dois temas, como já é hoje.
- Números de indicador usam `tabular-nums`.
- Todo par de texto e fundo atinge contraste WCAG AA, de 4,5:1 para texto normal.

**Troca de tema:**
- Usa `next-themes`, que já está instalado, com `attribute="class"`, `defaultTheme="system"` e `enableSystem`.
- O provedor fica em `src/app/layout.tsx`, com `suppressHydrationWarning` em `<html>`, para não piscar o tema errado ao carregar.
- O controle fica no rodapé do menu lateral (`Rodape` em `src/app/(app)/menu-navegacao.tsx`). É um menu com **Automático**, **Claro** e **Escuro**, com ícones de monitor, sol e lua.
- Com o menu recolhido, aparece só o ícone.
- A escolha fica salva no navegador, pelo `next-themes`.

**Avisos (sonner):**
- Seguem o tema e usam as cores de situação nos ícones.
- O fundo é `--popover` com borda fina, como na referência.

## 4. Peças de interface
Ficam em `src/componentes/` para os próximos módulos reaproveitarem. Nesta etapa, só Tarefas as usa.

| Peça | Arquivo | O que faz |
|---|---|---|
| `CabecalhoPagina` | `cabecalho-pagina.tsx` | Título (h1), descrição curta e área de ações à direita. No celular, as ações descem para baixo do título |
| `CartaoNumero` | `cartao-numero.tsx` | Rótulo com ícone, número grande e, opcionalmente, a variação contra o período anterior: "↑ 12%" em verde, "↓ 8%" em vermelho, "=" neutro, ou nada quando não há base. Tom opcional (`perigo` deixa o rótulo vermelho) |
| `AnelPercentual` | `anel-percentual.tsx` | Anel SVG com o percentual no centro. A cor segue a faixa: verde ≥ 80%, âmbar 60–79%, vermelho < 60%. Mostra "—" sem valor |
| `ChipSituacao` | `chip-situacao.tsx` | Pílula com ícone e texto. Tons: `sucesso`, `atencao`, `perigo`, `informacao`, `neutro` ou uma cor livre (status da lista). Tamanhos `sm` e `md` |
| `Podio` | `podio.tsx` | Os 3 primeiros: avatar ou iniciais, nome, valor e degraus 2-1-3 com alturas diferentes. Ouro, prata e bronze vêm de tokens próprios, com coroa no 1º. Com menos de 3 pessoas, mostra só os degraus existentes |
| `EstadoVazio` | `estado-vazio.tsx` | Ícone, título-convite, uma frase e botão de ação opcional |

**Regra:** as telas de Tarefas não usam cores fixas (`#5F45F4`, `bg-white`, `text-gray-*`). Usam só tokens.

## 5. Telas de Tarefas
**Todas as telas:** `CabecalhoPagina` no topo e `EstadoVazio` onde hoje aparece texto solto.

**Relatório (`/tarefas/relatorio`):**
- **Topo:** quatro `CartaoNumero`, em 4 colunas no computador, 2 no tablet e 1 no celular:
  - Abertas;
  - Atrasadas agora, em tom `perigo`;
  - Entregues no período, com variação;
  - No prazo, com `AnelPercentual` e variação em pontos percentuais.
- **Variação:**
  - Compara com o período imediatamente anterior, de mesma duração. "Este mês" compara com o mês passado inteiro, "semana" com a semana anterior e um intervalo livre com os N dias antes dele.
  - Abertas e Atrasadas agora não têm variação, porque são fotos do momento.
- **Pódio do mês:**
  - Aparece só quando o usuário vê a equipe (`tarefas:ver_relatorio_equipe`).
  - Ordena por entregas no prazo no período. Empate: maior % no prazo, depois nome.
  - Só entra quem tem pelo menos 1 entrega no prazo.
  - Sem ninguém, o bloco não aparece.
- **Entregas por semana:**
  - Gráfico de colunas empilhadas em recharts, que já está instalado, com cores dos tokens: no prazo, com atraso e sem data.
  - Usa semanas de segunda a domingo (São Paulo) que tocam o período, no máximo 13. Acima disso, agrupa por mês.
  - A legenda fica embaixo e o tooltip mostra os três números.
- **Tabela por pessoa:** continua como está. No celular (< 768 px), cada pessoa vira um cartão com os mesmos números.

**Minhas tarefas (`/tarefas/minhas`):**
- **Topo:** três `CartaoNumero`, com Atrasadas em tom `perigo`, Hoje em `atencao` e Próximos 7 dias.
- **Grupos:** os grupos atuais continuam. Cada linha mostra o título, o chip de prazo e o chip de status.
- **Chip de prazo:** usa `situacaoEntrega`, que já existe em `regras/prazo.ts`, com estes textos:

| Situação | Tom | Texto |
|---|---|---|
| atrasada | `perigo` | "Atrasada N dia(s)" |
| hoje | `atencao` | "Vence hoje" |
| amanhã | `atencao` | "Vence amanhã" |
| próxima | `informacao` | "Em N dias" |
| futura | `neutro` | data curta |
| concluída | `sucesso` | "Concluída" |

**Lista e Quadro (`/tarefas/listas/[listaId]`):**
- Status, prioridade e prazo viram `ChipSituacao` no cartão do quadro e na tabela. O status usa a cor da lista.
- Cada coluna do quadro mostra o ponto na cor do status, o nome e a contagem.
- **Tabela no celular** (< 768 px): vira lista de cartões com título, chips e responsáveis. A página não ganha rolagem horizontal.
- O cartão do quadro mantém o que já tem: faixa de prioridade, etiquetas, anel do checklist, fotos e o menu "Mover para". Muda só para tokens e chips.

**Painel da tarefa:**
- O cabeçalho fixo mostra o caminho (espaço › lista), o chip de status e o chip de prazo.
- O corpo fica em seções com título discreto e separador: Detalhes, Etiquetas, Checklist, Subtarefas e Histórico.
- **No celular:** o painel ocupa a tela cheia, como já acontece, e o botão "Salvar alterações" fica fixo embaixo.

**Configurações de espaço e de status:** só tokens e `CabecalhoPagina`.

## 6. Arquitetura e dados
- **`servicos/relatorio.ts` ganha:**
  - os totais do período anterior, para a variação. Reusa a mesma consulta com o intervalo anterior;
  - a série por semana.
- **`regras/relatorio.ts` ganha funções puras com testes:**
  - `intervaloAnterior(intervalo: Intervalo): Intervalo`;
  - `variacao(atual: number, anterior: number): number | null`, em percentual inteiro, com `null` quando `anterior = 0`;
  - `semanasDoIntervalo(intervalo): { inicio: string; fim: string; rotulo: string }[]`, que agrupa por mês acima de 13 semanas;
  - `distribuirPorSemana(entregues, semanas, agora)`;
  - `podio(linhas: LinhaRelatorio[]): LinhaRelatorio[]`, com até 3.
- **Banco:** nenhuma mudança.
- O componente de gráfico é cliente e recebe só números e rótulos prontos do servidor.
- **Sem ADR nova:** os tokens e o `next-themes` são escolhas de interface dentro da stack atual.

## 7. Testes e verificação
- **Vitest:**
  - `intervaloAnterior` para semana, mês, mês passado e intervalo livre, incluindo a virada de ano;
  - `variacao` com base zero, igual, subida e queda;
  - `semanasDoIntervalo` cortando o mês no meio e acima de 13 semanas;
  - `distribuirPorSemana` com no prazo, atraso e sem data;
  - `podio` com empates, menos de 3 pessoas e zero entregas no prazo;
  - textos do chip de prazo.
- **Visual:**
  - prévia temporária com dados fictícios de todas as telas de Tarefas;
  - em 1280 px e 375 px, nos temas claro e escuro;
  - contraste conferido nos chips e nos cartões.
  - A prévia é apagada antes do commit.
- **Homologação:** roteiro curto para o usuário trocar o tema e percorrer Minhas tarefas, Lista, Quadro, Painel e Relatório.

## 8. Riscos
- **Telas de outros módulos no escuro:** cores fixas podem ficar ruins até a vez de cada módulo. Isso foi aceito pelo usuário, e cada etapa corrige o seu módulo.
- **Outras sessões:** Comercial e Acadêmico estão editando os próprios arquivos. Esta etapa toca só em:
  - `globals.css`;
  - `src/app/layout.tsx`;
  - o rodapé do menu;
  - `src/componentes/ui/sonner.tsx`;
  - os arquivos novos em `src/componentes/`;
  - o módulo Tarefas.

  Os commits levam só esses caminhos.
- **Mudar `--primary` muda a cor dos botões do app inteiro** para roxo, inclusive em outros módulos. Esse é o efeito desejado.
