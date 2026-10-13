# 04 — Segurança, permissões e LGPD

## Autenticação
- **Better Auth** com e-mail e senha (ver ADR 0001).
- **Sem cadastro aberto.** Usuários entram por **convite**: admin ou gestor informa e-mail e papel, o sistema envia um link (válido por 72h) e a pessoa define a senha.
- Senha com no mínimo 10 caracteres e verificação contra senhas vazadas comuns.
- Recuperação de senha por e-mail com link de uso único (validade de 1h).
- Sessões em cookie `httpOnly`, `secure`, `sameSite=lax`. Expiram após 7 dias de inatividade.
- Bloqueio temporário após 5 tentativas de login falhas (15 min).
- **2FA (TOTP) obrigatório para admin e gestor** a partir da F1, e opcional para os demais.
- A conexão com o Google (Agenda) é **separada do login**: o usuário conecta o calendário de dentro do sistema.

## Papéis
Cada usuário tem um papel: `admin`, `gestor`, `colaborador`, `professor` ou `aluno`. O papel `aluno` fica reservado para o futuro, sem login na v1.

As permissões são definidas em código, em `src/lib/permissoes.ts`, como um mapa `papel → lista de "modulo:acao"`. A checagem é sempre no servidor:
```ts
await exigirPermissao(sessao, "academico:editar_aluno")
```
Algumas regras dependem do registro, não só do papel. Exemplo: o professor só vê as próprias turmas. Essas regras ficam no serviço do módulo.

## Matriz de permissões
Legenda: ✅ total · 👁 só leitura · 🔸 restrito ao que é seu · — sem acesso

| Módulo / ação | admin | gestor | colaborador | professor |
|---|---|---|---|---|
| **Core:** gerenciar usuários e papéis | ✅ | 🔸 convida colaborador/professor | — | — |
| **Core:** ver auditoria | ✅ | 👁 do seu escopo | — | — |
| **Core:** atender solicitações LGPD | ✅ | — | — | — |
| **Tarefas:** espaços e listas | ✅ | ✅ | 🔸 nos espaços em que é membro | — |
| **Tarefas:** tarefas | ✅ | ✅ | ✅ nos espaços em que é membro | 🔸 as atribuídas a ele |
| **Agenda:** própria agenda | ✅ | ✅ | ✅ | ✅ |
| **Acadêmico:** cursos, turmas, aulas | ✅ | ✅ | ✅ | 👁 🔸 suas turmas |
| **Acadêmico:** dados pessoais de alunos | ✅ | ✅ | ✅ (CPF mascarado) | 🔸 nome e presença das suas turmas |
| **Acadêmico:** presenças | ✅ | ✅ | ✅ | 🔸 lança e corrige nas suas aulas |
| **Acadêmico:** avaliações | ✅ | ✅ | 👁 | 🔸 agregadas, das suas aulas |
| **Acadêmico:** fornecedores | ✅ | ✅ | ✅ | — |
| **Acadêmico:** exportar dados de alunos | ✅ | ✅ | — | — |
| **Conteúdo:** planejar | ✅ | ✅ | ✅ | — |
| **Conteúdo:** aprovar e publicar | ✅ | ✅ | — | — |
| **Conteúdo:** conectar canais | ✅ | ✅ | — | — |
| **Dashboard** | ✅ | ✅ | — | — |
| **Integrações** (Meta, Kommo) | ✅ | — | — | — |

## Auditoria
`LogAuditoria` registra: `usuarioId`, `acao`, `entidade`, `entidadeId`, `diff` (antes/depois, **sem** CPF em claro), `ip`, `userAgent` e `criadoEm`.

Ações sempre auditadas:
- Login e logout, falhas de login.
- Convites, mudança de papel, desativação de usuário.
- Criação, edição e exclusão de aluno, professor e matrícula.
- Visualização do CPF completo, exportação de dados.
- Conexão e desconexão de integrações.
- Publicação de conteúdo.

O log é somente inserção: ninguém edita nem apaga, nem pela interface. A retenção é de 5 anos.

## Formulários públicos (presença e avaliação)
São as únicas telas sem login, por isso recebem proteção extra:
- **Token por aula:** o QR code aponta para `/presenca/<token>`. O token é aleatório (32+ bytes), vinculado a uma aula e válido só durante a janela configurada (padrão: 30 min antes até 2h depois do início). Fora da janela, a página mostra "formulário encerrado".
- **Rate limit** por IP e por token (ex.: 10 envios/min/IP).
- **Cloudflare Turnstile** (captcha invisível) no envio.
- **Mensagens genéricas:** o formulário não revela se um CPF existe na base. Responde "Presença registrada" ou "Não foi possível registrar. Procure a coordenação".
- Uma presença por matrícula por aula. Reenvios são idempotentes.
- O professor ou a coordenação pode **regenerar o token** se o QR vazar.

