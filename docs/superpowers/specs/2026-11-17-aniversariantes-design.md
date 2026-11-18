# Aniversariantes — desenho curto

## Por quê
A equipe manda parabéns no WhatsApp e um presentinho aos alunos e professores.
Precisa saber com antecedência (presente) e no dia (mensagem).

## Caminhos considerados
- **A) Tarefas automáticas em Tarefas** (presente 7 dias antes + WhatsApp no dia): rastreia quem fez, mas é o mais pesado e cria tarefas sem relógio no servidor.
- **B) Só aviso, sem tarefas** — **escolhido pelo Gustavo**: simples, sem duplicar nada, sem marcar "feito".
- C) Os dois: repetitivo.

## O que entra
1. **Campo `dataNascimento`** (data, opcional) em `Aluno` e `Professor`, nos formulários e na ficha. Migração nova.
2. **Importação** lê a coluna "Aniversário" da planilha e preenche só quando o aluno ainda não tem a data (nunca sobrescreve o que foi digitado).
3. **Acadêmico › Visão geral**: cartão no topo "Aniversariantes de <mês>" com nome, dia, aluno/professor; o de hoje em destaque; botão WhatsApp quando há telefone; link para a ficha.
4. **Início** e **Tarefas › Minhas tarefas**: cartão "Aniversários dos próximos 7 dias" (hoje + 7), com o mesmo botão WhatsApp. Some quando não há ninguém.

## Calls meus (corrigíveis)
- Contam: alunos com alguma matrícula **ativa** e professores **ativos**.
- Os cartões de Início/Tarefas só aparecem para quem tem `academico:ver` (o professor não vê).
- Janela de 7 dias para dar tempo do presente; atravessa a virada do ano.
- Nascido em 29/02: em ano não bissexto aparece em 28/02.
- WhatsApp: link `wa.me` com o telefone só com dígitos (prefixo 55 se faltar), abre em nova aba.
- Dia calculado no fuso de São Paulo (`diaEmSaoPaulo`).

## Fora
Tarefas automáticas, envio automático de mensagem, idade exibida.
