# Módulo: Processos internos

## Objetivo
É a documentação viva de como a IPEMaster funciona: missão, visão e valores, processos, captura de lead, funil de marketing. Segue o gerenciamento da rotina (Vicente Falconi):
- cada processo tem um **padrão** (ficha + fluxo + procedimento);
- cada processo é acompanhado por **itens de controle** (indicadores com meta);
- quando um resultado sai da meta, alguém escreve a **análise**.

- Especificação: `docs/superpowers/specs/2026-11-19-processos-internos-design.md`
- Decisão: `docs/decisoes/0009-processos-versao-publicada.md`

## Estrutura
**Categoria → Área → Documento.** Exemplo: Marketing → Aquisição → Captura de lead.

Tipos de documento:
- **Processo:** ficha do padrão, fluxograma, procedimento (texto) e indicadores.
- **Documento:** só texto (missão, políticas, guias).

## Entidades
| Entidade | Campos principais |
|---|---|
| `CategoriaProcesso` | id, nome, descricao, icone (lista fixa), ordem, excluidoEm |
| `AreaProcesso` | id, categoriaId, nome, descricao, ordem, excluidoEm |
| `DocumentoProcesso` | cópia de trabalho: id, areaId, tipo (`processo`/`texto`), titulo, resumo, conteudo (Markdown), objetivo, donoId, fornecedores, entradas, saidas, clientes, frequencia, fluxo (JSON), revisarACadaMeses, versaoPublicada, publicadoEm, tituloPublicado, resumoPublicado, alteradoAposPublicar, criadoPorId, atualizadoPorId, excluidoEm |
| `VersaoDocumentoProcesso` | documentoId, numero (único por documento), nota, dados (snapshot JSON), publicadoPorId |
| `LigacaoDocumentoProcesso` | origemId, destinoId: os `[[Título]]` da versão publicada |
| `IndicadorProcesso` | documentoId, nome, descricao (como medir), unidade, sentido (`maior_melhor`/`menor_melhor`), meta, frequencia (`semanal`/`mensal`/`trimestral`), responsavelId, ordem, excluidoEm |
| `MedicaoIndicador` | indicadorId, periodo (DATE, 1º dia do período; único por indicador), valor, meta (vigente no lançamento), analise, registradoPorId |

## Regras
1. **Rascunho e publicação.**
   - Salvar altera só a cópia de trabalho e marca `alteradoAposPublicar`.
   - Publicar exige uma nota, cria a versão N+1 (snapshot), atualiza título e resumo publicados, recalcula as ligações e grava auditoria.
2. **O que cada um vê.**
   - Quem só lê vê apenas documentos com `versaoPublicada > 0`, a partir do snapshot.
   - Quem edita vê a cópia de trabalho, com o aviso de alterações não publicadas.
3. **Restaurar** uma versão copia o snapshot para o rascunho, sem publicar.
4. **Fluxo:** até 30 etapas, dos tipos etapa, decisão e fim. Na decisão, "Sim" vai por padrão para a próxima etapa e "Não" é opcional. Destinos inválidos são limpos (`regras/fluxo.ts`).
5. **Links:** `[[Título]]` é comparado sem acento e sem caixa. Título que não existe aparece sublinhado tracejado.
6. **Revisão:** vence em `publicadoEm + revisarACadaMeses`. O documento vencido aparece em "Para revisar" e ganha um selo.
7. **Indicadores** (`regras/indicadores.ts`):
   - **Farol:** verde quando bate a meta (conforme o sentido), vermelho quando não bate, neutro sem meta.
   - **Situação:**
     - `sem_medicao`;
     - `atrasado`, quando o último lançamento é anterior ao período que já fechou;
     - `na_meta`, `fora_da_meta` ou `sem_meta`, conforme o último lançamento.
   - **Lançar de novo** no mesmo período substitui o resultado. Períodos futuros são recusados.
8. **Exclusão lógica** em categorias, áreas, documentos e indicadores. Categoria e área só podem ser excluídas vazias.
9. **Busca** em título, resumo, texto, ficha, fluxo e nomes de indicadores. Compara sem acento e sem caixa, e filtra no código (lição do MySQL da Hostinger sobre collation).
10. **Estrutura inicial:** com a área vazia, a gestão pode criar categorias, áreas e rascunhos sugeridos (`servicos/estrutura-inicial.ts`).

## Permissões
Veja a tabela em `docs/04-seguranca-permissoes.md` (seção Processos internos).
- `processos:ver` vale para admin, gestor, colaborador e comercial.
- `processos:editar` vale para admin e gestor.
- `processos:registrar_medicao` vale para admin e gestor, e também para o responsável de cada indicador.

## Auditoria
`processos.documento_publicado`, `processos.versao_restaurada`, `processos.documento_excluido`, `processos.categoria_excluida`, `processos.area_excluida`, `processos.indicador_excluido`, `processos.medicao_excluida`.

## Telas
- `/processos`:
  - visão geral com números (documentos, processos, fora da meta, para revisar);
  - pontos de atenção;
  - cartões por categoria e área;
  - busca (`?busca=`);
  - estado vazio com "Criar estrutura sugerida".
- `/processos/documentos/[id]`:
  - trilha, tipo, versão e revisão;
  - ficha (objetivo, dono, quando, fornecedores → entradas → saídas → clientes);
  - fluxograma;
  - procedimento;
  - itens de controle (farol, gráfico com a linha da meta, histórico com análises, lançar resultado);
  - "Citado por".
- `/processos/documentos/[id]/editar`:
  - sobre, ficha, editor do fluxo com prévia e texto com prévia;
  - salvar rascunho e publicar com nota;
  - excluir.
- `/processos/documentos/[id]/historico` e `/historico/[numero]`: versões e restaurar como rascunho.
- `/processos/indicadores`: painel com filtros por situação e "Sob minha responsabilidade", com lançamento direto.
- `/processos/organizar`: categorias e áreas (criar, editar, ordenar, excluir).
- A árvore lateral aparece em todas as telas do módulo. No celular, ela vira um bloco recolhível.

## Fora do escopo (por enquanto)
Imagens e anexos (falta a ADR de storage), editor visual arrastável, PDCA ligado a Tarefas, comentários e aprovação em duas etapas.