## Segurança geral
- Validação Zod em toda entrada.
- Prisma usa queries parametrizadas. SQL bruto só com `Prisma.sql`.
- Headers de segurança (CSP, HSTS, X-Frame-Options) via `next.config`.
- Proteção CSRF nativa das Server Actions, mais checagem de origem nos Route Handlers.
- Dependências verificadas com `npm audit` no CI.
- Segredos só em variáveis de ambiente.

## LGPD

### Dados pessoais tratados
| Titular | Dados | Finalidade | Base legal (art. 7º LGPD) |
|---|---|---|---|
| Aluno | Nome, e-mail, telefone, CPF, CRM/UF, especialidade | Gestão acadêmica, matrícula, certificação | Execução de contrato (V) e obrigação legal/regulatória (II) para registros acadêmicos |
| Aluno | Presença (data/hora, aula) | Controle de frequência exigido para certificação | Execução de contrato (V) |
| Aluno | Respostas de avaliação | Melhoria da qualidade das aulas | Legítimo interesse (IX), **anônimas por padrão** |
| Professor | Nome, contato, CPF, CRM, dados bancários (futuro) | Contratação e gestão docente | Execução de contrato (V) |
| Usuário interno | Nome, e-mail, logs de acesso | Operação do sistema e segurança | Legítimo interesse (IX) / Marco Civil (art. 15) |
| Fornecedor (PF) | Nome, contato, documento | Relação comercial | Execução de contrato (V) |

Não coletamos dados sensíveis (art. 5º, II), como saúde ou religião. Se algum campo novo puder conter esse tipo de dado, ele precisa de uma ADR e de revisão jurídica antes.

### Princípios aplicados
- **Minimização:** só existe o campo que tem finalidade documentada acima. Campo novo com dado pessoal exige atualizar esta tabela.
- **CPF:**
  - É guardado de duas formas: `cpfCriptografado` (AES-256-GCM, para exibição autorizada) e `cpfHash` (HMAC-SHA256 com segredo, para busca e para validar a presença).
  - Aparece mascarado na interface (`***.456.789-**`). Ver o CPF completo exige permissão e gera auditoria.
- **Acesso restrito:** o professor vê só nome e presença dos próprios alunos.
- **Homologação sem dados reais:** a homologação usa só dados fictícios.
- **Exportações:** só admin e gestor podem exportar, sempre auditado, e os arquivos não ficam salvos no servidor.
- **Logs e URLs:** nunca contêm dados pessoais.

### Retenção
| Dado | Prazo | Ao fim do prazo |
|---|---|---|
| Registros acadêmicos de pós-graduação (matrícula, frequência) | Conforme regras do MEC para acervo acadêmico (**validar com o jurídico**) | Manter |
| Alunos de cursos livres sem vínculo ativo | 5 anos após o fim da turma | Anonimizar |
| Respostas de avaliação | Indeterminado (já são anônimas) | — |
| Logs de auditoria | 5 anos | Excluir |
| Logs de acesso (Marco Civil) | Mínimo de 6 meses | Excluir após 1 ano |
| Tokens de integração de usuário desativado | Imediato | Revogar e excluir |

A anonimização substitui nome, contatos e CPF por valores irreversíveis e mantém os agregados (contagens de presença).

### Direitos do titular (art. 18)
- O módulo Core tem a entidade `SolicitacaoTitular` (tipo, titular, status, prazo de resposta) e uma tela para o admin atender pedidos de acesso, correção, anonimização ou exclusão e portabilidade.
- O prazo de resposta é de 15 dias.
- A exportação dos dados de um titular sai em JSON/PDF.

### Encarregado (DPO) e incidentes
- **Encarregado: a definir.** Nome e canal de contato devem aparecer nos formulários públicos e na política de privacidade.
- Os formulários públicos exibem um aviso de privacidade curto com link para a política completa.
- **Incidente de segurança:**
  1. Conter o incidente.
  2. Avaliar o risco.
  3. Se houver risco ou dano relevante, comunicar a ANPD e os titulares em até 3 dias úteis (Res. CD/ANPD nº 15/2024).
  4. Registrar tudo no relatório de incidentes.
- **Operadores (subprocessadores):** Hostinger (hospedagem/banco), Google, Meta, Kommo, provedor de e-mail, storage de arquivos e Cloudflare. A lista fica mantida neste documento.
