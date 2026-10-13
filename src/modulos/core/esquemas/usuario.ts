import { z } from "zod";
import { PAPEIS } from "@/lib/permissoes";

import { SENHA_MIN } from "@/lib/auth-config";

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

export const esquemaAceitarConvite = senhaComConfirmacao.and(
  z.object({ token: z.string().min(20), nome }),
);

export const esquemaPrimeiroAcesso = senhaComConfirmacao.and(
  z.object({ token: z.string().min(1, "Informe o token de primeiro acesso"), nome, email }),
);

export const esquemaLogin = z.object({ email, senha: z.string().min(1, "Informe a senha") });

export const esquemaAlterarPapel = z.object({ usuarioId: z.string().min(1), papel });

export const esquemaIdUsuario = z.object({ usuarioId: z.string().min(1) });

export const esquemaRecuperarSenha = z.object({ email });

export const esquemaRedefinirSenha = senhaComConfirmacao.and(z.object({ token: z.string().min(1) }));
