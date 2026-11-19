import type { TimeNumeroWhatsapp } from "@/generated/prisma/client";

export const TIMES = ["cs", "paciente_modelo", "comercial", "outro"] as const satisfies readonly TimeNumeroWhatsapp[];

export const ROTULO_TIME: Record<TimeNumeroWhatsapp, string> = {
  cs: "CS",
  paciente_modelo: "Paciente modelo",
  comercial: "Comercial",
  outro: "Outro",
};

/** Times de venda: só neles o follow-up vale. A CS e "outro" não cobram o cliente. */
export const TIMES_COM_FOLLOWUP: readonly TimeNumeroWhatsapp[] = ["paciente_modelo", "comercial"];

export const temFollowup = (time: TimeNumeroWhatsapp) => TIMES_COM_FOLLOWUP.includes(time);
