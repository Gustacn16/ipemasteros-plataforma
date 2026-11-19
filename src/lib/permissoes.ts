// Mapa central de permissões. Fonte da verdade: docs/04-seguranca-permissoes.md
// Regras que dependem do registro (ex.: professor só vê as próprias turmas)
// ficam no serviço do módulo, não aqui.

export const PAPEIS = ["admin", "gestor", "colaborador", "comercial", "professor", "aluno"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: "Admin",
  gestor: "Gestor",
  colaborador: "Colaborador",
  comercial: "Comercial",
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
  | "conteudo:gerenciar_integracao_instagram"
  | "agenda:usar"
  | "agenda:ver_institucional"
  | "agenda:ver_institucional_professor"
  | "agenda:editar_institucional"
  | "agenda:gerenciar_tipos"
  | "comercial:ver"
  | "comercial:registrar_venda"
  | "comercial:ver_equipe"
  | "comercial:gerenciar_vendas"
  | "comercial:gerenciar_metas"
  | "comercial:gerenciar_produtos"
  | "comercial:excluir_produtos"
  | "comercial:ver_marketing"
  | "comercial:atribuir_campanhas"
  | "comercial:gerenciar_integracao_meta"
  | "comercial:importar_historico"
  | "academico:ver"
  | "academico:gerenciar"
  | "academico:importar_alunos"
  | "whatsapp:gerenciar_numeros"
  | "whatsapp:conectar_proprio"
  | "whatsapp:ver_grupos"
  | "whatsapp:ver_equipe"
  | "whatsapp:ver_proprio"
  | "nexu:usar"
  | "nexu:configurar"
  | "espiao:ver"
  | "espiao:configurar"
  | "processos:ver"
  | "processos:editar"
  | "processos:registrar_medicao";

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

// O vendedor (papel comercial) só registra as próprias vendas; a regra por
// registro fica em src/modulos/comercial/servicos/acesso.ts.
const COMERCIAL_GESTAO: readonly Permissao[] = [
  "comercial:ver",
  "comercial:registrar_venda",
  "comercial:ver_equipe",
  "comercial:gerenciar_vendas",
  "comercial:gerenciar_metas",
  "comercial:gerenciar_produtos",
  "comercial:ver_marketing",
  "comercial:atribuir_campanhas",
];

// Importar a planilha grava dados pessoais em lote: só admin e gestor.
const ACADEMICO_GESTAO: readonly Permissao[] = ["academico:ver", "academico:gerenciar", "academico:importar_alunos"];

// Cadastrar e excluir números do WhatsApp é coisa de gestão; o comercial só conecta o próprio.
// Gestão também vê os grupos e todas as conversas individuais.
const WHATSAPP_GESTAO: readonly Permissao[] = ["whatsapp:gerenciar_numeros", "whatsapp:ver_grupos", "whatsapp:ver_equipe"];

// Escrever e publicar os padrões da empresa é coisa de gestão.
const PROCESSOS_GESTAO: readonly Permissao[] = ["processos:ver", "processos:editar", "processos:registrar_medicao"];

const PERMISSOES_COLABORADOR: readonly Permissao[] = [
  "tarefas:gerenciar_listas",
  "tarefas:usar",
  "conteudo:usar",
  "agenda:usar",
  "agenda:ver_institucional",
  "agenda:editar_institucional",
  "academico:ver",
  "academico:gerenciar",
  // Processos internos: todo o time lê; o lançamento de resultados vale para o
  // responsável de cada indicador (regra em src/modulos/processos/servicos/acesso.ts).
  "processos:ver",
  // O Nexu (assistente de IA) vale para todo mundo que usa o sistema no dia a dia; professor e aluno ficam de fora.
  "nexu:usar",
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
    ...COMERCIAL_GESTAO,
    ...ACADEMICO_GESTAO,
    ...WHATSAPP_GESTAO,
    ...PROCESSOS_GESTAO,
    "nexu:usar",
    // Só o admin escolhe o modelo e os limites do Nexu.
    "nexu:configurar",
    // Espião de concorrentes: ver vale para gestão e comercial; lista, teto e coleta manual só o admin.
    "espiao:ver",
    "espiao:configurar",
    // Só o admin apaga produtos do catálogo.
    "comercial:excluir_produtos",
    // Só o admin mexe na integração com a Meta (chave e importação).
    "comercial:gerenciar_integracao_meta",
    // Só o admin importa o histórico da plataforma antiga (vendas com dados de clientes).
    "comercial:importar_historico",
    // Só o admin mexe na integração com o Instagram (contas, canais e atualização).
    "conteudo:gerenciar_integracao_instagram",
  ],
  gestor: [
    "core:ver_usuarios",
    "core:convidar_usuario",
    "core:ver_auditoria",
    ...TAREFAS_GESTAO,
    ...CONTEUDO_GESTAO,
    ...AGENDA_GESTAO,
    ...COMERCIAL_GESTAO,
    ...ACADEMICO_GESTAO,
    ...WHATSAPP_GESTAO,
    ...PROCESSOS_GESTAO,
    "nexu:usar",
    "espiao:ver",
  ],
  colaborador: PERMISSOES_COLABORADOR,
  comercial: [
    ...PERMISSOES_COLABORADOR,
    "comercial:ver",
    "comercial:registrar_venda",
    // O vendedor conecta o próprio número de WhatsApp ao motor.
    "whatsapp:conectar_proprio",
    // ...e só as conversas individuais dos próprios números.
    "whatsapp:ver_proprio",
    // O comercial usa o espião para argumentar com o lead.
    "espiao:ver",
  ],
  professor: ["tarefas:usar", "agenda:usar", "agenda:ver_institucional_professor"],
  aluno: [],
};

/** Papéis que cada papel pode convidar. Só admin cria admin ou gestor. */
const PAPEIS_CONVIDAVEIS: Record<Papel, readonly Papel[]> = {
  admin: ["admin", "gestor", "colaborador", "comercial", "professor"],
  gestor: ["colaborador", "comercial", "professor"],
  colaborador: [],
  comercial: [],
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
