import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { registrarAuditoria } from "@/lib/auditoria";
import { SENHA_MIN } from "@/lib/auth-config";
import { escaparHtml, enviarEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

/**
 * Better Auth com e-mail e senha. Não há cadastro público (disableSignUp):
 * usuários entram por convite (src/modulos/core) ou pelo /primeiro-acesso.
 * Nomes de tabelas/campos mapeados para o schema em português.
 */
export const auth = betterAuth({
  appName: "IPEMaster OS",
  database: prismaAdapter(prisma, { provider: "mysql" }),

  user: {
    modelName: "usuario",
    fields: {
      name: "nome",
      emailVerified: "emailVerificado",
      image: "imagem",
      createdAt: "criadoEm",
      updatedAt: "atualizadoEm",
    },
    additionalFields: {
      papel: { type: "string", input: false },
      ativo: { type: "boolean", input: false },
    },
  },
  session: {
    modelName: "sessao",
    fields: { userId: "usuarioId", createdAt: "criadoEm", updatedAt: "atualizadoEm" },
    expiresIn: 60 * 60 * 24 * 7, // expira após 7 dias sem uso
    updateAge: 60 * 60 * 24, // renova no máximo 1x por dia
  },
  account: {
    modelName: "conta",
    fields: { userId: "usuarioId", createdAt: "criadoEm", updatedAt: "atualizadoEm" },
  },
  verification: {
    modelName: "verificacao",
    fields: { createdAt: "criadoEm", updatedAt: "atualizadoEm" },
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: SENHA_MIN,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await enviarEmail({
        para: user.email,
        assunto: "Redefinição de senha — IPEMaster OS",
        texto: `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse (válido por 1 hora):\n${url}\n\nSe você não pediu, ignore este e-mail.`,
        html: `<p>Olá, ${escaparHtml(user.name)}.</p><p>Para criar uma nova senha, <a href="${url}">clique aqui</a> (válido por 1 hora).</p><p>Se você não pediu, ignore este e-mail.</p>`,
      });
    },
    onPasswordReset: async ({ user }) => {
      await registrarAuditoria({
        usuarioId: user.id,
        acao: "auth.senha_redefinida",
        entidade: "usuario",
        entidadeId: user.id,
      });
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60 * 15, max: 3 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Usuário desativado não consegue abrir sessão.
        before: async (sessao) => {
          const usuario = await prisma.usuario.findUnique({
            where: { id: sessao.userId },
            select: { ativo: true },
          });
          if (!usuario?.ativo) return false;
        },
        after: async (sessao) => {
          await prisma.$transaction([
            prisma.usuario.update({
              where: { id: sessao.userId },
              data: { ultimoAcessoEm: new Date() },
            }),
            prisma.logAuditoria.create({
              data: {
                usuarioId: sessao.userId,
                acao: "auth.login",
                entidade: "usuario",
                entidadeId: sessao.userId,
                ip: sessao.ipAddress ?? null,
                userAgent: sessao.userAgent?.slice(0, 500) ?? null,
              },
            }),
          ]);
        },
      },
    },
  },

  advanced: {
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  // nextCookies precisa ser o último plugin: grava os cookies em Server Actions.
  plugins: [nextCookies()],
});
