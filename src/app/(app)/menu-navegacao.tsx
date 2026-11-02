"use client";

import Link from "next/link";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NovaLista, NovoEspaco } from "@/modulos/tarefas/componentes/dialogos-estrutura";

export type ItemMenu = { href: string; rotulo: string; emBreve?: boolean };

function Item({ item, ativo, recuo }: { item: ItemMenu; ativo: boolean; recuo?: boolean }) {
  if (item.emBreve) {
    return (
      <span className="text-muted-foreground flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
        {item.rotulo}
        <span className="text-xs">em breve</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "hover:bg-sidebar-accent truncate rounded-md px-2 py-1.5 text-sm",
        recuo && "pl-6.5",
        ativo && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
      )}
    >
      {item.rotulo}
    </Link>
  );
}

export type EspacoMenu = { id: string; nome: string; cor: string; listas: { id: string; nome: string }[] };

type PropsEspacos = {
  espacos: EspacoMenu[];
  podeCriarEspaco: boolean;
  podeCriarLista: boolean;
  estaAtivo: (href: string) => boolean;
};

const botaoIcone = "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground rounded p-1";

function ArvoreEspacos({ espacos, podeCriarEspaco, podeCriarLista, estaAtivo }: PropsEspacos) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center justify-between px-2">
        <p className="text-muted-foreground text-xs font-medium uppercase">Espaços</p>
        {podeCriarEspaco && (
          <NovoEspaco
            gatilho={
              <button type="button" className={botaoIcone} aria-label="Novo espaço">
                <PlusIcon className="size-3.5" />
              </button>
            }
          />
        )}
      </div>
      {espacos.length === 0 && (
        <p className="text-muted-foreground px-2 py-1 text-sm">
          {podeCriarEspaco ? "Crie o primeiro espaço no +." : "Você ainda não participa de nenhum espaço."}
        </p>
      )}
      {espacos.map((espaco) => (
        <div key={espaco.id} className="grid gap-0.5">
          <div className="group flex items-center gap-2 px-2 py-1 text-sm font-medium">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: espaco.cor }} aria-hidden />
            <span className="flex-1 truncate">{espaco.nome}</span>
            {podeCriarEspaco && (
              <Link href={`/tarefas/espacos/${espaco.id}/configuracoes`} className={botaoIcone} aria-label={`Configurar ${espaco.nome}`}>
                <SettingsIcon className="size-3.5" />
              </Link>
            )}
            {podeCriarLista && (
              <NovaLista
                espacoId={espaco.id}
                espacoNome={espaco.nome}
                gatilho={
                  <button type="button" className={botaoIcone} aria-label={`Nova lista em ${espaco.nome}`}>
                    <PlusIcon className="size-3.5" />
                  </button>
                }
              />
            )}
          </div>
          {espaco.listas.map((lista) => (
            <Item
              key={lista.id}
              item={{ href: `/tarefas/listas/${lista.id}`, rotulo: lista.nome }}
              ativo={estaAtivo(`/tarefas/listas/${lista.id}`)}
              recuo
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MenuNavegacao({
  modulos,
  admin,
  espacos,
}: {
  modulos: ItemMenu[];
  admin: ItemMenu[];
  espacos?: Omit<PropsEspacos, "estaAtivo">;
}) {
  const caminho = usePathname();
  const estaAtivo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  return (
    <nav aria-label="Principal" className="grid gap-4">
      <div className="grid gap-0.5">
        {modulos.map((item) => (
          <Item key={item.href} item={item} ativo={estaAtivo(item.href)} />
        ))}
      </div>
      {espacos && <ArvoreEspacos {...espacos} estaAtivo={estaAtivo} />}
      {admin.length > 0 && (
        <div className="grid gap-0.5">
          <p className="text-muted-foreground px-2 text-xs font-medium uppercase">Administração</p>
          {admin.map((item) => (
            <Item key={item.href} item={item} ativo={estaAtivo(item.href)} />
          ))}
        </div>
      )}
    </nav>
  );
}
