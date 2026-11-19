import { FUSO_PADRAO } from "@/lib/datas";

export const formatarData = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: FUSO_PADRAO });
export const formatarDataHoraCurta = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: FUSO_PADRAO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
