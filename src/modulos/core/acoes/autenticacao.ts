"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { registrarAuditoria } from "@/lib/auditoria";
import { auth } from "@/lib/auth";
import { obterUsuarioAtual } from "@/lib/sessao";
import { esquemaAceitarConvite, esquemaPerfil, esquemaPrimeiroAcesso } from "../esquemas/usuario";
import { LIMITES } from "../regras/limite-tentativas";
import { aceitarConvite } from "../servicos/convites";
import { exigirDentroDoLimite } from "../servicos/limite-tentativas";
import { completarCadastro, lerFoto } from "../servicos/perfil";
import { criarPrimeiroAdmin } from "../servicos/primeiro-acesso";

/** Entra logo após criar a conta. Se o login falhar (ex.: limite de tentativas), manda para o /login. */
async function entrarComSenha(email: string, senha: string) {
  try {
    await auth.api.signInEmail({ body: { email, password: senha }, headers: await headers() });
  } catch {
    redirect("/login");
  }
}

export async function aceitarConviteAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  let email: string;
  let senha: string;
  try {
    await exigirDentroDoLimite("convite", await headers(), LIMITES.convite);
    const dados = esquemaAceitarConvite.parse(dadosDoFormulario(formData));
    ({ email } = await aceitarConvite(dados, await lerFoto(formData)));
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
    await exigirDentroDoLimite("primeiro-acesso", await headers(), LIMITES.convite);
    const dados = esquemaPrimeiroAcesso.parse(dadosDoFormulario(formData));
    ({ email } = await criarPrimeiroAdmin(dados));
    senha = dados.senha;
  } catch (erro) {
    return tratarErroAcao(erro);
  }
  await entrarComSenha(email, senha);
  redirect("/inicio");
}

export async function completarCadastroAcao(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const usuario = await obterUsuarioAtual();
  if (!usuario) redirect("/login");
  try {
    const dados = esquemaPerfil.parse(dadosDoFormulario(formData));
    await completarCadastro(usuario.id, dados, await lerFoto(formData));
  } catch (erro) {
    return tratarErroAcao(erro);
  }
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
