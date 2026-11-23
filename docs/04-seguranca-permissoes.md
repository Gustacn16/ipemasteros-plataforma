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
Cada usuário tem um papel: `admin`, `gestor`, `colaborador`, `comercial`, `professor` ou `aluno`. O papel `comercial` é o vendedor: tem as mesmas permissões do colaborador e, além delas, entra no módulo Comercial. O papel `aluno` fica reservado para o futuro, sem login na v1.

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
| **Tarefas:** criar espaços e definir membros | ✅ | ✅ | — | — |
| **Tarefas:** listas e status | ✅ | ✅ | 🔸 nos espaços em que é membro | — |
| **Tarefas:** tarefas | ✅ todos os espaços | ✅ todos os espaços | ✅ nos espaços em que é membro (exclui só as que criou) | 🔸 vê e conclui as atribuídas a ele |
| **Tarefas:** relatório | ✅ todos | ✅ todos | 🔸 só os próprios números | — |
| **Agenda:** usar a tela, a agenda pessoal e a assinatura (`agenda:usar`) | ✅ | ✅ | ✅ | ✅ |
| **Agenda:** ver o calendário da IPEMaster (`agenda:ver_institucional`) | ✅ | ✅ | ✅ | — |
| **Agenda:** ver só os eventos marcados como visíveis para professores (`agenda:ver_institucional_professor`) | — | — | — | 🔸 |
| **Agenda:** criar, editar e excluir eventos (`agenda:editar_institucional`) | ✅ | ✅ | ✅ | — |
| **Agenda:** gerenciar tipos de evento (`agenda:gerenciar_tipos`) | ✅ | ✅ | — | — |
| **Acadêmico:** cursos, turmas, aulas | ✅ | ✅ | ✅ | 👁 🔸 suas turmas |
| **Acadêmico:** dados pessoais de alunos | ✅ | ✅ | ✅ (CPF mascarado) | 🔸 nome e presença das suas turmas |
| **Acadêmico:** presenças | ✅ | ✅ | ✅ | 🔸 lança e corrige nas suas aulas |
| **Acadêmico:** avaliações | ✅ | ✅ | 👁 | 🔸 agregadas, das suas aulas |
| **Acadêmico:** fornecedores | ✅ | ✅ | ✅ | — |
| **Acadêmico:** exportar dados de alunos | ✅ | ✅ | — | — |
| **Conteúdo:** planejar, produzir e registrar publicações já aprovadas | ✅ | ✅ | ✅ | — |
| **Conteúdo:** aprovar | ✅ | ✅ | — | — |
| **Conteúdo:** contas, canais e conexões | ✅ | ✅ | — | — |
| **Integrações** (Meta, Kommo) | ✅ | — | — | — |

### Acadêmico (entrega 1)
Enquanto não há aulas nem ligação do professor com as turmas, valem estas permissões:

| Permissão | admin | gestor | colaborador | comercial | professor |
|---|---|---|---|---|---|
| `academico:ver` (entrar no módulo e consultar turmas, alunos e professores) | ✅ | ✅ | ✅ | ✅ | — |
| `academico:gerenciar` (turmas, alunos, matrículas e professores) | ✅ | ✅ | ✅ | ✅ | — |
| `academico:importar_alunos` (importar a planilha de alunos) | ✅ | ✅ | — | — | — |

### Processos internos
Wiki da empresa: todo o time interno lê os documentos publicados. Só a gestão escreve e publica.

| Permissão | admin | gestor | colaborador | comercial | professor |
|---|---|---|---|---|---|
| `processos:ver` (ler documentos publicados e o histórico) | ✅ | ✅ | ✅ | ✅ | — |
| `processos:editar` (categorias, áreas, documentos, publicar e restaurar) | ✅ | ✅ | — | — | — |

### Planejamento
O plano do ano é da gestão. O lançamento de resultados vale também para o responsável de cada indicador manual (regra em `src/modulos/planejamento/servicos/acesso.ts`).

