import {
  BanknoteIcon,
  ChartLineIcon,
  CogIcon,
  CompassIcon,
  FolderIcon,
  GraduationCapIcon,
  HeartIcon,
  MegaphoneIcon,
  TargetIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { IconeCategoria } from "../esquemas/processos";

export const ICONE_CATEGORIA: Record<IconeCategoria, LucideIcon> = {
  pasta: FolderIcon,
  bussola: CompassIcon,
  megafone: MegaphoneIcon,
  alvo: TargetIcon,
  engrenagem: CogIcon,
  pessoas: UsersIcon,
  graduacao: GraduationCapIcon,
  dinheiro: BanknoteIcon,
  coracao: HeartIcon,
  grafico: ChartLineIcon,
};

export const ROTULO_ICONE: Record<IconeCategoria, string> = {
  pasta: "Pasta",
  bussola: "Bússola",
  megafone: "Megafone",
  alvo: "Alvo",
  engrenagem: "Engrenagem",
  pessoas: "Pessoas",
  graduacao: "Formatura",
  dinheiro: "Dinheiro",
  coracao: "Coração",
  grafico: "Gráfico",
};
