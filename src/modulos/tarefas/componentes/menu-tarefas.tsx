"use client";

import { ChevronDownIcon, PlusIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NovaLista, NovoEspaco } from "./dialogos-estrutura";

export type EspacoMenu = { id: string; nome: string; cor: string; listas: { id: string; nome: string }[] };

type Props = {
  espacos: EspacoMenu[] | null;
  podeCriarEspaco: boolean;
  podeCriarLista: boolean;
};

const botaoIcone = "text-muted-foreground hover:bg-muted hover:text-foreground rounded p-1";

function ItemLink({ href, children, recuo }: { href: string; children: React.ReactNode; recuo?: boolean }) {
  const caminho = usePathname();
  const ativo = caminho === href;
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "hover:bg-muted truncate rounded-md px-2 py-1.5 text-sm",
        recuo && "pl-6.5",
        ativo && "bg-muted font-medium",
      )}
    >
      {children}
    </Link>
  );
}

function ArvoreEspacos({ espacos, podeCriarEspaco, podeCriarLista }: Props & { espacos: EspacoMenu[] }) {
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
          <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium">
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
            <ItemLink key={lista.id} href={`/tarefas/listas/${lista.id}`} recuo>
              {lista.nome}
            </ItemLink>
          ))}
        </div>
      ))}
    </div>
  );
}

function Conteudo(props: Props) {
  return (
    <nav aria-label="Tarefas" className="grid gap-4">
      <div className="grid gap-0.5">
        <ItemLink href="/tarefas/minhas">Minhas tarefas</ItemLink>
        <ItemLink href="/tarefas/relatorio">Relatório</ItemLink>
      </div>
      {props.espacos && <ArvoreEspacos {...props} espacos={props.espacos} />}
    </nav>
  );
}

/**
 * Menu interno do módulo Tarefas. Na tela larga fica fixo ao lado do conteúdo;
 * no celular vira um bloco recolhível no topo.
 */
export function MenuTarefas(props: Props) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="mb-4 px-2 text-sm font-semibold">Tarefas</p>
        <Conteudo {...props} />
      </aside>
      <details className="group border-b md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
          Tarefas: espaços e listas
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="px-2 pb-3">
          <Conteudo {...props} />
        </div>
      </details>
    </>
  );
}
