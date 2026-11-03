# Visual etapa 1 — tema da marca e Tarefas: plano de implementação

> **Para agentes:** executar tarefa a tarefa (superpowers:subagent-driven-development ou superpowers:executing-plans). Passos com checkbox (`- [ ]`).

**Objetivo:** temas claro e escuro com as cores da marca, seis peças de interface reaproveitáveis e todas as telas de Tarefas refeitas com elas, incluindo pódio, comparação com o período anterior e gráfico por semana no Relatório.

**Arquitetura:**
- Os tokens de cor ficam em `src/app/globals.css` e são lidos pelo Tailwind v4 e pelo shadcn.
- O tema é controlado por `next-themes` (classe `.dark` no `<html>`).
- As peças ficam em `src/componentes/`. As regras novas do relatório são funções puras em `src/modulos/tarefas/regras/relatorio.ts`.
- Nenhuma mudança de banco.

**Stack:** Next.js 16, Tailwind v4, shadcn radix-nova, `next-themes` ^0.4.6, `recharts` 3.10.1, `lucide-react`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-visual-tarefas-design.md`

## Restrições globais
- **Valores exatos:** os hex dos tokens, tons e textos de chip são os das seções 3 a 5 da spec, copiados sem mudança.
- **Cores nas telas de Tarefas:** nada de cor fixa (`#5F45F4`, `bg-white`, `text-gray-*`, `bg-slate-*`); só tokens. O menu lateral continua chumbo nos dois temas.
- **Contraste e números:** contraste WCAG AA (4,5:1) em texto. Números de indicador com `tabular-nums`.
- **Celular:** nenhuma rolagem horizontal da página em 375 px.
- **Arquivos:** outras sessões (Comercial, Acadêmico) editam a mesma pasta e o branch `teste`. Commite só os caminhos desta etapa, com `git commit -F <msg> -- <caminhos>`. Nunca use `git add -A`, stash ou reset.
- **Commits:** em português (Conventional Commits), terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Prévia visual:** feita com rota temporária `src/app/previa-visual-temporaria` e dados fictícios. A rota é apagada antes do commit; depois apague `.next/dev/types` e `.next/types` e rode `npm run typecheck`.
- **Componentes cliente:** página de servidor nunca importa constante de arquivo `"use client"`.
- **Documentação:** atualizar `docs/modulos/tarefas.md` na mesma etapa (regra 1 do CLAUDE.md).

## Foco de revisão
1. Tema escuro com o menu recolhido: o seletor de tema continua acessível, só com o ícone, e tem `aria-label`.
2. Primeiro carregamento com "Automático" e aparelho escuro: a página não pisca em claro.
3. Relatório com período anterior sem entregas: a variação some ou fica "—" (nunca "Infinity%" ou "NaN%").
4. Pódio com 1 ou 2 pessoas, ou com empate em tudo: degraus coerentes, ordem estável e nada quebrado.
5. Intervalo livre de um ano no Relatório: o gráfico agrupa por mês e não desenha 52 colunas espremidas.

---

### Tarefa 1: Tema da marca, troca de tema e avisos
**Arquivos:**
- Modificar:
  - `src/app/globals.css` (`:root`, `.dark` e o bloco `@theme inline`);
  - `src/app/layout.tsx`;
  - `src/componentes/ui/sonner.tsx`;
  - `src/app/(app)/menu-navegacao.tsx` (só `Rodape`).
- Criar:
  - `src/componentes/provedor-tema.tsx` (`"use client"`);
  - `src/componentes/seletor-tema.tsx` (`"use client"`).

**Produz:**
- Utilitários Tailwind: `text-sucesso`, `bg-sucesso-suave`, `border-sucesso`, e o mesmo para `atencao`, `perigo` e `informacao`.
- `--podio-ouro`, `--podio-prata`, `--podio-bronze` (claro e escuro) e `--chart-1..5`.
- `ProvedorTema({ children })` envolve `ThemeProvider` com `attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange`.
- `SeletorTema({ compacto }: { compacto: boolean })` é um `DropdownMenu` com Automático, Claro e Escuro (ícones `MonitorIcon`, `SunIcon`, `MoonIcon`).
  - O gatilho mostra o ícone do tema atual.
  - O rótulo "Tema" aparece só quando `!compacto`.
  - `aria-label="Mudar tema"`.

