import { z } from "zod";
import { PAPEIS } from "@/lib/permissoes";

import { SENHA_MIN } from "@/lib/auth-config";
import { idadeEm, normalizarWhatsapp } from "../regras/perfil";

const nome = z.string().trim().min(2, "Informe o nome completo").max(150);
const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")).pipe(z.string().max(191));
const papel = z.enum(PAPEIS, "Papel inválido");

const senhaComConfirmacao = z
  .object({
    senha: z
      .string()
      .min(SENHA_MIN, `A senha precisa ter pelo menos ${SENHA_MIN} caracteres`)
      .max(128, "Senha longa demais"),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, {
    message: "As senhas não conferem",
    path: ["confirmacao"],
  });

export const esquemaConvite = z.object({ nome, email, papel });

const hojeSP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Dados básicos obrigatórios no cadastro (a foto é validada à parte, pelos bytes). */
export const esquemaPerfil = z.object({
  nome,
  apelido: z.string().trim().min(2, "Informe como prefere ser chamado(a)").max(40, "Use até 40 caracteres"),
  whatsapp: z
    .string()
    .transform(normalizarWhatsapp)
    .refine((v) => /^[1-9]{2}9?\d{8}$/.test(v), "Informe o WhatsApp com DDD, ex.: (61) 99999-0000"),
  cargo: z.string().trim().min(2, "Informe seu cargo ou função").max(80, "Use até 80 caracteres"),
  dataNascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento")
    .refine((d) => {
      const idade = idadeEm(d, hojeSP());
      return idade >= 14 && idade <= 100;
    }, "Confira a data de nascimento"),
});
export type DadosPerfil = z.infer<typeof esquemaPerfil>;

export const esquemaAceitarConvite = senhaComConfirmacao.and(z.object({ token: z.string().min(20) })).and(esquemaPerfil);

export const esquemaPrimeiroAcesso = senhaComConfirmacao.and(
  z.object({ token: z.string().min(1, "Informe o token de primeiro acesso"), nome, email }),
);

export const esquemaAlterarPapel = z.object({ usuarioId: z.string().min(1), papel });

export const esquemaIdUsuario = z.object({ usuarioId: z.string().min(1) });
