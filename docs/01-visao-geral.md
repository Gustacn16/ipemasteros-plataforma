# 01 — Visão geral

## Contexto
A IPEMaster oferece pós-graduações e cursos livres para médicos. Hoje a operação fica espalhada entre planilhas, ClickUp, Google Agenda, Kommo, Meta Ads e conversas soltas. O **IPEMaster OS** reúne essa operação num sistema interno único.

## Objetivos
1. Centralizar a gestão de tarefas da equipe, no estilo ClickUp.
2. Organizar a operação acadêmica (cursos, turmas, aulas, professores, alunos, fornecedores), com presença e avaliação registradas por formulário público via QR code.
3. Dar a cada usuário sua agenda integrada ao Google Calendar.
4. Planejar e, quando possível, publicar o conteúdo dos canais de marketing.
5. Registrar vendas e metas por produto e vendedor e mostrar num dashboard o realizado contra a meta. Depois, trazer o investimento em mídia (Meta Ads) e as conversões (Kommo).
6. Tratar os dados de alunos em conformidade com a LGPD desde o início.

## Quem usa
| Papel | Quem é | Acesso na v1 |
|---|---|---|
| **admin** | Responsável técnico/diretoria | Tudo, incluindo usuários, papéis e auditoria |
| **gestor** | Coordenação, líderes de área | Todos os módulos de negócio e o dashboard |
| **colaborador** | Equipe operacional, marketing | Tarefas, agenda, conteúdo, acadêmico (operacional) |
| **comercial** | Vendedores | O mesmo que o colaborador, mais o Comercial: consulta o catálogo, registra as próprias vendas e vê os próprios números e metas |
| **professor** | Docentes das turmas | Suas turmas, aulas, presenças e avaliações; agenda; tarefas atribuídas |
| **aluno** | Alunos matriculados | **Sem login na v1.** Interage só pelos formulários públicos de presença e avaliação |

## Módulos
| Módulo | Resumo | Doc |
|---|---|---|
| Core | Usuários, papéis, convites, auditoria, LGPD | `modulos/core.md` |
| Tarefas | Espaços, listas, status personalizados, subtarefas (modelo ClickUp) | `modulos/tarefas.md` |
| Agenda | Cada usuário conecta seu Google Calendar | `modulos/agenda.md` |
| Acadêmico | Cursos, turmas, aulas, alunos, professores, fornecedores, presença e avaliação | `modulos/academico.md` |
| Conteúdo | Canais, calendário editorial, fluxo de aprovação e publicação | `modulos/conteudo.md` |
| Comercial | Catálogo de produtos, vendas, metas e dashboard (depois: Kommo e Meta Ads) | `modulos/comercial.md` |

## Roadmap por fases
| Fase | Entrega |
|---|---|
| **F0 — Fundação** | Projeto, deploy `teste`/`main` na Hostinger, Core (login, convites, papéis, auditoria) |
| **F1 — Tarefas** | Gestão de tarefas completa |
| **F2 — Acadêmico** | Cadastros, turmas, aulas, QR de presença, formulário de avaliação |
| **F3 — Agenda** | Conexão com o Google Calendar por usuário |
| **F4 — Conteúdo (planejamento)** | Canais, calendário editorial, aprovação |
| **F5 — Conteúdo (publicação)** | Publicação via API onde for possível (Instagram/Facebook primeiro) |
| **F6 — Comercial** | Produtos, vendas, metas e dashboard; depois, integrações Kommo e Meta Ads |

## Fora do escopo (por ora)
- Login e portal do aluno.
- Financeiro: cobranças, contratos e pagamentos a fornecedores.
- Ambiente de aulas/EAD e emissão de certificados.
- App mobile nativo. O sistema será web responsivo.

## Glossário
- **Curso:** produto ofertado (pós-graduação ou curso livre).
- **Turma:** edição de um curso, com datas e alunos.
- **Aula:** encontro de uma turma numa data, com um professor.
- **Matrícula:** vínculo do aluno com a turma.
- **Publicação:** peça de conteúdo planejada para um ou mais canais.
