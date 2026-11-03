# Acadêmico, entrega 1: turmas, alunos, professores e importação

- **Status:** Aprovado pelo usuário em conversa (02/11/2026)
- **Data:** 2026-11-02
- **Base:** `docs/modulos/academico.md`, `docs/modulos/comercial.md`, `docs/04-seguranca-permissoes.md` e a planilha "Transplante Capilar e Tricologia [CONTROLE GERAL]" enviada pelo usuário. A planilha tem dados pessoais e **não** entra no repositório.

## 1. Objetivo
Saber quantos alunos ativos a IPEMaster tem em cada produto e em cada turma, a partir de uma base de alunos única no sistema. A base nasce da planilha que a equipe usa hoje.

**Critério de sucesso:** depois de importar a planilha no ambiente de teste, a tela "Visão geral" mostra, para cada produto, as turmas e o número de alunos ativos. Os números batem com uma contagem feita direto na planilha (situações "Ativo" e "Finalizou as práticas", por produto e turma).

## 2. Escopo
**Entra:**
- turmas por produto, incluindo a turma "Cíclica";
- alunos e matrículas;
- cadastro de professores, ainda sem ligação com turmas;
- contagem de ativos por produto e por turma;
- importação da planilha `.xlsx` por uma tela do sistema.

**Fica para depois:**
- aulas, presença por QR code, avaliações e fornecedores (próximas entregas do Acadêmico);
- professor ligado a turmas ou aulas, e a visão do próprio professor;
- CPF de alunos e professores (ver decisão 3);
- anonimização de aluno e exportação de dados;
- dados operacionais da planilha (kit, roupa cirúrgica, onboarding, práticas, certificado MEC, Instagram, aniversário);
- dados financeiros da planilha (plano de pagamento, valor da parcela), que são assunto do Comercial;
- ligação do campo `turma` da Agenda com as turmas.

## 3. Decisões
| # | Decisão | Escolha | Motivo |
|---|---|---|---|
| 1 | Curso | A turma aponta para o `Produto` do Comercial | Catálogo único (`comercial.md`) |
| 2 | Turma de entrada contínua | Turma com a marca `ciclica`, sem datas obrigatórias | Pedido do usuário (opção A) |
| 3 | CPF | **Opcional e fora desta entrega**: não há campo de CPF ainda | A planilha não tem CPF. Guardar CPF exige criptografia com uma chave nova no servidor. Ele volta com a presença por QR, que é quando passa a ser necessário |
| 4 | "Finalizou as práticas" | Matrícula `ativa` (conta como ativo), com "Finalizou as práticas; aguardando formatura" nas observações | Resposta do usuário |
| 5 | Colunas importadas | Nome, CRM, telefone, situação, turma, data de início, data de formatura, vigência, plano contratado e observações | Resposta do usuário (opção A) |
| 6 | Professor | Só cadastro | Resposta do usuário (opção C) |
| 7 | Importação | Tela com envio do `.xlsx`, prévia, escolha do produto para cada valor de "Curso", e gravação tudo ou nada | Dados pessoais não passam pelo Git; o usuário pode reimportar sozinho |
| 8 | Leitura do Excel | Biblioteca `exceljs@4.4.0`, só no servidor | Estável e conhecida; lê datas e várias abas |
| 9 | Busca de alunos | Filtro na própria tela, sem parâmetro na URL | Nome de aluno é dado pessoal (regra 7 do CLAUDE.md) |
| 10 | CRM sem UF | Permitido | A planilha não tem UF. A regra "CRM exige UF" do `academico.md` fica para quando houver CPF e presença |

