/**
 * Resumo de um erro para o log: só o nome e os códigos (do Prisma e do banco).
 * Nunca a mensagem, que pode trazer valores da consulta (LGPD).
 * Ex.: "PrismaClientKnownRequestError P2039 mysql:45028".
 */
export function descreverErro(erro: unknown): string {
  if (!(erro instanceof Error)) return typeof erro;
  const partes = [erro.name];
  const { code, meta } = erro as { code?: unknown; meta?: { driverAdapterError?: { cause?: { kind?: unknown; originalCode?: unknown } } } };
  if (typeof code === "string" && /^[A-Z]\d{4}$/.test(code)) partes.push(code);
  const causa = meta?.driverAdapterError?.cause;
  if (causa && typeof causa.kind === "string") {
    const original = typeof causa.originalCode === "string" && /^[\w-]{1,12}$/.test(causa.originalCode) ? `:${causa.originalCode}` : "";
    partes.push(`${causa.kind.slice(0, 30)}${original}`);
  }
  return partes.join(" ");
}
