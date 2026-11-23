// Quem é o aluno de uma venda: primeiro pelo WhatsApp, depois pelo nome.

/** Só dígitos e sem o 55 do Brasil, para comparar números gravados de jeitos diferentes. */
const semDdi = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.startsWith("55") && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
};

export function mesmoTelefone(a: string | null, b: string | null): boolean {
  return !!a && !!b && semDdi(a) === semDdi(b);
}

/** Mesmo telefone; senão mesmo nome sem telefone diferente; senão ninguém. */
export function acharAlunoDaVenda<T extends { id: string; nomeBusca: string; telefone: string | null }>(
  alunos: readonly T[],
  cliente: { nomeBusca: string; whatsapp: string | null },
): T | null {
  const porTelefone = alunos.find((a) => mesmoTelefone(a.telefone, cliente.whatsapp));
  if (porTelefone) return porTelefone;
  return alunos.find((a) => a.nomeBusca === cliente.nomeBusca && !(a.telefone && cliente.whatsapp)) ?? null;
}
