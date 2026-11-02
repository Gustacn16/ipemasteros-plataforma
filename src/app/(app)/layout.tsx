import { ROTULO_PAPEL, temPermissao } from "@/lib/permissoes";
import { exigirUsuario } from "@/lib/sessao";
import { MenuNavegacao, type ItemMenu } from "./menu-navegacao";

const MODULOS_FUTUROS: ItemMenu[] = [
  { href: "/agenda", rotulo: "Agenda", icone: "agenda", emBreve: true },
  { href: "/academico", rotulo: "Acadêmico", icone: "academico", emBreve: true },
  { href: "/dashboard", rotulo: "Dashboard", icone: "dashboard", emBreve: true },
];

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const modulos: ItemMenu[] = [
    { href: "/inicio", rotulo: "Início", icone: "inicio" },
    ...(temPermissao(usuario.papel, "tarefas:usar") ? [{ href: "/tarefas", rotulo: "Tarefas", icone: "tarefas" } as const] : []),
    ...(temPermissao(usuario.papel, "conteudo:usar") ? [{ href: "/conteudo", rotulo: "Conteúdo", icone: "conteudo" } as const] : []),
    ...MODULOS_FUTUROS,
  ];

  const admin: ItemMenu[] = [
    ...(temPermissao(usuario.papel, "core:ver_usuarios") ? [{ href: "/admin/usuarios", rotulo: "Usuários", icone: "usuarios" } as const] : []),
    ...(temPermissao(usuario.papel, "core:ver_auditoria") ? [{ href: "/admin/auditoria", rotulo: "Auditoria", icone: "auditoria" } as const] : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MenuNavegacao modulos={modulos} admin={admin} usuario={{ nome: usuario.nome, papel: ROTULO_PAPEL[usuario.papel] }} />
      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-8">{children}</main>
    </div>
  );
}
