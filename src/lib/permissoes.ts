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
  | "core:ver_auditoria"
  | "tarefas:gerenciar_espacos"
  | "tarefas:gerenciar_listas"
  | "tarefas:ver_todos_espacos"
  | "tarefas:usar"
  | "tarefas:ver_relatorio_equipe"
  | "conteudo:usar"
  | "conteudo:aprovar"
  | "conteudo:gerenciar_canais"
  | "agenda:usar"
  | "agenda:ver_institucional"
  | "agenda:ver_institucional_professor"
  | "agenda:editar_institucional"
  | "agenda:gerenciar_tipos";

// Colaborador e professor têm regras por registro (membro do espaço, tarefas
// atribuídas) em src/modulos/tarefas/servicos/acesso.ts.
const TAREFAS_GESTAO: readonly Permissao[] = [
  "tarefas:gerenciar_espacos",
  "tarefas:gerenciar_listas",
  "tarefas:ver_todos_espacos",
  "tarefas:usar",
  "tarefas:ver_relatorio_equipe",
];

const CONTEUDO_GESTAO: readonly Permissao[] = ["conteudo:usar", "conteudo:aprovar", "conteudo:gerenciar_canais"];

const AGENDA_GESTAO: readonly Permissao[] = [
  "agenda:usar",
  "agenda:ver_institucional",
  "agenda:editar_institucional",
  "agenda:gerenciar_tipos",
];

const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  admin: [
    "core:ver_usuarios",
    "core:convidar_usuario",
    "core:alterar_papel",
    "core:desativar_usuario",
    "core:ver_auditoria",
    ...TAREFAS_GESTAO,
    ...CONTEUDO_GESTAO,
    ...AGENDA_GESTAO,
  ],
  gestor: [
    "core:ver_usuarios",
    "core:convidar_usuario",
    "core:ver_auditoria",
    ...TAREFAS_GESTAO,
    ...CONTEUDO_GESTAO,
    ...AGENDA_GESTAO,
  ],
  colaborador: [
    "tarefas:gerenciar_listas",
    "tarefas:usar",
    "conteudo:usar",
    "agenda:usar",
    "agenda:ver_institucional",
    "agenda:editar_institucional",
  ],
  professor: ["tarefas:usar", "agenda:usar", "agenda:ver_institucional_professor"],
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
