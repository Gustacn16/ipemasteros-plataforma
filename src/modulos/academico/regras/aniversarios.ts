// Aniversários de alunos e professores. Funções puras sobre dias "aaaa-mm-dd".

export type Pessoa = { id: string; nome: string; tipo: "aluno" | "professor"; dataNascimento: string; telefone: string | null };
export type Aniversario = Pessoa & { /** Dia do aniversário no ano do aviso, "aaaa-mm-dd". */ dia: string; hoje: boolean };

const bissexto = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

/** Dia do aniversário em `ano`; quem nasceu em 29/02 comemora em 28/02 nos anos comuns. */
function diaNoAno(nascimento: string, ano: number): string {
  let md = nascimento.slice(5);
  if (md === "02-29" && !bissexto(ano)) md = "02-28";
  return `${ano}-${md}`;
}

const porDiaENome = (a: Aniversario, b: Aniversario) => a.dia.localeCompare(b.dia) || a.nome.localeCompare(b.nome, "pt-BR");

/** Quem faz aniversário no mês de `hoje`. */
export function aniversariantesDoMes(pessoas: readonly Pessoa[], hoje: string): Aniversario[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = hoje.slice(0, 7);
  return pessoas
    .map((p) => ({ ...p, dia: diaNoAno(p.dataNascimento, ano) }))
    .filter((a) => a.dia.startsWith(mes))
    .map((a) => ({ ...a, hoje: a.dia === hoje }))
    .sort(porDiaENome);
}

const somar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Quem faz aniversário de `hoje` até `hoje + dias`, inclusive, atravessando a virada do ano. */
export function proximosAniversarios(pessoas: readonly Pessoa[], hoje: string, dias: number): Aniversario[] {
  const ate = somar(hoje, dias);
  const ano = Number(hoje.slice(0, 4));
  return pessoas
    .map((p) => {
      const esteAno = diaNoAno(p.dataNascimento, ano);
      return { ...p, dia: esteAno >= hoje ? esteAno : diaNoAno(p.dataNascimento, ano + 1) };
    })
    .filter((a) => a.dia <= ate)
    .map((a) => ({ ...a, hoje: a.dia === hoje }))
    .sort(porDiaENome);
}

/** Link que abre a conversa no WhatsApp; DDI 55 quando o número vem só com DDD. */
export function linkWhatsapp(telefone: string | null): string | null {
  const d = telefone?.replace(/\D/g, "") ?? "";
  if (d.length === 10 || d.length === 11) return `https://wa.me/55${d}`;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return `https://wa.me/${d}`;
  return null;
}
