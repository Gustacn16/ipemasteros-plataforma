# Runbook: conectar o Meta Ads

Passo a passo para ligar a importação do Meta Ads (spec `docs/superpowers/specs/2026-11-02-meta-ads-design.md`, seção 8). Faça um passo de cada vez, com o Claude acompanhando. **A chave de acesso nunca é colada no chat**: só no painel da Hostinger.

Você precisa ser administrador do portfólio empresarial (Business Manager) da IPEMaster.

## 1. Criar o app da Meta
1. Abra https://developers.facebook.com/apps e clique em **Criar app**.
2. Em "Caso de uso", escolha **Outro**. Em "Tipo de app", escolha **Empresa**.
3. Nome do app: `IPEMaster OS`. Em "Portfólio empresarial", escolha o da **IPEMaster**. Clique em **Criar app**.
4. No painel do app, em **Adicionar produtos**, encontre **API de Marketing** e clique em **Configurar**.

## 2. Criar o usuário do sistema
1. Abra https://business.facebook.com/settings e escolha o portfólio da IPEMaster.
2. Em **Usuários → Usuários do sistema**, clique em **Adicionar**. Nome: `IPEMaster OS`. Função: **Administrador**.
3. Com o usuário criado, clique em **Atribuir ativos**:
   - **Apps:** escolha `IPEMaster OS` e marque **Gerenciar app**.
   - **Contas de anúncio:** escolha todas as contas da IPEMaster e marque **Ver desempenho**.
   Clique em **Salvar alterações**.

## 3. Gerar a chave
1. Ainda no usuário do sistema, clique em **Gerar novo token**.
2. App: `IPEMaster OS`. Expiração: **Nunca**.
3. Permissões: marque **ads_read**.
4. Clique em **Gerar token** e **copie** a chave. Ela aparece uma vez só; se perder, gere outra.

## 4. Guardar a chave na Hostinger
1. Abra o hPanel → **Sites** → `teste.plataformaipemaster.com.br` → **Node.js** (ou "Implantações") → **Variáveis de ambiente**.
2. Adicione a variável `META_ACCESS_TOKEN` e cole a chave como valor. Salve.
3. Avise o Claude: ele publica de novo para a variável valer (as outras variáveis não mudam).
4. Para a produção, repita no site `plataformaipemaster.com.br` quando o Comercial for para lá.

## 5. Agendar a importação diária
O Claude confere pelo conector da Hostinger se existe `CRON_SECRET` (só o nome; o valor fica escondido). Se não existir, ele combina com você como criar. Depois ele cria, com a sua aprovação, o cron das 4h:

```
0 4 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/importar-meta-ads
```

## 6. Primeira carga
1. No sistema, abra **Comercial → Meta Ads** e clique em **Atualizar agora**. A primeira vez traz tudo desde 1º de janeiro de 2026 e pode levar alguns minutos: a importação roda no servidor e a tela se atualiza sozinha até terminar. Se a página der erro ou você fechar a aba, a importação continua; volte depois e confira o histórico.
2. Confira as contas encontradas e desligue as que não devem entrar nos números.
3. A situação deve mostrar **Conectada**.

## Problemas comuns
| Mensagem | O que fazer |
|---|---|
| "A chave de acesso da Meta é inválida ou foi revogada." | Gere uma nova chave (passo 3) e troque na Hostinger (passo 4). |
| "A chave não tem permissão para ler esta conta." | No usuário do sistema, atribua a conta de anúncio com "Ver desempenho" (passo 2.3). |
| "A Meta limitou as consultas." | Espere alguns minutos e clique em "Atualizar agora" de novo. |
| "Integração não configurada." | Falta a variável `META_ACCESS_TOKEN` (passo 4). |
| "Tipos de resultado não contados como lead: …" | Normal: são cliques, curtidas etc. Se algum deles for lead de verdade, avise para incluir. |

## Manutenção
- Uma vez por ano, confira a versão da Graph API em `src/lib/meta-graph.ts` (`VERSAO_GRAPH`) contra https://developers.facebook.com/docs/graph-api/changelog.
