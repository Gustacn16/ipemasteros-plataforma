import type { TimeNumeroWhatsapp } from "@/generated/prisma/client";

export const TIMES = ["cs", "paciente_modelo", "comercial", "outro"] as const satisfies readonly TimeNumeroWhatsapp[];

export const ROTULO_TIME: Record<TimeNumeroWhatsapp, string> = {
  cs: "CS",
  paciente_modelo: "Paciente modelo",
  comercial: "Comercial",
  outro: "Outro",
};
