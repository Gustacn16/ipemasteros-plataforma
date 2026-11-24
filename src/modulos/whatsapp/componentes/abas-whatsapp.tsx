import Link from "next/link";
import { temPermissao, type Papel } from "@/lib/permissoes";

const SECOES = [
  {
    chave: "visao-geral",
    rotulo: "Visão geral",
    abas: [
      { chave: "visao-geral", href: "/whatsapp/visao-geral", rotulo: "Visão geral", permissoes: ["whatsapp:ver_equipe"] },
    ],
  },
  {
    chave: "grupos",
    rotulo: "Grupos",
    abas: [
      { chave: "grupos", href: "/whatsapp/grupos", rotulo: "Grupos", permissoes: ["whatsapp:ver_grupos"] },
      { chave: "avisos", href: "/whatsapp/avisos", rotulo: "Avisos", permissoes: ["whatsapp:avisos"] },
    ],
  },
  {
    chave: "equipe",
    rotulo: "Equipe",
    abas: [
      { chave: "atendimento", href: "/whatsapp/atendimento", rotulo: "Atendimento", permissoes: ["whatsapp:ver_equipe"] },
      { chave: "leads", href: "/whatsapp/leads", rotulo: "Leads", permissoes: ["whatsapp:ver_equipe"] },
      { chave: "cs", href: "/whatsapp/cs", rotulo: "CS", permissoes: ["whatsapp:ver_equipe"] },
      { chave: "conversas", href: "/whatsapp/conversas", rotulo: "Conversas", permissoes: ["whatsapp:ver_equipe", "whatsapp:ver_proprio"] },
    ],
  },
  {
    chave: "configuracoes",
    rotulo: "Configurações",
    abas: [
      { chave: "numeros", href: "/whatsapp/numeros", rotulo: "Números", permissoes: ["whatsapp:gerenciar_numeros", "whatsapp:conectar_proprio"] },
      { chave: "configuracoes", href: "/whatsapp/configuracoes", rotulo: "Ajustes", permissoes: ["whatsapp:gerenciar_numeros"] },
    ],
  },
] as const;

export type AbaWhatsapp = (typeof SECOES)[number]["abas"][number]["chave"];
export type SecaoWhatsapp = (typeof SECOES)[number]["chave"];

type AbaVisivel = { chave: AbaWhatsapp; href: string; rotulo: string };
type SecaoVisivel = { chave: SecaoWhatsapp; rotulo: string; href: string; abas: AbaVisivel[] };

/** Seções com ao menos uma aba visível ao papel; o href da seção é o da primeira aba visível. */
export function secoesDoPapel(papel: Papel): SecaoVisivel[] {
  const resultado: SecaoVisivel[] = [];
  for (const s of SECOES) {
    const abas: AbaVisivel[] = s.abas
      .filter((a) => a.permissoes.some((p) => temPermissao(papel, p)))
      .map((a) => ({ chave: a.chave, href: a.href, rotulo: a.rotulo }));
    if (abas.length > 0) resultado.push({ chave: s.chave, rotulo: s.rotulo, href: abas[0].href, abas });
  }
  return resultado;
}

/** Rotas do módulo que o papel pode abrir, na ordem das seções. */
export function abasDoPapel(papel: Papel): AbaVisivel[] {
  return secoesDoPapel(papel).flatMap((s) => s.abas);
}

export function AbasWhatsapp({ papel, ativa }: { papel: Papel; ativa: AbaWhatsapp }) {
  const secoes = secoesDoPapel(papel);
  if (abasDoPapel(papel).length < 2) return null;
  const secaoAtiva = secoes.find((s) => s.abas.some((a) => a.chave === ativa));
  return (
    <div className="space-y-2">
      <nav aria-label="Seções do WhatsApp" className="flex gap-1 border-b">
        {secoes.map((s) => {
          const atual = s.chave === secaoAtiva?.chave;
          return (
            <Link
              key={s.chave}
              href={s.href}
              aria-current={atual ? "page" : undefined}
              className={
                atual
                  ? "border-primary text-foreground -mb-px border-b-2 px-3 py-2 text-sm font-medium"
                  : "text-muted-foreground hover:text-foreground px-3 py-2 text-sm"
              }
            >
              {s.rotulo}
            </Link>
          );
        })}
      </nav>
      {secaoAtiva && secaoAtiva.abas.length >= 2 && (
        <nav aria-label="Abas da seção" className="flex gap-1">
          {secaoAtiva.abas.map((a) => (
            <Link
              key={a.chave}
              href={a.href}
              aria-current={a.chave === ativa ? "page" : undefined}
              className={
                a.chave === ativa
                  ? "bg-muted text-foreground rounded-md px-2.5 py-1 text-xs font-medium"
                  : "text-muted-foreground hover:text-foreground px-2.5 py-1 text-xs"
              }
            >
              {a.rotulo}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
