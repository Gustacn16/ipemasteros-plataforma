import { z } from "zod";
import { TIPOS_STATUS } from "../regras/status";

const id = z.string().min(1);
const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").transform((c) => c.toLowerCase());

export const esquemaEspaco = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(80, "Nome longo demais"),
  cor,
});

export const esquemaEditarEspaco = esquemaEspaco.extend({ espacoId: id });

export const esquemaMembros = z.object({
  espacoId: id,
  usuarioIds: z.array(id).max(500),
});

export const esquemaLista = z.object({
  espacoId: id,
  nome: z.string().trim().min(1, "Informe o nome").max(80, "Nome longo demais"),
});

export const esquemaRenomearLista = z.object({ listaId: id, nome: esquemaLista.shape.nome });

/** Conjunto completo de status de uma lista, na ordem desejada. Sem id = status novo. */
export const esquemaStatusLista = z.object({
  listaId: id,
  status: z
    .array(
      z.object({
        id: id.optional(),
        nome: z.string().trim().min(1, "Informe o nome do status").max(40),
        cor,
        tipo: z.enum(TIPOS_STATUS),
      }),
    )
    .min(2)
    .max(20),
});

export const esquemaExcluirStatus = z.object({ statusId: id, destinoId: id });