**Passos:**
- [ ] **1.** Trocar os valores de `:root` e `.dark` pelos da tabela da seção 3 da spec. Acrescentar:
  - as variáveis de situação, pódio e gráfico;
  - os mapeamentos `--color-sucesso: var(--sucesso)` (e semelhantes) em `@theme inline`.

  As variáveis `--sidebar*` não mudam. Ouro, prata e bronze:

  | | Claro | Escuro |
  |---|---|---|
  | ouro | `#D97706` | `#F59E0B` |
  | prata | `#94A3B8` | `#CBD5E1` |
  | bronze | `#B45309` | `#D97706` |

- [ ] **2.** Em `layout.tsx`: `<html … suppressHydrationWarning>` e o conteúdo do `<body>` dentro de `<ProvedorTema>`.
- [ ] **3.** Ajustar o `Toaster`:
  - tirar `richColors` do uso em `layout.tsx`;
  - em `sonner.tsx`, aplicar `toastOptions.classNames` com fundo `bg-popover`, `border` e ícone colorido por tipo (`text-sucesso`, `text-perigo`, `text-atencao`, `text-informacao`).
- [ ] **4.** Pôr `SeletorTema` no `Rodape`, ao lado de "Sair", com `compacto` vindo de `useBarraLateral().aberta === false` no desktop.
- [ ] **5.** Conferir numa prévia temporária com botões, cartão, input, dropdown e um aviso disparado:
  - nos dois temas, em 1280 px e 375 px;
  - o seletor com o menu aberto e recolhido.

  Depois apagar a prévia.
- [ ] **6.** Rodar `npm run lint && npm run typecheck && npm run test`; tudo deve passar sem erros.
- [ ] **7.** Commit `feat(visual): tema claro e escuro com as cores da marca`.

### Tarefa 2: Peças de interface
**Arquivos:** criar em `src/componentes/`:
- `cabecalho-pagina.tsx`;
- `cartao-numero.tsx`;
- `anel-percentual.tsx`;
- `chip-situacao.tsx`;
- `podio.tsx` (`"use client"` não é necessário);
- `estado-vazio.tsx`;
- os testes `regras-visuais.test.ts` e `regras-visuais.ts`.

**Produz:**
- `type Tom = "sucesso" | "atencao" | "perigo" | "informacao" | "neutro"`.
- `faixaDoPercentual(p: number | null): "sucesso" | "atencao" | "perigo" | null` (≥80, 60–79, <60), em `regras-visuais.ts`.
- `textoVariacao(v: number | null): { texto: string; tom: Tom } | null`: `12` → `"↑ 12%"`/sucesso, `-8` → `"↓ 8%"`/perigo, `0` → `"="`/neutro, `null` → `null`.
- `CabecalhoPagina({ titulo, descricao?, acoes?: ReactNode })`, com um `h1`.
- `CartaoNumero({ rotulo, icone?: LucideIcon, valor: ReactNode, variacao?: number | null, unidadeVariacao?: "%" | "pp", tom?: Tom, children? })`.
  - Com `unidadeVariacao="pp"` o texto vira `"↑ 5 pp"`.
- `AnelPercentual({ percentual: number | null, tamanho?: number })` é um SVG com `role="img"` e `aria-label="<n>% no prazo"`.
- `ChipSituacao({ tom?: Tom, cor?: string, icone?: LucideIcon, children, tamanho?: "sm" | "md" })`.
  - `cor` livre usa `color-mix(in oklab, <cor> 14%, transparent)` no fundo e a própria cor na borda.
- `Podio({ itens: { id: string; nome: string; valor: string; foto?: string | null }[] })`.
  - Recebe até 3 itens na ordem de colocação e desenha a ordem visual 2-1-3.
  - Os degraus têm alturas 70/46/32 px, cores `--podio-*` e coroa (`CrownIcon`) no 1º.
- `EstadoVazio({ icone: LucideIcon, titulo, descricao?, acao?: ReactNode })`.

**Passos:**
- [ ] **1.** Escrever os testes de `faixaDoPercentual`: `80` → sucesso, `79` → atencao, `60` → atencao, `59` → perigo, `null` → null.
- [ ] **2.** Escrever os testes de `textoVariacao` com os casos acima. Incluir `-0`, que deve dar `"="`.
- [ ] **3.** Rodar `npx vitest run src/componentes` e confirmar que FALHA.
- [ ] **4.** Implementar as funções e as seis peças.
- [ ] **5.** Conferir numa prévia temporária com todas as peças e todos os tons, nos dois temas, em 375 e 1280 px. Incluir o pódio com 1, 2 e 3 itens. Apagar a prévia.
- [ ] **6.** Rodar lint, typecheck e testes; tudo deve passar.
- [ ] **7.** Commit `feat(visual): peças de interface (cabeçalho, números, chips, pódio, vazio)`.

