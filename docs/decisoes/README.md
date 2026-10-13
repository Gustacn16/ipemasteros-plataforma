# Registros de Decisão de Arquitetura (ADR)

Cada decisão relevante de arquitetura vira um arquivo `NNNN-titulo-curto.md`. Um ADR aceito não é reescrito: se a decisão mudar, crie um novo ADR que **substitui** o anterior e atualize o status do antigo.

## Índice
| Nº | Título | Status |
|---|---|---|
| 0001 | [Escolha da stack](0001-escolha-da-stack.md) | Aceito |
| 0002 | [Build compatível com o servidor da Hostinger](0002-build-na-hostinger.md) | Aceito |

## Pendentes (a escrever)
- Storage de arquivos (anexos e mídias): R2 vs. Hostinger Object Storage (antes da F1)
- Biblioteca de editor de texto rico para tarefas e conteúdo (antes da F1)

## Modelo
```markdown
# NNNN — Título

- **Status:** Proposto | Aceito | Substituído por NNNN
- **Data:** AAAA-MM-DD

## Contexto
Qual problema ou necessidade motivou a decisão.

## Decisão
O que foi decidido.

## Alternativas consideradas
Opções avaliadas e por que não foram escolhidas.

## Consequências
O que fica mais fácil, o que fica mais difícil, riscos.
```
