"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { registrarAuditoria } from "@/lib/auditoria";
import { auth } from "@/lib/auth";
import { obterUsuarioAtual } from "@/lib/sessao";
import { esquemaAceitarConvite, esquemaPrimeiroAcesso } from "../esquemas/usuario";
import { aceitarConvite } from "../servicos/convites";
import { criarPrimeiroAdmin } from "../servicos/primeiro-acesso";

async function entrarComSenha(email: string, senha: string) {
  await auth.api.signInEmail({ body: { email, password: senha }, headers: await headers() });
}

export async function aceitarConviteAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  let email: string;
  let senha: string;
  try {
    const dados = esquemaAceitarConvite.parse(dadosDoFormulario(formData));
    ({ email } = await aceitarConvite(dados));
    senha = dados.senha;
  } catch (erro) {
    return tratarErroAcao(erro);
  }
  await entrarComSenha(email, senha);
  redirect("/inicio");
}

export async function primeiroAcessoAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  let email: string;
  let senha: string;
  try {
    const dados = esquemaPrimeiroAcesso.parse(dadosDoFormulario(formData));
    ({ email } = await criarPrimeiroAdmin(dados));
    senha = dados.senha;
  } catch (erro) {
    return tratarErroAcao(erro);
  }
  await entrarComSenha(email, senha);
  redirect("/inicio");
}

export async function sairAcao() {
  const usuario = await obterUsuarioAtual();
  if (usuario) {
    await registrarAuditoria({
      usuarioId: usuario.id,
      acao: "auth.logout",
      entidade: "usuario",
      entidadeId: usuario.id,
    });
  }
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
