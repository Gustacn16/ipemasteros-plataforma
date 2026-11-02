/** Grava um cookie de preferência no navegador (sem dado pessoal). `null` apaga. */
export function gravarCookie(nome: string, valor: string | null, caminho: string, dias = 365) {
  const idade = valor === null ? 0 : dias * 24 * 60 * 60;
  document.cookie = `${nome}=${valor === null ? "" : encodeURIComponent(valor)}; path=${caminho}; max-age=${idade}; samesite=lax`;
}
