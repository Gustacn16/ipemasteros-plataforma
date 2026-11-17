# Conteúdo: ajustes de uso (canal → formato, criar de qualquer tela, arrastar, editor livre)

Pedido do Gustavo em 2026-11-17, com aprovação automática ("pode ir executando e revisando automaticamente e aprovando o que é necessário"):

1. Criar conteúdo exige voltar ao botão do topo do menu toda vez.
2. Não dá para arrastar os cartões no quadro.
3. Hoje escolhe formato e depois canal; deve ser canal primeiro e depois o formato, e o formato precisa poder mudar.
4. O detalhe deve ser "livre", como o Notion: tópicos, checklists etc.
5. Cada canal tem os próprios formatos (YouTube → avulso, entrevista, vlog), e o formato é o que organiza a visão.

## 1. Formatos por canal

- Tabela nova `FormatoCanal` (`formatos_canal`): `id`, `canalId`, `nome` (até 60), `ordem`, `ativo`, datas. Nome único por canal.
- `Conteudo.formatoId` (opcional) aponta para o formato. **O canal principal é o canal do formato.** Os outros canais da mesma conta continuam como publicações extras ("Também publicar em"). O canal principal sempre tem publicação.
- `Conteudo.formato` (o enum antigo) fica opcional e não é mais gravado. Não se apaga dado.
- Formatos iniciais por plataforma, criados na migration para os canais que existem e na criação de canal:
  - Instagram: Reels, Carrossel, Post, Story, Live
  - YouTube: Vídeo, Short, Live
  - TikTok: Vídeo, Live
  - Facebook: Post, Vídeo, Reels
  - LinkedIn: Post, Artigo, Vídeo
  - Newsletter: Newsletter
  - Blog: Artigo
  - Podcast: Episódio
  - Outro: Outro
- A migration liga os conteúdos que já existem: o canal principal é a primeira publicação (pela ordem do canal), e o formato é o do mesmo nome do enum antigo (criado se faltar). Conteúdo sem publicação fica sem formato ("Sem formato"), e o editor pede para escolher.
- Quem usa o Conteúdo cria um formato novo direto no formulário ("+ Novo formato"). Nas configurações (engrenagem), quem gerencia canais renomeia, reordena e desativa. Formato com conteúdo não é apagado, só desativado.
- O menu lateral mostra os formatos debaixo de cada canal: clicar filtra pelo formato. O filtro `formato` passa a guardar o id do formato. O valor antigo do cookie é ignorado.
- O cartão mostra primeiro "selo do canal + formato" (ex.: YouTube · Entrevista).

## 2. Criar de qualquer tela

- Botão **Novo conteúdo** no menu (como hoje), no cabeçalho de Planejamento, Calendário e Gravações, e a tecla N em qualquer tela do módulo.
- Botão **+** em cada coluna do quadro: o conteúdo já nasce naquela etapa, respeitando as mesmas regras de mudar etapa (aprovar exige permissão; depois de ideia precisa de canal, que agora sempre existe).
- Botão **+** em cada dia do calendário: já vem com a data de publicação.
- O formulário vem com o canal e o formato do filtro atual. Ordem dos campos: canal → formato → título → também publicar em → data.
- **Criar e adicionar outro** mantém a janela aberta e limpa só o título. **Criar** abre o conteúdo.

## 3. Arrastar no quadro

- Cartões arrastáveis entre colunas (arrastar nativo do navegador, sem biblioteca nova). Ao soltar, chama a mesma ação de mudar etapa. O cartão muda na hora; se o servidor recusar, volta e mostra o motivo.
- O seletor de etapa no cartão continua (celular e teclado).

## 4. Editor livre (estilo Notion)

- O campo "Roteiro / briefing" vira um editor de blocos chamado **Anotações e roteiro**.
- Tipos de bloco: texto, título, lista, checklist e divisória.
- Atalhos:
  - `/` num bloco vazio abre o menu de tipos.
  - Atalhos de Markdown: `# `, `- `, `[] ` e `---`.
  - Enter cria o próximo bloco (lista e checklist continuam; num item vazio, Enter volta a texto).
  - Backspace num bloco vazio apaga o bloco.
- Guarda como texto no campo `roteiro`, em Markdown simples (`# `, `- `, `- [ ] `, `- [x] `, `---`). O roteiro antigo continua aparecendo, como blocos de texto.
- Salva sozinho 1 s depois de parar de digitar ("Salvo"). A regra 5 (texto mudou num conteúdo aprovado → volta para revisão) vale igual.

## Testes

- Regras puras com teste: formatos iniciais por plataforma, ler e escrever os blocos, etapa inicial permitida.
- Migration conferida com `prisma migrate diff` e lida antes do envio.