## 4. Modelo de dados
| Modelo | Campos | Observações |
|---|---|---|
| `Turma` | id, produtoId, nome (≤60), ciclica (bool), dataInicio? (Date), dataFim? (Date), situacao (`planejada`/`em_andamento`/`concluida`/`cancelada`), observacoes? (Text), excluidoEm? | Nome único por produto entre não excluídas (checado no serviço). Índice (produtoId) |
| `Aluno` | id, nome (≤150), nomeBusca (≤150, sem acento e minúsculo), email? (≤150), telefone? (≤20, só dígitos), crm? (≤20), crmUf? (2), observacoes? (Text) | Índice (nomeBusca) |
| `Matricula` | id, alunoId, turmaId, situacao (`ativa`/`trancada`/`concluida`/`cancelada`), dataInicio? (Date), dataFormatura? (Date), vigencia? (≤40), plano? (≤255), observacoes? (Text) | Única por (alunoId, turmaId). Índice (turmaId, situacao) |
| `Professor` | id, nome (≤150), email? (≤150), telefone? (≤20), crm? (≤20), crmUf? (2), especialidade? (≤120), miniCurriculo? (Text), ativo (padrão true) | |

Todos os modelos têm `criadoEm` e `atualizadoEm`. `Produto` ganha a relação `turmas`.

## 5. Regras de negócio
1. **Ativos por turma** = matrículas `ativa` da turma.
2. **Ativos por produto** = alunos distintos com alguma matrícula `ativa` em turmas não excluídas do produto. Quem estiver em duas turmas do mesmo produto conta uma vez.
3. Um aluno tem no máximo uma matrícula por turma.
4. Turma só é excluída (exclusão lógica) se não tiver matrículas. Se tiver, o sistema orienta a mudar a situação para `cancelada` ou `concluida`.
5. Matrícula não é apagada: muda de situação. Aluno não é apagado nesta entrega.
6. A turma escolhida numa matrícula precisa ser de um produto não excluído.
7. CRM e UF são opcionais. A UF, quando informada, precisa ser uma sigla válida.
8. Criar ou editar aluno, criar ou editar matrícula e importar geram auditoria. O `diff` guarda só os **nomes** dos campos alterados, nunca os valores pessoais. A importação guarda só as contagens.

## 6. Importação da planilha
**Tela:** `/academico/alunos/importar`, com permissão `academico:importar_alunos`.

**Passo 1, envio.** O usuário escolhe o arquivo `.xlsx` (até 5 MB). O servidor lê as abas cuja primeira linha tem as colunas **Nome**, **Curso** e **Turma** (sem diferenciar maiúsculas e acentos). As demais abas são ignoradas e listadas como "ignoradas".

**Colunas reconhecidas** (pelo nome do cabeçalho, sem diferenciar maiúsculas, acentos e espaços nas pontas):

| Cabeçalho | Destino |
|---|---|
| Nome | `Aluno.nome` (linha sem nome é ignorada) |
| Curso | escolha do produto (passo 2) |
| Turma | `Turma.nome` |
| Formação ou Status | `Matricula.situacao` |
| CRM | `Aluno.crm` (número `28117.0` vira `"28117"`) |
| Telefone | `Aluno.telefone`, só dígitos |
| Data de Início | `Matricula.dataInicio` |
| Data de Formatura | `Matricula.dataFormatura` |
| Vigência | `Matricula.vigencia` |
| Plano da pós-graduação | `Matricula.plano` |
| OBS | `Matricula.observacoes` |

**Situação:** `Ativo` → ativa · `Finalizou as práticas` → ativa, com a nota da decisão 4 · `Trancado` → trancada · `Formado` → concluida · `Cancelado` → cancelada. Qualquer outro valor, ou valor vazio, é erro da linha.

**Turma:**
- "1ª turma", "1° turma", "1º turma" e "1a turma" viram **"1ª turma"**.
- "cíclico" ou "cíclica" viram **"Cíclica"**, com `ciclica = true`.
- Outros valores ficam como vieram, sem espaços nas pontas.
- Turma vazia é erro da linha.

**Passo 2, prévia.** A tela mostra, por aba:
- linhas lidas;
- contagem por situação;
- turmas encontradas.

Para cada valor distinto de "Curso", a tela mostra a quantidade de linhas e um campo para escolher um produto ativo ou "Ignorar estas linhas". O sistema sugere o produto quando o SKU ou o nome bate: "PÓS - TC&T" → PG001TCT; "PÓS - PSQ EAD" → Psiquiatria EAD; "PÓS - PSQ HIBRIDO" → Psiquiatria Híbrido. Os erros aparecem com aba e número da linha, **sem o nome do aluno**. A prévia não grava nada. O arquivo é reenviado no passo 3.

