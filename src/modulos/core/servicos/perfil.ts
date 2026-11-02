import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { ErroNegocio } from "@/lib/erros";
import { prisma } from "@/lib/prisma";
import type { DadosPerfil } from "../esquemas/usuario";
import { TAMANHO_MAX_FOTO, tipoDaImagem, type TipoFoto } from "../regras/perfil";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type FotoEnviada = { dados: Uint8Array<ArrayBuffer>; tipo: TipoFoto };

/** Lê e valida a foto do formulário. A foto é obrigatória no cadastro. */
export async function lerFoto(formData: FormData): Promise<FotoEnviada> {
  const arquivo = formData.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroNegocio("Adicione uma foto de perfil.");
  if (arquivo.size > TAMANHO_MAX_FOTO) throw new ErroNegocio("A foto ficou grande demais. Tente outra imagem.");
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDaImagem(dados);
  if (!tipo) throw new ErroNegocio("Use uma foto em JPG, PNG ou WebP.");
  return { dados, tipo };
}

/** Grava perfil e foto e marca o cadastro como completo. Não registra os valores na auditoria (LGPD). */
export async function salvarPerfil(tx: Tx, usuarioId: string, perfil: DadosPerfil, foto: FotoEnviada) {
  await tx.fotoUsuario.upsert({
    where: { usuarioId },
    create: { usuarioId, dados: foto.dados, tipo: foto.tipo },
    update: { dados: foto.dados, tipo: foto.tipo },
  });
  await tx.usuario.update({
    where: { id: usuarioId },
    data: {
      nome: perfil.nome,
      apelido: perfil.apelido,
      whatsapp: perfil.whatsapp,
      cargo: perfil.cargo,
      dataNascimento: new Date(`${perfil.dataNascimento}T00:00:00Z`),
      // O ?v= troca a URL a cada nova foto, para o navegador não mostrar a antiga.
      imagem: `/api/usuarios/${usuarioId}/foto?v=${Date.now()}`,
      perfilCompletoEm: new Date(),
    },
  });
  await registrarAuditoria(
    {
      usuarioId,
      acao: "usuario.perfil_atualizado",
      entidade: "usuario",
      entidadeId: usuarioId,
      diff: { campos: ["nome", "apelido", "whatsapp", "cargo", "dataNascimento", "foto"] },
    },
    tx,
  );
}

/** Para quem já tinha conta antes desta regra (ex.: o primeiro admin). */
export async function completarCadastro(usuarioId: string, perfil: DadosPerfil, foto: FotoEnviada) {
  await prisma.$transaction((tx) => salvarPerfil(tx, usuarioId, perfil, foto));
}

export async function obterFoto(usuarioId: string) {
  return prisma.fotoUsuario.findUnique({ where: { usuarioId }, select: { dados: true, tipo: true } });
}
