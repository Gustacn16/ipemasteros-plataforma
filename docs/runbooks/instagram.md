# Runbook: conectar o Instagram ao Conteúdo

Passo a passo para ligar as métricas do Instagram (spec `docs/superpowers/specs/2026-11-04-conteudo-c2-instagram-metricas-design.md`, seção 8). Faça um passo de cada vez, com o Claude acompanhando. **A chave de acesso nunca é colada no chat**: só no painel da Hostinger.

Você precisa ser administrador do portfólio empresarial (Business Manager) da IPEMaster. O app `IPEMaster OS` e o usuário do sistema já existem (runbook do Meta Ads).

## 1. Conferir o Instagram

1. No aplicativo do Instagram da IPEMaster, abra **Configurações → Tipo de conta e ferramentas**. A conta precisa ser **profissional** (Empresa ou Criador de conteúdo).
2. Em **Central de contas**, confira que ela está ligada à **Página do Facebook** da IPEMaster.
3. Em https://business.facebook.com/settings → **Contas → Páginas** e **Contas → Contas do Instagram**, confira que a Página e o Instagram aparecem no portfólio da IPEMaster. Se não aparecerem, clique em **Adicionar** e siga o pedido.

## 2. Dar acesso ao usuário do sistema

1. Em https://business.facebook.com/settings → **Usuários → Usuários do sistema**, escolha `IPEMaster OS`.
2. Clique em **Atribuir ativos**:
   - **Páginas:** escolha a Página da IPEMaster e marque **Conteúdo** e **Insights** (ou "Controle total").
   - **Contas do Instagram:** escolha o Instagram da IPEMaster e marque **Conteúdo** e **Insights** (ou "Controle total").
     Clique em **Salvar alterações**.

## 3. Conferir a chave

1. No sistema, abra **Conteúdo → Integração Instagram** (link no fim do menu do Conteúdo, só para o admin).
2. Se a situação for **Falta permissão**, gere uma nova chave:
   1. No usuário do sistema, clique em **Gerar novo token**. App: `IPEMaster OS`. Expiração: **Nunca**.
   2. Permissões: `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_show_list` e `pages_read_engagement`.
   3. Copie a chave (ela aparece uma vez só).
   4. No hPanel → **Sites** → `teste.plataformaipemaster.com.br` → **Node.js** → **Variáveis de ambiente**, troque o valor de `META_ACCESS_TOKEN` pela chave nova. Salve. O Meta Ads continua funcionando, porque a chave nova também tem `ads_read`.
   5. Avise o Claude: ele publica de novo para a variável valer.

## 4. Primeira carga

1. Na tela da integração, clique em **Atualizar agora**. A primeira vez encontra as contas.
2. Na conta `@ipemaster`, escolha o canal **IPEMaster · Instagram** e deixe **Importar** marcado.
3. Clique em **Atualizar agora** de novo. Agora vêm todos os posts desde 1º de janeiro de 2026 e os números da conta. Pode levar alguns minutos; a tela se atualiza sozinha até terminar.

## 5. Agendar as atualizações

No hPanel → **Avançado → Cron Jobs** do site, crie os dois (o horário do servidor é UTC, como no Meta Ads). Troque `<CRON_SECRET>` pelo mesmo segredo do cron do Meta Ads:

```
0 7 * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/importar-instagram
5 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://teste.plataformaipemaster.com.br/api/cron/importar-stories-instagram
```

O primeiro roda todo dia às 4h de Brasília. O segundo roda de hora em hora, no minuto 5, e guarda os números dos stories enquanto eles estão no ar.

Para a produção, repita os passos 4 e 5 no site `plataformaipemaster.com.br` quando o Conteúdo for para lá.

## Problemas comuns

| Mensagem                                                | O que fazer                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "A chave de acesso da Meta é inválida ou foi revogada." | Gere uma nova chave (passo 3.2) e troque na Hostinger.                                           |
| "Falta permissão: …"                                    | Gere uma nova chave com as permissões da lista (passo 3.2).                                      |
| "A chave não tem permissão para ler o Instagram."       | Atribua a Página e o Instagram ao usuário do sistema (passo 2).                                  |
| "Nenhuma conta do Instagram encontrada…"                | Confira os passos 1 e 2.                                                                         |
| "A Meta limitou as consultas…"                          | Normal na primeira carga. Espere uma hora e clique em "Atualizar agora": continua de onde parou. |
| "N posts sem números nesta atualização."                | A Meta não respondeu sobre esses posts. A próxima atualização tenta de novo.                     |
| Stories sem números                                     | Stories com menos de 5 visualizações não têm números na Meta.                                    |

## Manutenção

- Uma vez por ano, confira a versão da Graph API em `src/lib/meta-graph.ts` (`VERSAO_GRAPH`) e a lista de métricas em `src/modulos/conteudo/regras/instagram.ts` (`METRICAS_POR_TIPO`) contra https://developers.facebook.com/docs/instagram-platform.