### Tarefa 3: Regras novas do relatório
**Arquivos:** modificar `src/modulos/tarefas/regras/relatorio.ts` e `relatorio.test.ts`.

**Consome:** `Intervalo`, `LinhaRelatorio`, `situacaoPrazo`, `somarDias`, `diaEmSaoPaulo`.

**Produz:**
- `intervaloAnterior(i: Intervalo): Intervalo`.
  - `semana`: os 7 dias antes.
  - `mes`: o mês anterior inteiro.
  - `mes_passado`: o mês antes dele.
  - `intervalo`: os N dias imediatamente antes, com N = número de dias do intervalo.
  - O `periodo` é mantido.
- `variacao(atual: number, anterior: number): number | null`. Retorna `Math.round((atual - anterior) / anterior * 100)`, ou `null` se `anterior === 0`.
- `variacaoPontos(atual: number | null, anterior: number | null): number | null`. É a diferença em pontos percentuais, `null` se algum dos dois for `null`.
- `type Balde = { inicio: string; fim: string; rotulo: string }`.
- `baldesDoIntervalo(i: Intervalo): Balde[]`.
  - Usa semanas de segunda a domingo que tocam `[primeiroDia, ultimoDia]`, recortadas ao intervalo, com rótulo `"DD/MM"` do início.
  - Acima de 13 semanas, usa meses, com rótulo `"mmm/AA"` em português minúsculo (ex.: `"jan/27"`).
- `distribuirPorBalde(entregues: { dataEntrega: Date | null; concluidaEm: Date }[], baldes: Balde[]): { rotulo: string; noPrazo: number; atrasadas: number; semData: number }[]`.
  - O balde é decidido pelo dia de `concluidaEm` em São Paulo.
  - A situação vem de `situacaoPrazo`.
- `podio(linhas: LinhaRelatorio[]): LinhaRelatorio[]`.
  - Só linhas com `noPrazo > 0`.
  - Ordena por `noPrazo` desc, depois `percentual` desc (com `null` por último), depois `pessoa.nome` (`localeCompare` com `"pt-BR"`).
  - Devolve no máximo 3.

**Passos:**
- [ ] **1.** Escrever os testes:
  - `intervaloAnterior` para:
    - semana de 02/11/2026 → 26/10–01/11;
    - mês de nov/2026 → out/2026 inteiro;
    - mês de jan/2027 → dez/2026;
    - intervalo de 10–19/11 → 31/10–09/11.
  - `variacao(12, 10)` → `20`; `variacao(5, 0)` → `null`; `variacao(0, 4)` → `-100`.
  - `variacaoPontos(80, 75)` → `5`; `variacaoPontos(null, 75)` → `null`.
  - `baldesDoIntervalo`:
    - mês de nov/2026 dá 5 baldes, o primeiro `{ inicio: "2026-11-01", fim: "2026-11-01", rotulo: "01/11" }` (domingo) e o último terminando em `2026-11-30`;
    - um intervalo de 2026-01-01 a 2026-12-31 dá 12 baldes, de `"jan/26"` a `"dez/26"`.
  - `distribuirPorBalde`: uma entrega concluída às 23h de 08/11 (São Paulo), que já é 09/11 em UTC, cai no balde da semana de 02–08/11.
  - `podio`:
    - empate em `noPrazo` desempata por `percentual`;
    - empate total ordena por nome;
    - uma linha com `noPrazo = 0` fica fora;
    - 5 linhas válidas devolvem 3.
- [ ] **2.** Confirmar que FALHA. **3.** Implementar. **4.** Confirmar que passa.
- [ ] **5.** Commit `feat(tarefas): comparação, semanas e pódio no relatório`.

### Tarefa 4: Tela do Relatório
**Arquivos:**
- Modificar:
  - `src/modulos/tarefas/servicos/relatorio.ts`;
  - `src/app/(app)/tarefas/relatorio/page.tsx`;
  - `src/modulos/tarefas/componentes/filtros-relatorio.tsx` (só tokens).
- Criar `src/modulos/tarefas/componentes/grafico-entregas.tsx` (`"use client"`, recharts).

**Consome:** as funções da Tarefa 3 e as peças da Tarefa 2.

**Produz:**
- `obterRelatorio` passa a devolver também:
  - `anterior: { minhaLinha: LinhaRelatorio }`, calculado com uma consulta de entregues em `intervaloAnterior(intervalo)`. Abertas não se recalculam;
  - `serie: ReturnType<typeof distribuirPorBalde>`;
  - `podio: LinhaRelatorio[]`, vazio quando `!equipe`.
