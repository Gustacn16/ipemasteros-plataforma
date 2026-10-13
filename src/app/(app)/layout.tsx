import Link from "next/link";
import { Button } from "@/componentes/ui/button";
import { ROTULO_PAPEL, temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { sairAcao } from "@/modulos/core/acoes/autenticacao";
import { MenuNavegacao, type ItemMenu } from "./menu-navegacao";

const MODULOS: ItemMenu[] = [
  { href: "/inicio", rotulo: "Início" },
  { href: "/tarefas", rotulo: "Tarefas", emBreve: true },
  { href: "/agenda", rotulo: "Agenda", emBreve: true },
  { href: "/academico", rotulo: "Acadêmico", emBreve: true },
  { href: "/conteudo", rotulo: "Conteúdo", emBreve: true },
  { href: "/dashboard", rotulo: "Dashboard", emBreve: true },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();

  const admin: ItemMenu[] = [
    ...(temPermissao(usuario.papel, "core:ver_usuarios") ? [{ href: "/admin/usuarios", rotulo: "Usuários" }] : []),
    ...(temPermissao(usuario.papel, "core:ver_auditoria") ? [{ href: "/admin/auditoria", rotulo: "Auditoria" }] : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col gap-6 border-b p-4 md:w-60 md:border-r md:border-b-0">
        <Link href="/inicio" className="text-lg font-semibold tracking-tight">
          IPEMaster OS
        </Link>
        <MenuNavegacao modulos={MODULOS} admin={admin} />
        <div className="mt-auto grid gap-2 border-t pt-4 text-sm">
          <div>
            <p className="truncate font-medium">{usuario.nome}</p>
            <p className="text-muted-foreground truncate">{ROTULO_PAPEL[usuario.papel]}</p>
          </div>
          <form action={sairAcao}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
