"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type ItemMenu = { href: string; rotulo: string; emBreve?: boolean };

function Item({ item, ativo }: { item: ItemMenu; ativo: boolean }) {
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
        "hover:bg-sidebar-accent rounded-md px-2 py-1.5 text-sm",
        ativo && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
      )}
    >
      {item.rotulo}
    </Link>
  );
}

export function MenuNavegacao({ modulos, admin }: { modulos: ItemMenu[]; admin: ItemMenu[] }) {
  const caminho = usePathname();
  const estaAtivo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);

  return (
    <nav aria-label="Principal" className="grid gap-4">
      <div className="grid gap-0.5">
        {modulos.map((item) => (
          <Item key={item.href} item={item} ativo={estaAtivo(item.href)} />
        ))}
      </div>
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
