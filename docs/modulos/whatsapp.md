# Módulo: WhatsApp

## Objetivo
Conectar os números de WhatsApp da escola e dos vendedores ao IPEMaster OS. Esta entrega (1) cria o motor de conexão (projeto à parte, `motor-whatsapp/`, com a Baileys) e a tela para cadastrar vagas de número e ler o QR. Conversas, mensagens e atendimento vêm nas próximas entregas.

## Entidades
| Entidade | Campos principais |
|---|---|
| `NumeroWhatsapp` | id, nome, finalidade (`escola`/`vendedor`), usuarioId? (dono; só vendedor), telefone?, situacao (`desconectado`/`aguardando_qr`/`conectado`/`erro`), qrAtual?, qrEm?, conectadoEm?, ultimoSinalEm?, erro?, excluidoEm |
| `ComandoWhatsapp` | id, numeroId, tipo (`conectar`/`desconectar`), situacao (`pendente`/`em_andamento`/`concluido`/`falhou`), tentativas |

A tela nunca fala com o motor: grava comandos no banco e o motor os busca. O motor também grava o QR, a situação e o sinal de vida (`ultimoSinalEm`).

## Permissões
- `whatsapp:gerenciar_numeros` (admin e gestor): vê todos os números, cria vagas, conecta, desconecta e exclui.
- `whatsapp:conectar_proprio` (papel `comercial`): vê, conecta e desconecta só os números dos quais é dono. Não cria nem exclui.
- `whatsapp:ver_grupos` (admin e gestor): vê os grupos, liga turma e escolhe quais acompanhar. Só a gestão enxerga grupos.
- `whatsapp:ver_equipe` (admin e gestor): vê todas as conversas individuais e muda a categoria delas.
- `whatsapp:ver_proprio` (papel `comercial`): vê e categoriza só as conversas dos números dos quais é dono.

## Telas
- `/whatsapp` redireciona para a primeira aba que a pessoa pode ver. As abas no topo são **Grupos · Conversas · Números**, cada uma só para quem pode. O item "WhatsApp" do menu aparece para quem tem qualquer uma das permissões do módulo.
- `/whatsapp/grupos`: tabela com nome, números da empresa no grupo, mensagens nos últimos 7 dias, turma (seletor) e o interruptor "Acompanhar". Grupo provisório mostra "Histórico guardado até <data>". Ao desmarcar, confirma "As mensagens guardadas deste grupo serão apagadas."
- `/whatsapp/conversas`: filtro por número e categoria; categoria editável por linha (marcar "pessoal" pede confirmação). O clique abre `/whatsapp/conversas/[id]` com as últimas 200 mensagens (texto, ou "[áudio]", "[imagem]" etc.).
- `/whatsapp/numeros`: tabela com nome, finalidade, dono, telefone, situação, conectado em e último sinal. Por linha: **Conectar** (quando não conectado), **Desconectar** (conectado; pede confirmação) e **Excluir** (qualquer situação menos conectado, só gestão). Em erro, a linha mostra o detalhe enviado pelo motor abaixo da situação. **Novo número** (só gestão): nome, finalidade e, para vendedor, o dono entre os usuários ativos com papel `comercial`.
- **Diálogo Conectar:** pede a conexão e consulta a situação a cada 2 s enquanto aberto. Mostra o QR com a instrução "No celular: WhatsApp › Aparelhos conectados › Conectar um aparelho". Ao conectar, mostra "Conectado!" e fecha em 2 s. Em QR expirado, erro, desconectado, removido no celular ou motor sem resposta, para de consultar e oferece "Tentar de novo". Em erro, mostra o detalhe enviado pelo motor (ex.: "Acesso recusado pelo WhatsApp.", "Não foi possível abrir a conexão (status 405).").

## Regras de negócio
1. Número de vendedor exige dono (usuário ativo com papel `comercial`); número da escola nunca tem dono.
2. A situação exibida combina o banco com o sinal do motor: sem sinal há mais de 5 min vira "Motor sem resposta"; QR com mais de 90 s vira "O QR expirou. Clique em Conectar de novo." e o QR antigo não é mostrado (o primeiro QR da Baileys vale 60 s; a folga evita expirar um QR ainda válido). O sinal traz a lista de vagas conectadas no motor: uma vaga "conectada" há mais de 2 min que não está na lista vira erro "O motor não está com este número conectado.".
3. Clique duplo em Conectar ou Desconectar não cria dois comandos pendentes para a mesma vaga.
4. Quando o celular remove o aparelho, a tela pede para ler o QR de novo.
5. Só não se exclui número conectado (desconecte antes); a exclusão é lógica (`excluidoEm`) e pede ao motor um `desconectar`, que é entregue mesmo com a vaga excluída para encerrar e apagar a sessão dela. Erro informado pelo motor põe a vaga em `erro` com o detalhe. Criar, excluir, conectar e desconectar geram auditoria (`whatsapp.*`).
6. O QR é gerado em SVG no servidor (`qrcode`) a cada consulta e nunca vai para log nem URL. O segredo do motor (`MOTOR_WHATSAPP_SEGREDO`) nunca aparece na tela.

7. **Grupos:** marcar "Acompanhar" limpa `provisoriaAte` (o histórico guardado vira definitivo); desmarcar apaga as mensagens do grupo na mesma transação. Ligar turma não gera auditoria.
8. **Categoria "pessoal":** apaga as mensagens da conversa na mesma transação da mudança, e a captura passa a descartar as próximas.
9. **Autor das mensagens:** nome do perfil; sem nome, "…" e os 4 últimos dígitos do telefone; sem telefone, "Contato sem nome". A tela nunca mostra o telefone completo nem o JID. Mensagens enviadas pelo próprio número aparecem como "Você".
10. **Auditoria (só ids e nomes de campos, nunca texto):** `whatsapp.grupo_monitorado`, `whatsapp.categoria_alterada` e `whatsapp.conversa_aberta`. Esta última só quando a conversa é de número cujo dono não é quem abre (inclui números da escola, sem dono); abrir a própria conversa ou um grupo não audita.

## Situação da implementação
**Entrega 1:** motor, comandos, tela de números e conexão por QR. Verificação na tela com o motor ligado é feita no site `teste`.

**Entrega 2a (tela):** abas, grupos e conversas com as mensagens capturadas. Responder mensagens fica para depois.
