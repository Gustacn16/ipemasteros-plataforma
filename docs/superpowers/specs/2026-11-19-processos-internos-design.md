# Processos internos — design (P1)

- **Data:** 2026-11-19
- **Módulo:** `processos` (`src/modulos/processos/`, rota `/processos`)
- **Doc do módulo:** `docs/modulos/processos.md` · **ADR:** `docs/decisoes/0009-processos-versao-publicada.md`

## Intenção
A IPEMaster quer documentar como ela funciona: missão, visão e valores, processos internos, captura de lead, funil de marketing. Essa documentação deve ser viva, fácil de navegar e de manter, e mostrar ao time o jeito IPEMaster de trabalhar.

O Gustavo pediu que a área siga os princípios de gestão de Vicente Falconi (gerenciamento da rotina): cada processo tem um **padrão** com dono, objetivo, entradas, saídas e fluxo, e é acompanhado por **itens de controle** (indicadores com meta). Quando um resultado sai da meta, alguém escreve a análise. O objetivo é clareza operacional: saber o que acompanhar e onde agir.

A referência visual é um fluxograma com etapas numeradas em cartões, setas, um losango de decisão com "Sim/Não" e a etapa final em cartão escuro. O documento mostra **texto e fluxo juntos**.

## Metas
1. Navegação em **Categoria → Área → Documento**, com uma árvore lateral e uma visão geral.
2. Dois tipos de documento:
   - **Documento**: só texto (ex.: missão, visão e valores).
   - **Processo**: ficha do padrão, fluxograma, texto do procedimento e indicadores.
3. Texto em Markdown, com prévia. `[[Título de outro documento]]` vira link, e cada documento mostra quem cita ele.
4. Fluxograma montado etapa por etapa (etapa, decisão, fim) e desenhado no estilo da referência, nas cores da marca.
5. Rascunho e publicação. Quem só lê vê a **última versão publicada**. Cada publicação guarda uma versão com uma nota do que mudou. Há histórico e é possível restaurar uma versão antiga como rascunho.
6. Revisão periódica do padrão ("revisar a cada N meses"), com aviso de revisão vencida.
7. Indicadores (itens de controle) com unidade, sentido (maior ou menor é melhor), meta, frequência e responsável. Cada um tem medições por período, farol, gráfico com a linha da meta e análise quando o resultado sai da meta.
8. Painel com todos os indicadores e o farol de cada um.
9. Busca por título, resumo, texto e fluxo.
10. Botão que cria uma estrutura inicial sugerida quando a área está vazia.

## Fora do escopo (P1)
- Imagens e anexos: o sistema ainda não tem storage de arquivos (ADR 0004). Fica para quando a ADR de storage existir.
- Editor visual arrastável do fluxo e setas livres entre quaisquer etapas. A decisão aponta para etapas por número.
- PDCA completo com planos de ação ligados a Tarefas.
- Comentários e aprovação em duas etapas.

## Anti-metas
- Virar um depósito de textos que ninguém abre. Por isso a leitura vem primeiro, com o fluxo visual no topo e a navegação sempre à vista.
- Leitor ver um rascunho pela metade.

## Permissões
| Permissão | admin | gestor | colaborador | comercial | professor |
|---|---|---|---|---|---|
| `processos:ver` (ler documentos publicados, painel) | ✅ | ✅ | ✅ | ✅ | — |
| `processos:editar` (categorias, áreas, documentos, indicadores, publicar) | ✅ | ✅ | — | — | — |
| `processos:registrar_medicao` (lançar resultado de qualquer indicador) | ✅ | ✅ | 🔸 só dos indicadores em que é responsável | 🔸 idem | — |

A checagem é sempre no servidor. A regra "responsável do indicador" fica no serviço do módulo.

## Abordagens consideradas
1. **Texto em Markdown + fluxo estruturado (JSON) + versão publicada por snapshot. (Escolhida.)** Usa o `react-markdown` que o sistema já tem. O fluxo fica como lista de etapas validada por Zod e é desenhado pelo nosso componente, o que garante o visual da referência. O snapshot deixa a leitura simples e segura.
2. **Editor rico (Tiptap) e desenho livre (React Flow).** Mais bonito para editar, mas são duas dependências grandes, o conteúdo fica em formato próprio e o desenho livre tende a ficar bagunçado. Fica para depois, se o uso pedir.
3. **Wiki só de texto com fluxo em imagem.** Depende de anexos, que não existem, e o fluxo não seria buscável nem fácil de manter.