| Permissão | admin | gestor | colaborador | comercial | professor |
|---|---|---|---|---|---|
| `planejamento:ver` (Painel, plano comercial e de marketing) | ✅ | ✅ | — | — | — |
| `planejamento:editar` (plano, premissas, turmas, metas avulsas, indicadores e metas) | ✅ | ✅ | — | — | — |
| `planejamento:lancar` (lançar resultados) | ✅ | ✅ | 🔸 só onde é responsável | 🔸 só onde é responsável | — |

### Comercial
O papel `comercial` tem, nos outros módulos, as mesmas permissões do colaborador. Colaborador e professor não entram no Comercial.

| Permissão | admin | gestor | comercial |
|---|---|---|---|
| `comercial:ver` (entrar no módulo, consultar produtos, ver os próprios números) | ✅ | ✅ | ✅ |
| `comercial:registrar_venda` | ✅ | ✅ | 🔸 só as próprias |
| `comercial:ver_equipe` (dashboard e vendas de todos) | ✅ | ✅ | — |
| `comercial:gerenciar_vendas` (qualquer venda, sem limite de 7 dias) | ✅ | ✅ | — |
| `comercial:gerenciar_metas` | ✅ | ✅ | — |
| `comercial:gerenciar_produtos` (produtos, ofertas, links e canais) | ✅ | ✅ | — |
| `comercial:excluir_produtos` (apagar produto do catálogo) | ✅ | — | — |
| `comercial:ver_marketing` (investimento, leads, CPL, CAC e ROAS) | ✅ | ✅ | — |
| `comercial:atribuir_campanhas` (ligar campanha da Meta a produto) | ✅ | ✅ | — |
| `comercial:gerenciar_integracao_meta` (tela da integração e "Atualizar agora") | ✅ | — | — |
| `comercial:importar_historico` (importar vendas e metas da plataforma antiga) | ✅ | — | — |
| `comercial:gerenciar_aviso_venda` (link do Make e teste do aviso de venda no grupo do C.S) | ✅ | — | — |

Admin e gestor convidam usuários com o papel `comercial`.

### WhatsApp
Colaborador e professor não usam o módulo. Só admin e gestor cadastram e excluem números; o comercial conecta o próprio número.

| Permissão | admin | gestor | comercial |
|---|---|---|---|
| `whatsapp:gerenciar_numeros` (cadastrar, excluir e ver o estado dos números) | ✅ | ✅ | — |
| `whatsapp:conectar_proprio` (conectar e desconectar o próprio número pelo QR) | — | — | 🔸 só o próprio |
| `whatsapp:ver_grupos` (ver grupos, ligar turma, escolher quais acompanhar) | ✅ | ✅ | — |
| `whatsapp:ver_equipe` (ver e categorizar todas as conversas individuais; abrir conversa de número de outro dono é auditado) | ✅ | ✅ | — |
| `whatsapp:ver_proprio` (ver e categorizar só as conversas dos próprios números) | — | — | 🔸 só o próprio |

### Nexu (assistente de IA)
Professor e aluno não usam o Nexu. Cada ferramenta do Nexu exige, além de `nexu:usar`, a permissão do módulo que ela consulta ou altera (lista completa em `docs/modulos/nexu.md`).

| Permissão | admin | gestor | colaborador | comercial |
|---|---|---|---|---|
| `nexu:usar` (conversar, ver o próprio histórico, confirmar ou recusar as próprias propostas) | ✅ | ✅ | ✅ | ✅ |
| `nexu:configurar` (modelo, limites e painel de uso em `/admin/nexu`) | ✅ | — | — | — |
| `espiao:ver` (telas do espião e ferramentas `espiao_*` do Nexu) | ✅ | ✅ | — | ✅ |
| `espiao:configurar` (concorrentes, páginas, teto de gasto, coletar agora, testar perfil) | ✅ | — | — | — |

