// Mapa central de permissões. Fonte da verdade: docs/04-seguranca-permissoes.md
// Regras que dependem do registro (ex.: professor só vê as próprias turmas)
// ficam no serviço do módulo, não aqui.

export const PAPEIS = ["admin", "gestor", "colaborador", "professor", "aluno"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Admin",
  gestor: "Gestor",
  colaborador: "Colaborador",
  professor: "Professor",
  aluno: "Aluno",
};

export type Permissao =
  | "core:ver_usuarios"
  | "core:convidar_usuario"
  | "core:alterar_papel"
  | "core:desativar_usuario"
  | "core:ver_auditoria";

const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  admin: [
    "core:ver_usuarios",
    "core:convidar_usuario",
    "core:alterar_papel",
    "core:desativar_usuario",
    "core:ver_auditoria",
  ],
  gestor: ["core:ver_usuarios", "core:convidar_usuario", "core:ver_auditoria"],
  colaborador: [],
  professor: [],
  aluno: [],
};

/** Papéis que cada papel pode convidar. Só admin cria admin ou gestor. */
const PAPEIS_CONVIDAVEIS: Record<Papel, readonly Papel[]> = {
  admin: ["admin", "gestor", "colaborador", "professor"],
  gestor: ["colaborador", "professor"],
  colaborador: [],
  professor: [],
  aluno: [],
};

export function temPermissao(papel: Papel, permissao: Permissao): boolean {
  return PERMISSOES_POR_PAPEL[papel].includes(permissao);
}

export function papeisConvidaveis(papel: Papel): readonly Papel[] {
  return PAPEIS_CONVIDAVEIS[papel];
}

export function podeConvidar(papelConvidante: Papel, papelConvidado: Papel): boolean {
  return PAPEIS_CONVIDAVEIS[papelConvidante].includes(papelConvidado);
}

export class ErroPermissao extends Error {
  constructor(permissao: Permissao | string) {
    super(`Sem permissão: ${permissao}`);
    this.name = "ErroPermissao";
  }
}