## Modelo de dados
- `CategoriaProcesso` (`categorias_processo`): nome, descricao, icone, ordem, excluidoEm.
- `AreaProcesso` (`areas_processo`): categoriaId, nome, descricao, ordem, excluidoEm.
- `DocumentoProcesso` (`documentos_processo`): areaId, tipo (`texto`/`processo`), titulo, resumo, conteudo (Markdown), e os campos da ficha: objetivo, donoId, fornecedores, entradas, saidas, clientes, frequencia. Também tem fluxo (JSON), revisarACadaMeses, ordem, versaoPublicada, publicadoEm, alteradoAposPublicar, criadoPorId, atualizadoPorId e excluidoEm.
- `VersaoDocumentoProcesso`: documentoId, numero, nota, dados (JSON com o snapshot), publicadoPorId e criadoEm. É única por (documentoId, numero).
- `LigacaoDocumentoProcesso`: origemId, destinoId. Vem dos `[[...]]` da versão publicada e serve para mostrar "citado por".
- `IndicadorProcesso`: documentoId, nome, descricao (como medir), unidade, sentido (`maior_melhor`/`menor_melhor`), meta, frequencia (`semanal`/`mensal`/`trimestral`), responsavelId, ordem, excluidoEm.
- `MedicaoIndicador`: indicadorId, periodo (DATE, início do período), valor, meta (a meta vigente no lançamento), analise, registradoPorId. É única por (indicadorId, periodo).

## Regras
- Ao salvar, o documento marca `alteradoAposPublicar`. Publicar exige uma nota, cria a versão N+1 com o snapshot, recalcula as ligações e grava auditoria.
- Leitor: vê só documentos com `versaoPublicada > 0`, a partir do snapshot. Editor: vê a cópia de trabalho, com aviso de "alterações não publicadas".
- Revisão vencida: `publicadoEm + revisarACadaMeses < agora`.
- Farol de uma medição: bateu a meta (conforme o sentido) fica **verde**; não bateu fica **vermelho**; sem meta fica neutro. Indicador sem medição do último período esperado fica **atrasado** (âmbar).
- Medição fora da meta pede análise (o campo fica em destaque, mas não é obrigatório).
- Fluxo: no máximo 30 etapas. Uma decisão aponta "Sim" e "Não" para etapas existentes. Por padrão, "Sim" segue para a próxima.
- Exclusão é lógica. Uma categoria ou área só pode ser excluída vazia.
- Auditoria: publicar, restaurar versão, excluir documento, categoria, área ou indicador, e excluir medição.

## Telas
- `/processos`: busca no topo, cartões por categoria com áreas e documentos, "Para revisar" e "Fora da meta". O editor tem "Novo documento" e "Organizar".
- `/processos/documentos/[id]`: cabeçalho com trilha, tipo, versão e dono; ficha do processo em grade; fluxograma; texto; indicadores com farol, gráfico e medições; "Citado por".
- `/processos/documentos/[id]/editar`: dados básicos, ficha, editor do fluxo com prévia, texto com prévia, botão Publicar.
- `/processos/documentos/[id]/historico` e `/historico/[numero]`.
- `/processos/indicadores`: painel com o farol de todos os indicadores.
- `/processos/organizar`: categorias e áreas (criar, editar, ordenar, excluir).
- Árvore lateral em todas as telas no desktop. No celular, ela vira um bloco recolhível.

## Decisões tomadas pelo construtor
- O Gustavo pediu para seguir sem aprovações intermediárias. As escolhas acima (Markdown, fluxo por etapas, papéis) são minhas e ficam registradas aqui para ele revisar.

## Revisão de 2026-11-23 (pedido do Gustavo)
- **Sem indicadores:** metas e indicadores ficam no módulo Planejamento. Processos vira só wiki. O painel, os itens de controle, a permissão `processos:registrar_medicao` e as duas tabelas saíram.
- **Navegação:**
  - busca no cabeçalho com o atalho `/`;
  - Organizar e Novo documento sempre à mão (as abas saíram);
  - filtro na árvore;
  - árvore numa janela no celular;
  - índice "Nesta página";
  - anterior e próximo;
  - trilha clicável;
  - "Atualizados recentemente" na visão geral.
- **Cor:** verde-petróleo no lugar do roxo, só nesta área.
