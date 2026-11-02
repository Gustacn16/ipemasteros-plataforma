import type { Prisma } from "@/generated/prisma/client";
import { temPermissao, type Papel } from "@/lib/permissoes";

/** Eventos institucionais que o papel enxerga (regra 2 da Agenda). */
export function filtroEventosVisiveis(papel: Papel): Prisma.EventoInstitucionalWhereInput {
  if (temPermissao(papel, "agenda:ver_institucional")) return { excluidoEm: null };
  if (temPermissao(papel, "agenda:ver_institucional_professor")) {
    return { excluidoEm: null, visivelProfessores: true };
  }
  return { id: { in: [] } };
}

export function podeVerInstitucional(papel: Papel): boolean {
  return (
    temPermissao(papel, "agenda:ver_institucional") || temPermissao(papel, "agenda:ver_institucional_professor")
  );
}
