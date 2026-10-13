# Módulo: Acadêmico

## Objetivo
Gerenciar a operação acadêmica: cursos, turmas, aulas, professores, alunos, matrículas e fornecedores. Também coletar **presença** e **avaliação** dos alunos por formulários públicos acessados por QR code.

## Entidades
| Entidade | Campos principais |
|---|---|
| `Curso` | id, nome, tipo (`pos_graduacao`/`curso_livre`), area, cargaHorariaTotal, frequenciaMinimaPct (padrão 75), ativo |
| `Turma` | id, cursoId, codigo (ex.: `DERM-2026-1`), dataInicio, dataFim, modalidade (`presencial`/`online`/`hibrida`), local, status (`planejada`/`em_andamento`/`concluida`/`cancelada`), vagas |
| `Disciplina` | id, cursoId, nome, cargaHoraria, ordem |
| `Aula` | id, turmaId, disciplinaId?, professorId, inicio, fim, local, status (`agendada`/`realizada`/`cancelada`), tokenPresenca, tokenAvaliacao, janelaPresencaInicio, janelaPresencaFim, avaliacaoAberta (bool) |
| `Professor` | id, usuarioId?, nome, email, telefone, cpfCriptografado, cpfHash, crm, crmUf, especialidade, miniCurriculo, ativo |
| `Aluno` | id, nome, email, telefone, cpfCriptografado, cpfHash (único), crm?, crmUf?, especialidade?, anonimizadoEm? |
| `Matricula` | id, alunoId, turmaId, status (`ativa`/`trancada`/`cancelada`/`concluida`), dataMatricula |
| `Presenca` | id, aulaId, matriculaId, origem (`qr_code`/`manual`), registradaEm, registradaPorId?, ipHash |
| `Fornecedor` | id, nome, tipo (`local`/`alimentacao`/`grafica`/`audiovisual`/`hospedagem`/`outro`), documento (CNPJ/CPF), contatoNome, email, telefone, observacoes, ativo |
| `TurmaFornecedor` | turmaId, fornecedorId, servico, observacoes |
| `ModeloAvaliacao` | id, nome, ativo, padrao (bool) |
| `PerguntaAvaliacao` | id, modeloId, texto, tipo (`nota_1_5`/`nps_0_10`/`texto`/`multipla`), opcoes?, obrigatoria, ordem |
| `RespostaAvaliacao` | id, aulaId, perguntaId, envioId (agrupa um envio), valorNumero?, valorTexto?, criadoEm |

## Telas
**Internas (logadas)**
- `/academico/cursos` e detalhe do curso (disciplinas, turmas)
- `/academico/turmas`:
  - lista com filtros por curso, status e período;
  - detalhe com abas **Aulas**, **Alunos/Matrículas**, **Frequência** (matriz aluno × aula com % e alerta abaixo do mínimo), **Avaliações**, **Fornecedores** e **Tarefas** vinculadas.
- `/academico/aulas/[id]`:
  - dados da aula;
  - **QR code de presença e de avaliação**, com botão "projetar em tela cheia" e "regenerar token";
  - lista de presentes em tempo real e lançamento manual.
- `/academico/alunos`: busca por nome, e-mail ou CPF (via hash); cadastro; importação CSV; histórico de matrículas.
- `/academico/professores`: cadastro, turmas e aulas, botão "convidar para o sistema".
- `/academico/fornecedores`: cadastro simples e turmas atendidas.
- `/academico/avaliacoes`: modelos de perguntas; relatórios por aula, professor, turma e curso.
- **Visão do professor:** "Minhas turmas" e "Minhas aulas", com QR, presença e avaliações agregadas.

**Públicas (sem login)**
- `/presenca/[token]`: identifica a aula pelo token e mostra nome do curso, turma e data. O aluno informa o **CPF**, aceita o aviso de privacidade e confirma.
- `/avaliacao/[token]`: formulário de avaliação da aula, **anônimo**.

## Regras de negócio
**Presença**
1. Cada aula tem um `tokenPresenca` único. O QR code projetado em sala aponta para `/presenca/<token>`.
2. O registro só é aceito dentro da janela (padrão: 30 min antes do início até 2h depois; configurável por aula).
3. O CPF informado é convertido em hash e buscado entre as **matrículas ativas da turma daquela aula**. Se não for encontrado, aparece uma mensagem genérica e nada é registrado.
4. Só existe uma presença por matrícula por aula (índice único). Reenviar mostra "presença já registrada".
5. Professor, coordenação e colaborador podem lançar ou remover presença manualmente, sempre com auditoria.
6. Frequência = presenças ÷ aulas `realizada` da turma. Abaixo de `frequenciaMinimaPct`, a matrícula aparece com alerta.
7. O token pode ser regenerado a qualquer momento, o que invalida o QR antigo.

**Avaliação**

8. A avaliação é **anônima**: `RespostaAvaliacao` não guarda aluno, CPF nem IP. Para limitar spam, há rate limit e um cookie de "já respondeu" (sem identificar a pessoa).
9. A avaliação abre quando a aula começa e fecha 7 dias depois (configurável). Usa o modelo padrão, a menos que a turma defina outro.
10. Professor vê só resultados agregados das próprias aulas, e só a partir de 5 respostas, para não identificar alunos. Comentários de texto aparecem sem data/hora exata.

**Cadastros**

11. O CPF é obrigatório e único para aluno, validado pelo dígito verificador.
12. CRM é opcional. Quando informado, a UF também é obrigatória.
13. Aluno não é excluído, é **anonimizado** (ver retenção em 04-seguranca). Matrícula cancelada mantém o histórico de presença.
14. Turma `concluida` fica somente leitura: presenças só mudam com permissão de gestor e com auditoria.
15. A importação CSV de alunos valida tudo antes de gravar e mostra um relatório de erros. Nada é importado parcialmente.

## Integrações
- **Agenda:** criar, alterar ou cancelar uma aula reflete no Google Calendar do professor, se ele estiver conectado.
- **Tarefas:** tarefas podem ser vinculadas a uma turma.
- **Dashboard:** `Curso` é a chave para atribuir investimento e vendas.

## Fora do escopo (v1)
Login do aluno, certificados, notas e provas, financeiro de matrícula, pagamento a fornecedores e professores.

## Dúvidas em aberto
- Identificação no formulário de presença: **CPF** foi a opção assumida. Alternativas: e-mail, ou QR individual por aluno (o aluno apresenta, a equipe escaneia). Confirmar.
- A avaliação deve ser por **aula** (assumido) ou por **disciplina/módulo**?
- Quais perguntas entram no modelo padrão de avaliação?
- Existe matrícula hoje vinda do Kommo (venda ganha → matrícula)? Pode ser automatizado na F6.
