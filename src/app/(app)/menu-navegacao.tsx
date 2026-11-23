"use client";

import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  CalendarIcon,
  ClapperboardIcon,
  CrosshairIcon,
  GoalIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  HouseIcon,
  ListChecksIcon,
  LogOutIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AjudaInstalacao, AtalhoInstalar } from "@/componentes/atalho-instalar";
import { SeletorTema } from "@/componentes/seletor-tema";
import { useModoApp } from "@/componentes/use-instalacao";
import { BarraLateral, ItemBarraLateral, TextoBarra, useBarraLateral } from "@/componentes/ui/barra-lateral";
import { sairAcao } from "@/modulos/core/acoes/autenticacao";

const ICONES = {
  inicio: <HouseIcon />,
  tarefas: <ListChecksIcon />,
  conteudo: <ClapperboardIcon />,
  agenda: <CalendarIcon />,
  academico: <GraduationCapIcon />,
  comercial: <BriefcaseBusinessIcon />,
  whatsapp: <MessageCircleIcon />,
  usuarios: <UsersIcon />,
  auditoria: <ShieldCheckIcon />,
  nexu: <SparklesIcon />,
  espiao: <CrosshairIcon />,
  saude: <HeartPulseIcon />,
  processos: <WorkflowIcon />,
  planejamento: <GoalIcon />,
};

export type ItemMenu = { href: string; rotulo: string; icone: keyof typeof ICONES; emBreve?: boolean; contador?: number };

function Logo(aberta: boolean) {
  return (
    <Link href="/inicio" aria-label="IPEMaster OS — início" className="flex items-center">
      {aberta ? (
        <Image src="/marca/ipemaster-logo-claro.png" alt="" width={168} height={54} priority className="h-auto w-[168px]" />
      ) : (
        <Image src="/marca/ipemaster-simbolo.png" alt="" width={38} height={25} priority className="ml-0.5 h-auto w-[38px]" />
      )}
    </Link>
  );
}

function Rodape({ nome, papel, aoPedirAjuda }: { nome: string; papel: string; aoPedirAjuda: () => void }) {
  const { aberta } = useBarraLateral();
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3 px-1" title={aberta ? undefined : `${nome} · ${papel}`}>
        <span aria-hidden className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {iniciais}
        </span>
        <TextoBarra className="grid text-sm leading-tight">
          <span className="truncate font-medium">{nome}</span>
          <span className="text-sidebar-foreground/60 truncate text-xs">{papel}</span>
        </TextoBarra>
      </div>
      <AtalhoInstalar aoPedirAjuda={aoPedirAjuda} />
      <SeletorTema compacto={!aberta} />
      <form action={sairAcao}>
        <button
          type="submit"
          aria-label={aberta ? undefined : "Sair"}
          title={aberta ? undefined : "Sair"}
          className="hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-sm"
        >
          <LogOutIcon className="size-5 shrink-0" />
          <TextoBarra>Sair</TextoBarra>
        </button>
      </form>
    </div>
  );
}

function Itens({ itens }: { itens: ItemMenu[] }) {
  const caminho = usePathname();
  const ativo = (href: string) => caminho === href || caminho.startsWith(`${href}/`);
  return (
    <div className="grid gap-1">
      {itens.map((item) => (
        <ItemBarraLateral key={item.href} {...item} icone={ICONES[item.icone]} ativo={ativo(item.href)} />
      ))}
    </div>
  );
}

function SecaoAdmin({ admin }: { admin: ItemMenu[] }) {
  const { aberta } = useBarraLateral();
  return (
    <div className="mt-6 grid gap-1">
      {aberta ? (
        <p className="text-sidebar-foreground/50 px-2.5 text-xs font-medium uppercase">Administração</p>
      ) : (
        <hr className="border-sidebar-border mx-2" aria-hidden />
      )}
      <Itens itens={admin} />
    </div>
  );
}

/**
 * Aberto como aplicativo (ícone da tela de início) não existe o Voltar do
 * navegador: dentro de uma página interna (ex.: /tarefas/listas/x), mostra uma seta.
 */
function BotaoVoltar() {
  const modoApp = useModoApp();
  const caminho = usePathname();
  const router = useRouter();
  if (!modoApp || caminho.split("/").filter(Boolean).length < 2) return null;
  return (
    <button type="button" aria-label="Voltar" onClick={() => router.back()} className="hover:bg-sidebar-accent -ml-2 rounded-md p-2">
      <ArrowLeftIcon className="size-5" />
    </button>
  );
}

type Props = { modulos: ItemMenu[]; admin: ItemMenu[]; usuario: { nome: string; papel: string } };

/** Menu principal da plataforma (barra lateral recolhível; no celular, menu em tela cheia). */
export function MenuNavegacao({ modulos, admin, usuario }: Props) {
  const [ajudaInstalar, setAjudaInstalar] = useState(false);
  return (
    <>
      <BarraLateral
        logo={Logo}
        voltar={<BotaoVoltar />}
        rodape={<Rodape {...usuario} aoPedirAjuda={() => setAjudaInstalar(true)} />}
      >
        <nav aria-label="Módulos">
          <Itens itens={modulos} />
          {admin.length > 0 && <SecaoAdmin admin={admin} />}
        </nav>
      </BarraLateral>
      <AjudaInstalacao aberta={ajudaInstalar} aoMudar={setAjudaInstalar} />
    </>
  );
}
