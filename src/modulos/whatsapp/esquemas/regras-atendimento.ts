import { z } from "zod";

/** Faixa de atendimento do dia, em minutos desde a meia-noite de São Paulo. */
export type FaixaHorario = { inicioMin: number; fimMin: number };

/** `horario` tem 7 posições, de domingo (0) a sábado (6); null = fechado. */
export type RegrasAtendimento = {
  horario: (FaixaHorario | null)[];
  slaMinutos: number;
  followupHoras: number;
  followupDias: number;
};

const comercial: FaixaHorario = { inicioMin: 480, fimMin: 1080 };

export const REGRAS_PADRAO: RegrasAtendimento = {
  horario: [null, comercial, comercial, comercial, comercial, comercial, { inicioMin: 480, fimMin: 720 }],
  slaMinutos: 15,
  followupHoras: 24,
  followupDias: 3,
};

const esquemaFaixa = z
  .object({
    inicioMin: z.number().int().min(0, "O horário deve ficar entre 0h e 24h."),
    fimMin: z.number().int().max(1440, "O horário deve ficar entre 0h e 24h."),
  })
  .refine((f) => f.inicioMin < f.fimMin, { message: "O início do atendimento deve ser antes do fim." });

export const esquemaRegrasAtendimento = z
  .object({
    horario: z.array(esquemaFaixa.nullable()).length(7, "Informe o horário dos 7 dias da semana."),
    slaMinutos: z.number().int("O prazo de resposta deve ser um número inteiro.").min(1, "O prazo de resposta deve ficar entre 1 e 240 minutos.").max(240, "O prazo de resposta deve ficar entre 1 e 240 minutos."),
    followupHoras: z.number().int().min(1, "O follow-up deve ser devido entre 1 e 168 horas.").max(168, "O follow-up deve ser devido entre 1 e 168 horas."),
    followupDias: z.number().int().min(1, "O prazo do follow-up deve ficar entre 1 e 14 dias.").max(14, "O prazo do follow-up deve ficar entre 1 e 14 dias."),
  })
  .refine((r) => r.followupDias * 24 > r.followupHoras, {
    message: "O prazo do follow-up deve ser maior que o tempo até ele ser devido.",
    path: ["followupDias"],
  });
