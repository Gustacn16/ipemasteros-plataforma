# 0009 — Processos internos: versão publicada por snapshot

- **Status:** Aceito
- **Data:** 2026-11-19

> O número 0008 está reservado por outro ramo (`0008-download-de-urls-externas`).

## Contexto
A área de Processos internos guarda os padrões da empresa: texto, ficha do processo, fluxograma e indicadores. O time precisa ler sempre uma versão fechada, nunca um rascunho pela metade. A gestão precisa poder editar com calma, ver o histórico e voltar atrás. Também era preciso escolher o formato do texto e do fluxo sem depender de anexos, porque o storage de arquivos ainda não existe (ADR 0004).

## Decisão
- **Cópia de trabalho + snapshot:**
  - `DocumentoProcesso` é a cópia de trabalho, e só quem tem `processos:editar` a vê.
  - Publicar cria uma `VersaoDocumentoProcesso` com o snapshot em JSON (título, resumo, texto, ficha, dono e fluxo) e uma nota obrigatória do que mudou.
  - Quem só lê vê o snapshot da versão `versaoPublicada`. Na árvore e na busca, essa pessoa vê `tituloPublicado`/`resumoPublicado`.
  - Restaurar copia um snapshot de volta para a cópia de trabalho. Ele só aparece para o time depois de publicado de novo.
- **Texto em Markdown** (o `react-markdown` + `remark-gfm` que o sistema já usa):
  - sem HTML cru, sem imagens e só com links http/https/mailto ou relativos;
  - `[[Título]]` vira link para outro documento;
  - as ligações da versão publicada ficam em `LigacaoDocumentoProcesso`, para mostrar "Citado por".
- **Fluxo estruturado:** é uma lista de etapas (`etapa`/`decisao`/`fim`) em JSON, validada por Zod (até 30 etapas). As decisões apontam "Sim"/"Não" para outras etapas. O desenho fica no nosso componente, no estilo da referência visual.
- **Sem indicadores aqui (2026-11-23):** a primeira entrega tinha itens de controle por processo. Eles saíram porque metas e indicadores ficam no módulo Planejamento. Processos é só wiki. As tabelas `indicadores_processo` e `medicoes_indicador` foram removidas pela migration `20261123120000_processos_sem_indicadores`, e o enum `SentidoIndicador` ficou porque o Planejamento usa.

## Alternativas consideradas
- **Editor rico (Tiptap) e desenho livre (React Flow):** é mais agradável para editar, mas traz dependências grandes e um formato próprio de conteúdo, e o desenho livre tende a ficar bagunçado. Pode voltar se o uso pedir.
- **Versões por diferença (diff):** economiza espaço, mas complica a leitura e a restauração. Os documentos são pequenos.
- **Só um campo "publicado" sem versões:** o leitor veria cada edição na hora, e não haveria histórico.

## Consequências
- A leitura e o histórico são simples e seguros. Restaurar não perde nada.
- O banco cresce uma cópia do documento a cada publicação, o que é aceitável para textos.
- Imagens e anexos continuam esperando a ADR de storage.