- `GraficoEntregas({ dados })`: colunas empilhadas.
  - Cores: `var(--chart-1)` no prazo, `var(--perigo)` com atraso, `var(--muted-foreground)` sem data.
  - Legenda embaixo, tooltip com os três números, eixos com `tabular-nums`.

**Decisão (escopo dos números):**
- Os quatro cartões continuam sendo os números do próprio usuário, como hoje e como diz `docs/modulos/tarefas.md`.
- O gráfico usa o mesmo escopo da tabela: a equipe para quem a vê, ou só o usuário.
- O gráfico conta cada tarefa uma vez, mesmo com vários responsáveis.

**Passos:**
- [ ] **1.** Implementar as mudanças do serviço com uma só ida a mais ao banco, rodando em paralelo no `Promise.all`.
- [ ] **2.** Montar a página com estes blocos, do topo para baixo:
  - `CabecalhoPagina` com o título "Relatório", a descrição "Entregas e prazos no período" e os filtros em `acoes`;
  - grade de 4 `CartaoNumero`:
    - Abertas;
    - Atrasadas agora, com tom `perigo`;
    - Entregues, com `variacao`;
    - No prazo, com `AnelPercentual` e `variacaoPontos` em `"pp"`;
  - `Podio` com o título "Pódio do período" e o subtítulo "entregas no prazo", mostrado só com `podio.length > 0`;
  - `GraficoEntregas` com o título "Entregas por semana", que vira "por mês" quando o balde é mensal;
  - a tabela por pessoa.

  No computador, o pódio e o gráfico ficam lado a lado (`lg:grid-cols-2`). Sem pódio, o gráfico ocupa a linha inteira.
- [ ] **3.** Tabela por pessoa no celular: abaixo de `md`, renderizar cartões com nome, os quatro números e `ChipSituacao` do %; a `<table>` fica `hidden md:table`. O detalhe da pessoa (`?pessoa=`) usa `ChipSituacao` no selo "No prazo/Atrasada/Sem data".
- [ ] **4.** Conferir numa prévia temporária com dados fictícios, montando a página a partir das peças e com dados injetados:
  - com pódio de 3, de 1 e sem pódio;
  - com um intervalo de um ano;
  - nos dois temas, em 1280 e 375 px.

  Apagar a prévia.
- [ ] **5.** Rodar lint, typecheck e testes, e fazer o commit `feat(tarefas): relatório com números em blocos, pódio e gráfico`.

### Tarefa 5: Minhas tarefas
**Arquivos:**
- Modificar `src/app/(app)/tarefas/minhas/page.tsx` e `src/modulos/tarefas/regras/prazo.ts` (+ `prazo.test.ts`).
- Criar `src/modulos/tarefas/componentes/chips-tarefa.tsx`.

**Produz:**
- `rotuloChipPrazo(s: { tom: TomEntrega; dias: number }, dataEntrega: Date): { texto: string; tom: Tom }`, em `prazo.ts`. Textos e tons exatos da tabela da seção 5 da spec:
  - "Atrasada 1 dia" / "Atrasada N dias";
  - "Vence hoje" e "Vence amanhã";
  - "Em N dias";
  - data curta `"DD/MM"`;
  - "Concluída".
- `ChipPrazo({ dataEntrega, concluidaEm })` e `ChipStatus({ nome, cor })`, ambos em `chips-tarefa.tsx`. Os dois são reutilizados nas Tarefas 6 e 7.

**Passos:**
- [ ] **1.** Escrever os testes de `rotuloChipPrazo`: atrasada com 1 e 3 dias, hoje, amanhã, próxima com 4 dias, futura (`"20/12"`) e concluída.
- [ ] **2.** Confirmar que falham, implementar e confirmar que passam.
- [ ] **3.** Montar a página:
  - `CabecalhoPagina` "Minhas tarefas";
  - três `CartaoNumero`: Atrasadas (tom `perigo`), Hoje (`atencao`) e Próximos 7 dias;
  - os grupos atuais, com cada linha mostrando título, `ChipPrazo` e `ChipStatus`;
  - `EstadoVazio` com o título "Nada atribuído a você" e um botão para `/tarefas` quando não houver tarefas.
- [ ] **4.** Fazer a prévia nos dois temas e tamanhos e apagá-la.
- [ ] **5.** Rodar lint, typecheck e testes. Commit `feat(tarefas): minhas tarefas com resumo e chips`.

