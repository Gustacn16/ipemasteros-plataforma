import { ROTULO_PAPEL, temPermissao } from "@/lib/permissoes";
import { iaConfigurada } from "@/lib/ia/cliente";
import { exigirUsuario } from "@/lib/sessao";
import { contarSinaisNovos } from "@/modulos/espiao/servicos/visao";
import { PainelNexu } from "@/modulos/nexu/componentes/painel-nexu";
import { MenuNavegacao, type ItemMenu } from "./menu-navegacao";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  // Falhar a contagem não pode derrubar o menu.
  const sinaisNovos = temPermissao(usuario.papel, "espiao:ver") ? await contarSinaisNovos(usuario.id).catch(() => 0) : 0;
  const modulos: ItemMenu[] = [
    { href: "/inicio", rotulo: "Início", icone: "inicio" },
    ...(temPermissao(usuario.papel, "tarefas:usar") ? [{ href: "/tarefas", rotulo: "Tarefas", icone: "tarefas" } as const] : []),
    ...(temPermissao(usuario.papel, "conteudo:usar") ? [{ href: "/conteudo", rotulo: "Conteúdo", icone: "conteudo" } as const] : []),
    ...(temPermissao(usuario.papel, "agenda:usar") ? [{ href: "/agenda", rotulo: "Agenda", icone: "agenda" } as const] : []),
    ...(temPermissao(usuario.papel, "academico:ver") ? [{ href: "/academico", rotulo: "Acadêmico", icone: "academico" } as const] : []),
    ...(temPermissao(usuario.papel, "comercial:ver") ? [{ href: "/comercial", rotulo: "Comercial", icone: "comercial" } as const] : []),
    ...(temPermissao(usuario.papel, "espiao:ver") ? [{ href: "/espiao", rotulo: "Espião", icone: "espiao", contador: sinaisNovos } as const] : []),
    ...(temPermissao(usuario.papel, "nexu:usar") ? [{ href: "/nexu", rotulo: "Nexu", icone: "nexu" } as const] : []),
    ...(temPermissao(usuario.papel, "whatsapp:gerenciar_numeros") ||
    temPermissao(usuario.papel, "whatsapp:conectar_proprio") ||
    temPermissao(usuario.papel, "whatsapp:ver_grupos") ||
    temPermissao(usuario.papel, "whatsapp:ver_proprio")
      ? [{ href: "/whatsapp", rotulo: "WhatsApp", icone: "whatsapp" } as const]
      : []),
  ];

  const admin: ItemMenu[] = [
    ...(temPermissao(usuario.papel, "core:ver_usuarios")
      ? [{ href: "/admin/usuarios", rotulo: "Usuários", icone: "usuarios" } as const]
      : []),
    ...(temPermissao(usuario.papel, "core:ver_auditoria")
      ? [{ href: "/admin/auditoria", rotulo: "Auditoria", icone: "auditoria" } as const]
      : []),
    ...(temPermissao(usuario.papel, "whatsapp:gerenciar_numeros")
      ? [{ href: "/admin/saude", rotulo: "Saúde", icone: "saude" } as const]
      : []),
    ...(temPermissao(usuario.papel, "nexu:configurar") ? [{ href: "/admin/nexu", rotulo: "Nexu", icone: "nexu" } as const] : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MenuNavegacao modulos={modulos} admin={admin} usuario={{ nome: usuario.nome, papel: ROTULO_PAPEL[usuario.papel] }} />
      <main className="flex min-w-0 flex-1 flex-col p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-8 md:pb-8">{children}</main>
      {temPermissao(usuario.papel, "nexu:usar") && (
        <PainelNexu
          configurado={iaConfigurada()}
          motivo={temPermissao(usuario.papel, "nexu:configurar") ? "Falta a chave ANTHROPIC_API_KEY no hPanel." : undefined}
        />
      )}
    </div>
  );
}