**Passo 3, gravação.** Tudo é gravado numa transação, ou nada é:
- Se houver erro em linha não ignorada, nada é gravado.
- **Turma:** procurada por (produto, nome); se não existir, é criada.
  - Situação inicial: `em_andamento` se a turma tiver matrícula ativa ou trancada; senão, `concluida`.
  - `dataInicio`: a menor data de início das linhas; fica vazia em turma cíclica.
  - Uma turma que já existe não é alterada.
- **Aluno:** procurado por `nomeBusca`. Quando o aluno existente e a linha têm telefone, e os telefones são diferentes, é outra pessoa: cria um novo aluno.
  - Aluno novo: grava nome, CRM e telefone.
  - Aluno existente: só preenche CRM e telefone que estiverem vazios.
- **Matrícula:** procurada por (aluno, turma). Se existir, atualiza situação, datas, vigência, plano e observações. Se não existir, é criada. Duas linhas para a mesma pessoa e a mesma turma contam como aviso, e vale a última.
- **Resultado:** turmas criadas, alunos criados, alunos atualizados, matrículas criadas, matrículas atualizadas e linhas ignoradas. A auditoria `alunos.importados` guarda só essas contagens.

Reimportar a mesma planilha não duplica nada.

## 7. Telas
Item "Acadêmico" do menu, hoje "em breve", passa a abrir `/academico`. As abas são Visão geral, Turmas, Alunos e Professores.

- `/academico`: **Visão geral**.
  - Um cartão por produto que tenha turmas, com o total de alunos ativos.
  - Dentro do cartão, uma tabela de turmas: nome, situação, ativos e total de matrículas.
  - No topo, o total geral de alunos ativos (distintos).
- `/academico/turmas`: lista agrupada por produto, com o botão "Nova turma" (produto, nome, cíclica, datas, situação).
- `/academico/turmas/[id]`:
  - dados editáveis da turma;
  - matrículas, com nome, situação, início e formatura;
  - "Adicionar aluno", escolhendo um aluno existente;
  - mudança da situação da matrícula;
  - exclusão da turma quando não houver matrículas.
- `/academico/alunos`: lista com nome, produtos e situação das matrículas, filtro por nome na tela e botões "Novo aluno" e "Importar planilha".
- `/academico/alunos/[id]`: dados editáveis, matrículas (produto, turma e situação, editáveis) e "Matricular em turma".
- `/academico/alunos/importar`: os três passos da seção 6.
- `/academico/professores`: lista com nome, especialidade e situação, mais "Novo professor".
- `/academico/professores/[id]`: dados editáveis e o botão Desativar/Ativar.

## 8. Permissões
Novas permissões em `src/lib/permissoes.ts`:

| Permissão | admin | gestor | colaborador | comercial | professor |
|---|---|---|---|---|---|
| `academico:ver` (entrar no módulo e ver tudo desta entrega) | ✅ | ✅ | ✅ | ✅ | — |
| `academico:gerenciar` (turmas, alunos, matrículas e professores) | ✅ | ✅ | ✅ | ✅ | — |
| `academico:importar_alunos` | ✅ | ✅ | — | — | — |

O papel `comercial` tem as permissões do colaborador nos outros módulos (`04-seguranca-permissoes.md`). O professor fica sem acesso até existir a ligação com as turmas.

## 9. Testes
Vitest para a parte pura:
- normalização de turma, situação, telefone, CRM e nome de busca;
- leitura das linhas a partir de células;
- planejamento da importação (criar ou atualizar, regra do telefone, linhas repetidas, erros e ignoradas);
- contagem de ativos por produto;
- esquemas Zod;
- novas permissões.

O build roda com `npx next build --webpack`. Depois do deploy, a verificação é no ambiente de teste, importando a planilha pelo navegador.
