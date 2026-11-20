import Link from "next/link";
import { temPermissao, type Papel } from "@/lib/permissoes";

const ABAS = [
  { chave: "grupos", href: "/whatsapp/grupos", rotulo: "Grupos", permissoes: ["whatsapp:ver_grupos"] },
  { chave: "atendimento", href: "/whatsapp/atendimento", rotulo: "Atendimento", permissoes: ["whatsapp:ver_equipe"] },
  { chave: "leads", href: "/whatsapp/leads", rotulo: "Leads", permissoes: ["whatsapp:ver_equipe"] },
  { chave: "cs", href: "/whatsapp/cs", rotulo: "CS", permissoes: ["whatsapp:ver_equipe"] },
  { chave: "conversas", href: "/whatsapp/conversas", rotulo: "Conversas", permissoes: ["whatsapp:ver_equipe", "whatsapp:ver_proprio"] },
  { chave: "numeros", href: "/whatsapp/numeros", rotulo: "Números", permissoes: ["whatsapp:gerenciar_numeros", "whatsapp:conectar_proprio"] },
] as const;

export type AbaWhatsapp = (typeof ABAS)[number]["chave"];

/** Rotas do módulo que o papel pode abrir, na ordem das abas. */
export function abasDoPapel(papel: Papel) {
  return ABAS.filter((a) => a.permissoes.some((p) => temPermissao(papel, p)));
}

export function AbasWhatsapp({ papel, ativa }: { papel: Papel; ativa: AbaWhatsapp }) {
  const abas = abasDoPapel(papel);
  if (abas.length < 2) return null;
  return (
    <nav aria-label="Seções do WhatsApp" className="flex gap-1 border-b">
      {abas.map((a) => (
        <Link
          key={a.chave}
          href={a.href}
          aria-current={a.chave === ativa ? "page" : undefined}
          className={
            a.chave === ativa
              ? "border-primary text-foreground -mb-px border-b-2 px-3 py-2 text-sm font-medium"
              : "text-muted-foreground hover:text-foreground px-3 py-2 text-sm"
          }
        >
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
