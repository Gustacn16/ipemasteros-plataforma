# Módulo: Processos internos

## Objetivo
É a **wiki** da IPEMaster: a documentação viva de como a empresa funciona (missão, visão e valores, processos, captura de lead, funil de marketing). Cada processo segue o padrão do gerenciamento da rotina (Vicente Falconi): ficha, fluxo e procedimento.

Metas e indicadores **não** ficam aqui, e sim no módulo Planejamento (decisão de 2026-11-23).

- Especificação: `docs/superpowers/specs/2026-11-19-processos-internos-design.md`
- Decisão: `docs/decisoes/0009-processos-versao-publicada.md`

## Estrutura
**Categoria → Área → Documento.** Exemplo: Marketing → Aquisição → Captura de lead.

Tipos de documento:
- **Processo:** ficha do padrão, fluxograma e procedimento (texto).
- **Documento:** só texto (missão, políticas, guias).

## Entidades
| Entidade | Campos principais |
|---|---|
| `CategoriaProcesso` | id, nome, descricao, icone (lista fixa), ordem, excluidoEm |
| `AreaProcesso` | id, categoriaId, nome, descricao, ordem, excluidoEm |
| `DocumentoProcesso` | cópia de trabalho: id, areaId, tipo (`processo`/`texto`), titulo, resumo, conteudo (Markdown), objetivo, donoId, fornecedores, entradas, saidas, clientes, frequencia, fluxo (JSON), revisarACadaMeses, versaoPublicada, publicadoEm, tituloPublicado, resumoPublicado, alteradoAposPublicar, criadoPorId, atualizadoPorId, excluidoEm |
| `VersaoDocumentoProcesso` | documentoId, numero (único por documento), nota, dados (snapshot JSON), publicadoPorId |
| `LigacaoDocumentoProcesso` | origemId, destinoId: os `[[Título]]` da versão publicada |

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
7. **Exclusão lógica** em categorias, áreas e documentos. Categoria e área só podem ser excluídas vazias.
8. **Busca** em título, resumo, texto, ficha e fluxo. Compara sem acento e sem caixa, e filtra no código (lição do MySQL da Hostinger sobre collation).
9. **Estrutura inicial:** com a área vazia, a gestão pode criar categorias, áreas e rascunhos sugeridos (`servicos/estrutura-inicial.ts`).

## Permissões
Veja a tabela em `docs/04-seguranca-permissoes.md` (seção Processos internos).
- `processos:ver` vale para admin, gestor, colaborador e comercial.
- `processos:editar` vale para admin e gestor.

## Auditoria
`processos.documento_publicado`, `processos.versao_restaurada`, `processos.documento_excluido`, `processos.categoria_excluida`, `processos.area_excluida`.

## Telas
O cabeçalho de todas as telas tem a busca (a tecla `/` leva o cursor até ela). Para quem edita, tem também **Organizar** e **Novo documento**. Ao lado fica a árvore, com filtro por título e uma bolinha nos rascunhos. No celular, a árvore abre numa janela.

A área usa uma cor própria, **verde-petróleo** (`componentes/tema-processos.tsx`), no lugar do roxo.

- `/processos`:
  - "Atualizados recentemente" (quem edita vê os "Mexidos recentemente");
  - padrões com revisão vencida;
  - cartões por categoria e área (âncoras `#cat-` e `#area-`);
  - busca (`?busca=`);
  - estado vazio com "Criar estrutura sugerida".
- `/processos/documentos/[id]`:
  - trilha clicável, tipo, versão e revisão;
  - ficha, fluxograma e procedimento;
  - "Citado por";
  - anterior e próximo na ordem da árvore;
  - índice **"Nesta página"** fixo à direita em telas largas.
- `/processos/documentos/[id]/editar`:
  - sobre, ficha, editor do fluxo com prévia e texto com prévia;
  - salvar rascunho e publicar com nota;
  - excluir.
- `/processos/documentos/[id]/historico` e `/historico/[numero]`: versões e restaurar como rascunho.
- `/processos/organizar`: categorias e áreas (criar, editar, ordenar, excluir).

## Fora do escopo (por enquanto)
Imagens e anexos (falta a ADR de storage), editor visual arrastável, PDCA ligado a Tarefas, comentários e aprovação em duas etapas.
