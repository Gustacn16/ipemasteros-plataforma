"use server";

import { revalidatePath } from "next/cache";
import { dadosDoFormulario, tratarErroAcao, type EstadoAcao } from "@/lib/acoes";
import { exigirPermissao } from "@/lib/sessao";
import { esquemaAlterarPapel, esquemaConvite, esquemaIdUsuario } from "../esquemas/usuario";
import { criarConvite, revogarConvite } from "../servicos/convites";
import { alterarPapel, definirAtivo } from "../servicos/usuarios";

const PAGINA_USUARIOS = "/admin/usuarios";

export async function convidarAcao(
  _: EstadoAcao<{ link: string }>,
  formData: FormData,
): Promise<EstadoAcao<{ link: string }>> {
  try {
    const ator = await exigirPermissao("core:convidar_usuario");
    const dados = esquemaConvite.parse(dadosDoFormulario(formData));
    const { link } = await criarConvite(ator, dados);
    revalidatePath(PAGINA_USUARIOS);
    return { ok: true, mensagem: `Convite enviado para ${dados.email}.`, dados: { link } };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function revogarConviteAcao(conviteId: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("core:convidar_usuario");
    await revogarConvite(ator, conviteId);
    revalidatePath(PAGINA_USUARIOS);
    return { ok: true, mensagem: "Convite revogado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function alterarPapelAcao(usuarioId: string, papel: string): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("core:alterar_papel");
    const dados = esquemaAlterarPapel.parse({ usuarioId, papel });
    await alterarPapel(ator, dados.usuarioId, dados.papel);
    revalidatePath(PAGINA_USUARIOS);
    return { ok: true, mensagem: "Papel alterado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}

export async function definirAtivoAcao(usuarioId: string, ativo: boolean): Promise<EstadoAcao> {
  try {
    const ator = await exigirPermissao("core:desativar_usuario");
    const dados = esquemaIdUsuario.parse({ usuarioId });
    await definirAtivo(ator, dados.usuarioId, ativo === true);
    revalidatePath(PAGINA_USUARIOS);
    return { ok: true, mensagem: ativo ? "Usuário reativado." : "Usuário desativado." };
  } catch (erro) {
    return tratarErroAcao(erro);
  }
}
