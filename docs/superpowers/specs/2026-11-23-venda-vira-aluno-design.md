# Venda vira aluno — desenho curto

## Por quê
Quando o Comercial fecha uma venda de pós-graduação ou de curso com turma, o aluno deve
aparecer no Acadêmico na hora, sem ninguém digitar de novo.

## Caminhos considerados
- A) Fila "Aguardando turma" no Acadêmico: vendedor não muda nada; Acadêmico aloca.
- **B) Vendedor escolhe a turma na venda — escolhido pelo Gustavo**: aluno já cai na turma certa; um campo a mais no formulário.
- C) Turma automática: erra quando o produto tem mais de uma turma aberta.

## O que entra
1. **Campo "Turma" no formulário de venda.** Aparece quando o produto escolhido tem turmas
   abertas (planejada ou em andamento). Nesse caso é obrigatório. Produto sem turma aberta
   (ex.: paciente modelo) salva a venda como hoje, sem mexer no Acadêmico.
2. **Ao salvar a venda**, na mesma transação:
   - acha o aluno pelo WhatsApp (mesmos dígitos, com ou sem 55); se não achar, pelo nome
     sem acento quando o aluno não tem telefone diferente; senão cria o aluno com nome e WhatsApp;
   - cria a matrícula **ativa** nessa turma, início = data da venda, ligada à venda;
   - se o aluno já está nessa turma, não faz nada (não duplica nem liga; assim editar ou excluir a
     venda nunca mexe numa matrícula que ela não criou).
   - a turma só é obrigatória ao **criar** a venda; editar venda antiga sem turma continua funcionando.
3. **Editar a venda** mudando a turma (ou o produto): a matrícula criada pela venda muda de
   turma. Matrícula que já existia antes da venda não é mexida.
4. **Excluir a venda**: a matrícula criada por ela fica **cancelada** (não some), com nota "Venda excluída".
5. Na ficha do aluno, a matrícula mostra "Veio da venda de dd/mm/aaaa".

## Calls meus (corrigíveis)
- Ligação pela coluna nova `matriculas.venda_id` (única, opcional).
- Vendas antigas e a importação do histórico **não** geram alunos (já vieram pela planilha).
- O vendedor não precisa da permissão do Acadêmico: o aluno é criado pelo sistema como parte da venda.
  A lista de turmas no formulário mostra só nome da turma.
- Auditoria: `matricula.criada` com `{ origem: "venda" }`, sem nome nem telefone.
- Dados que a venda não tem (e-mail, CRM, nascimento) ficam para a ficha do aluno.

## Fora
Fila de alocação, criar turma a partir da venda, levar valores da venda para o Acadêmico.

## Coordenação
Mexe em arquivos do Comercial (`formulario-venda.tsx`, `servicos/vendas.ts`, esquema da venda):
avisar a sessão do Comercial antes de publicar.
