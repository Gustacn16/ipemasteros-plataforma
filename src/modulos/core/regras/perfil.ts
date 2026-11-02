/** Regras do cadastro de perfil (dados básicos e foto), sem dependência de servidor. */

export const TAMANHO_MAX_FOTO = 512 * 1024;
export const LADO_FOTO = 400;

export type TipoFoto = "image/jpeg" | "image/png" | "image/webp";

/** Tipo real da imagem pelos primeiros bytes (não confia na extensão nem no tipo enviado). */
export function tipoDaImagem(b: Uint8Array): TipoFoto | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  const ascii = (ini: number, fim: number) => String.fromCharCode(...b.slice(ini, fim));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Só dígitos, sem o 55 do Brasil. Ex.: "+55 (61) 99999-0000" → "61999990000". */
export function normalizarWhatsapp(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

/** "61999990000" → "(61) 99999-0000". */
export function formatarWhatsapp(digitos: string): string {
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}

/** Idade em anos completos numa data de referência (ambas "AAAA-MM-DD"). */
export function idadeEm(nascimento: string, hoje: string): number {
  const [an, mn, dn] = nascimento.split("-").map(Number);
  const [ah, mh, dh] = hoje.split("-").map(Number);
  return ah - an - (mh < mn || (mh === mn && dh < dn) ? 1 : 0);
}