### Tarefa 6: Lista e Quadro
**Arquivos:** modificar:
- `cartao-tarefa.tsx`;
- `quadro-tarefas.tsx`;
- `tabela-tarefas.tsx`;
- `filtros-lista.tsx`;
- `alternar-visao.tsx`;
- `exibicao.tsx`;
- `src/app/(app)/tarefas/listas/[listaId]/page.tsx`.

**Consome:** `ChipPrazo`, `ChipStatus`, `ChipSituacao`, `CabecalhoPagina` e `EstadoVazio`.

**Passos:**
- [ ] **1.** No cartão, trocar o selo de entrega e o de prioridade por chips:

  | Prioridade | Tom |
  |---|---|
  | urgente | `perigo` |
  | alta | `atencao` |
  | normal | `neutro` |
  | baixa | `neutro` |

  Mantêm-se a faixa de prioridade, as etiquetas, o anel do checklist, as fotos e o menu "Mover para". Trocar toda cor fixa por token.
- [ ] **2.** Cabeçalho das colunas do quadro: ponto na cor do status, o nome e a contagem num `ChipSituacao tom="neutro" tamanho="sm"`.
- [ ] **3.** Tabela:
  - abaixo de `md`, cada tarefa vira um cartão com título, `ChipStatus`, `ChipPrazo`, chip de prioridade e avatares;
  - a `<table>` fica `hidden md:table`;
  - em lista vazia, `EstadoVazio` "Crie a primeira tarefa desta lista" com o `NovaTarefaRapida`.
- [ ] **4.** A página da lista usa `CabecalhoPagina`, com o nome da lista, o espaço na descrição e `AlternarVisao` mais os filtros nas ações.
- [ ] **5.** Fazer a prévia nos dois temas, a 375 px, sem rolagem horizontal, e apagá-la.
- [ ] **6.** Rodar lint, typecheck e testes. Commit `feat(tarefas): lista e quadro com chips e versão celular`.

### Tarefa 7: Painel da tarefa, configurações, docs e publicação
**Arquivos:**
- Modificar:
  - `painel-tarefa.tsx`;
  - `checklist-tarefa.tsx`;
  - `historico-tarefa.tsx`;
  - `etiquetas.tsx` (só tokens);
  - `configuracoes-espaco.tsx`;
  - `configurar-status.tsx`;
  - `menu-tarefas.tsx`;
  - `src/app/(app)/tarefas/espacos/[espacoId]/configuracoes/page.tsx`;
  - `docs/modulos/tarefas.md`.

**Passos:**
- [ ] **1.** Cabeçalho fixo do painel: o caminho, `ChipStatus` e `ChipPrazo`, e as ações de excluir e fechar.
- [ ] **2.** Corpo do painel em seções com `<h3>` discreto e `Separator`: Detalhes, Etiquetas, Checklist, Subtarefas e Histórico.
- [ ] **3.** Abaixo de `sm`, o botão "Salvar alterações" fica em barra fixa no rodapé do painel (`sticky bottom-0`, fundo `bg-background`, borda no topo).
- [ ] **4.** Checklist e histórico: trocar `#5F45F4` e `accent-[#5F45F4]` por `primary` (`bg-primary`, `accent-primary`).
- [ ] **5.** Nas configurações e no menu do módulo, usar só tokens e aplicar `CabecalhoPagina`.
- [ ] **6.** Atualizar `docs/modulos/tarefas.md`:
  - na seção Telas, o Relatório ganha a variação, o pódio e o gráfico, com a regra do escopo da Tarefa 4;
  - na Situação da implementação, entra "visual etapa 1".
- [ ] **7.** Rodar `grep -rnE "bg-white|text-(gray|slate|zinc)-|bg-(gray|slate)-|#5F45F4|#111416" src/modulos/tarefas "src/app/(app)/tarefas"`. A saída deve ser vazia.
- [ ] **8.** Fazer a prévia final nos dois temas e em 375 px, com o painel aberto, e apagá-la. Rodar lint, typecheck e testes. Commit `feat(tarefas): painel e configurações no visual novo` e `docs(tarefas): visual etapa 1`.
- [ ] **9.** Publicar:
  - `git fetch` e conferir `HEAD..origin/teste`;
  - se houver commits de outras sessões ainda não publicados em cima, avisar a sessão dona e o usuário antes do push;
  - `git push origin teste`;
  - acompanhar o build com `hosting_get-deployment` até `completed`.
- [ ] **10.** Entregar ao usuário um roteiro curto: trocar o tema no menu, abrir Minhas tarefas, uma lista em Quadro e Lista, uma tarefa e o Relatório, no computador e no celular.
