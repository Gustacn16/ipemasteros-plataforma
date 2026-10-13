# 0003 — Cache Components desligado

- **Status:** Aceito
- **Data:** 2026-10-13

## Contexto
O template do Next.js 16 veio com `cacheComponents` e `partialPrefetching` ligados. Nesse modo, as páginas são pré-geradas por padrão, e qualquer leitura de dado da requisição (cookie de sessão, cabeçalhos) precisa ficar dentro de um `<Suspense>`. Caso contrário, o build quebra.

No IPEMaster OS, praticamente **todas as páginas dependem do usuário logado** e de dados que mudam a todo momento. As exceções são poucas: login e os formulários públicos.

## Decisão
Desligar `cacheComponents` (e `partialPrefetching`, que depende dele). As páginas que leem sessão ficam dinâmicas, renderizadas a cada requisição. É o modelo tradicional do App Router.

## Alternativas consideradas
- **Manter ligado:** todo acesso a sessão precisaria de `<Suspense>` e de `use cache: private`. A complexidade é alta e os erros de build são fáceis de cometer, para um ganho pequeno num sistema interno de poucos usuários.

## Consequências
- Código mais simples: `obterUsuarioAtual()` pode ser chamado direto em layouts e páginas.
- Uma página que não lê nada da requisição pode ser gerada como estática no build. Se ela depende de banco ou de variável de ambiente, chame `await connection()` (de `next/server`) para que rode a cada acesso. Exemplo: `/primeiro-acesso`.
- Se no futuro alguma área pública precisar de desempenho máximo, reavaliar com um novo ADR.