- Conversa e proposta só são lidas ou alteradas pelo **dono**, inclusive pelo admin. O admin vê só números de uso, nunca o conteúdo.
- A ação proposta roda como a pessoa que confirmou, e o serviço do módulo refaz a checagem de permissão.
- `ver_agenda` exige `agenda:ver_institucional`. `propor_criar_evento` exige `agenda:editar_institucional` (só eventos institucionais).
- Nenhuma ferramenta devolve e-mail, telefone, CRM ou observações de aluno, nem nome de cliente de venda.

## Auditoria
`LogAuditoria` registra: `usuarioId`, `acao`, `entidade`, `entidadeId`, `diff` (antes/depois, **sem** CPF em claro), `ip`, `userAgent` e `criadoEm`.

Ações sempre auditadas:
- Login e logout, falhas de login.
- Convites, mudança de papel, desativação de usuário, cadastro do perfil (só a lista de campos, sem os valores).
- Criação, edição e exclusão de aluno, professor e matrícula.
- Visualização do CPF completo, exportação de dados.
- Conexão e desconexão de integrações.
- Publicação de conteúdo.
- Nexu: proposta confirmada (`nexu.proposta_confirmada`) e mudança de modelo ou limites (`nexu.configuracao_alterada`).
- Criação, edição e exclusão de venda (só nomes de campos e valor total, sem dados do cliente).

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
| Usuário interno | Apelido, WhatsApp, cargo, data de nascimento, foto de perfil | Identificação da equipe nas telas, contato interno e aniversários. A data de nascimento não é exibida a outros colaboradores, e a foto só é servida a usuários logados | Legítimo interesse (IX) / execução de contrato de trabalho (V) |
| Usuário interno e aluno (citado em conversa) | Texto das conversas com o Nexu, que pode citar nomes de alunos e dados de vendas; o sistema não envia à IA e-mail, telefone, CRM ou observações de aluno | Responder perguntas e propor ações da equipe | Legítimo interesse (IX) |
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
| Conversas, mensagens e propostas do Nexu | 90 dias sem atividade (ou quando a pessoa apaga) | Excluir de verdade (cron diário) |
| Registro de uso da IA (`UsoIa`: custo e tokens, **sem texto**) | Indeterminado, para histórico de custo | Manter |
| Logs de auditoria | 5 anos | Excluir |
| Logs de acesso (Marco Civil) | Mínimo de 6 meses | Excluir após 1 ano |
| Tokens de integração de usuário desativado | Imediato | Revogar e excluir |

A anonimização substitui nome, contatos e CPF por valores irreversíveis e mantém os agregados (contagens de presença).

### Direitos do titular (art. 18)
- O módulo Core tem a entidade `SolicitacaoTitular` (tipo, titular, status, prazo de resposta) e uma tela para o admin atender pedidos de acesso, correção, anonimização ou exclusão e portabilidade.
- O prazo de resposta é de 15 dias.
- A exportação dos dados de um titular sai em JSON/PDF.
- **WhatsApp:** o pedido de exclusão de um titular é atendido pela ação "Apagar dados de um telefone" (tela Números do WhatsApp, só `whatsapp:gerenciar_numeros`), que apaga contato, conversas e mensagens do telefone e audita só ids e contagens. A `SolicitacaoTitular` ainda não tem tela; a ligação com ela fica para quando a tela existir. Textos prontos para colar (descrição dos grupos, termo do vendedor, política de privacidade), pendentes de revisão jurídica: [`docs/lgpd/whatsapp-textos.md`](lgpd/whatsapp-textos.md).

### Encarregado (DPO) e incidentes
- **Encarregado: a definir.** Nome e canal de contato devem aparecer nos formulários públicos e na política de privacidade.
- Os formulários públicos exibem um aviso de privacidade curto com link para a política completa.
- **Incidente de segurança:**
  1. Conter o incidente.
  2. Avaliar o risco.
  3. Se houver risco ou dano relevante, comunicar a ANPD e os titulares em até 3 dias úteis (Res. CD/ANPD nº 15/2024).
  4. Registrar tudo no relatório de incidentes.
- **Operadores (subprocessadores):** Hostinger (hospedagem/banco), Google, Meta, Kommo, provedor de e-mail, storage de arquivos e Cloudflare. A lista fica mantida neste documento.
