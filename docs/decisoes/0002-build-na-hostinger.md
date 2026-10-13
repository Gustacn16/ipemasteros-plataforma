# 0002 — Build compatível com o servidor da Hostinger

- **Status:** Aceito
- **Data:** 2026-10-13

## Contexto
O primeiro deploy na Hostinger Cloud falhou. O sistema operacional do servidor tem **glibc anterior à 2.29**. O compilador nativo do Next.js 16 (`@next/swc-linux-x64-gnu`, do qual o Turbopack também depende) exige **glibc 2.30**. Com isso:
- o binário nativo do SWC não carrega;
- o Next cai para o SWC em WebAssembly, mas **o Turbopack não roda em WebAssembly**;
- `next.config.ts` não pôde ser lido, porque transpilar o config também depende do SWC.

Verificamos as outras dependências nativas do build: `@tailwindcss/oxide` e `lightningcss` exigem só glibc 2.14 e funcionam no servidor.

## Decisão
1. **Build com webpack:** `npm run build` = `next build --webpack`. O `next dev` local continua com Turbopack, porque é mais rápido.
2. **`next.config.mjs`** em vez de `next.config.ts`.
3. **`@next/swc-wasm-nodejs`** fica como dependência de desenvolvimento, **na mesma versão exata do `next`**, para o build não depender de baixar o WASM na hora.
4. **Tailwind via PostCSS** (`@tailwindcss/postcss` + `postcss.config.mjs`), que funciona tanto no webpack quanto no Turbopack.

**Validação local:** o build e o `next start` rodaram com o binário nativo removido de `node_modules`, simulando o servidor. A página respondeu 200 e o CSS do Tailwind estava aplicado.

## Regras daqui em diante
- Ao atualizar o `next`, atualizar o `@next/swc-wasm-nodejs` para a **mesma versão**.
- **Toda dependência com binário nativo** precisa ser conferida antes de entrar no projeto: versão de glibc exigida ≤ 2.28, ou existência de fallback em JS/WASM.
- **Prisma:** usar a versão sem engine Rust (Prisma 7, query compiler em TS/WASM) com driver adapter para MySQL/MariaDB (`@prisma/adapter-mariadb`). Assim evitamos depender de binário nativo.
- Senhas: o hash do Better Auth (scrypt em JS) é compatível. Não adotar `bcrypt` nativo.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Rebaixar para Next.js 15 | Também exige glibc mais nova no SWC recente e nos deixaria numa versão antiga |
| Forçar o binário `musl` do SWC | Hack frágil no `npm install`, sem garantia de carregar num processo glibc |
| Migrar para VPS Hostinger | Resolve, mas exige administrar servidor. Fica como plano B se o build WASM ficar lento demais |
| Fazer o build no GitHub Actions e enviar o `.next` pronto | Viável, mas abre mão do deploy automático nativo da Hostinger. Reavaliar se o build crescer |

## Consequências
- O build é mais lento (webpack + WASM) do que seria com Turbopack nativo. Para o porte do projeto, isso é aceitável.
- Existe uma diferença entre dev (Turbopack) e produção (webpack). Antes de subir, rodar `npm run build` localmente.
- Se a Hostinger atualizar o sistema operacional (glibc ≥ 2.30), dá para voltar ao Turbopack removendo o `--webpack`.
