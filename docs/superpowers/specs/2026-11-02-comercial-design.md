# Comercial — produtos, vendas, metas e dashboard: especificação

- **Status:** Proposto
- **Data:** 2026-11-02
- **Base:** `docs/modulos/dashboard.md` (fase F6), `docs/04-seguranca-permissoes.md` e o catálogo enviado pelo usuário (`produtos-ipemaster.md`, 12 produtos). Este documento substitui o `dashboard.md`: o dashboard passa a ser parte do módulo **Comercial**, e a integração com Meta Ads e Kommo vira entrega própria. Os docs afetados são atualizados durante a implementação.

## 1. Objetivo
Tirar o controle comercial das planilhas: registrar cada venda, cadastrar metas mensais por produto e vendedor, e acompanhar o realizado contra a meta num dashboard.

Critério de sucesso: o gestor cadastra as metas do mês, cada vendedor registra as próprias vendas pelo formulário (que já vem preenchido pela oferta do produto), e o dashboard mostra o vendido, o ticket médio, o % da meta e o ranking de vendedores.

## 2. Escopo
**Entra:** catálogo único de produtos (com ofertas e links), canais de venda, papel `comercial`, registro de vendas, metas mensais por produto × vendedor (valor e quantidade) e dashboard. Também entra a importação dos 12 produtos do catálogo atual.

**Fica para depois (cada um com sua especificação):**
- integração com o Kommo, depois de revisar a conta com o usuário;
- parcelas, recebimentos e MRR dos alunos;
- cálculo de comissão (a regra de base × bônus ainda não está definida);
- Meta Ads.

## 3. Decisões
| Decisão | Escolha | Motivo |
|---|---|---|
| Produtos | **Catálogo único**, cadastrado no Comercial e usado depois pelo Acadêmico (turmas apontam para `Produto`) | Evita cadastrar o mesmo curso duas vezes. O `Curso` do `academico.md` passa a ser o `Produto` |
| Comprador | Nome e WhatsApp, sem CPF | Basta para a equipe saber quem comprou, com o mínimo de dado pessoal |
| Pagamento | Só a forma de pagamento da venda, sem gerar parcelas | O controle de parcelas e MRR é uma entrega futura |
| Vendedores | Usuários do sistema com o papel novo `comercial` | O vendedor registra as próprias vendas e acompanha o desempenho |
| Fonte das vendas | Registro manual no sistema | Até o Kommo ser integrado, o sistema é a fonte oficial dos valores |
| Visual | Tema escuro **só no dashboard**, inspirado nas referências do usuário | O resto do sistema mantém o visual atual |
| Gráfico | Recharts (base do componente `chart` do shadcn) | Já integrado ao shadcn, sem dependência a mais |

## 4. Modelo de dados
Convenções do projeto: ids `cuid`, `criadoEm`/`atualizadoEm`, tabelas `snake_case` no plural via `@@map`. Dinheiro em `Decimal(12,2)`. Datas sem hora em `@db.Date`, com o dia de São Paulo.

| Modelo | Campos | Observações |
|---|---|---|
| `Produto` | id, nome (≤150), tipo (`curso_livre`/`paciente_modelo`/`pos_graduacao`), area? (≤80), sku? (≤60), ativo (padrão true), duracaoMeses?, recorrente (padrão false), responsavelPedagogico? (≤150), corpoDocente? (Text), cargaTeoricaPresencial?, cargaTeoricaSincrona?, cargaTeoricaAssincrona?, cargaPratica?, cargaExtra? (horas, inteiros), comissaoTipo (`valor`/`percentual`), comissaoBase (Decimal), comissaoBonus (Decimal), descricao? (Text), ementa? (Text), observacoes? (Text), excluidoEm? | SKU único entre não excluídos. Carga total = soma das cargas |
| `OfertaProduto` | id, produtoId, nome (≤80), padrao (bool), precoCheio, matricula, parcelas (int, 0 = à vista), valorParcela, descontoPontualidadePct (Decimal(5,2)), formasPagamento (JSON: lista de `pix`/`cartao`/`boleto`/`transferencia`), link? (≤500), ordem | No máximo uma oferta padrão por produto |
| `LinkProduto` | id, produtoId, titulo (≤150), url (≤500), categoria (`vendas`/`aulas`/`outro`), ordem | |
| `CanalVenda` | id, nome (≤60), ativo, ordem | Nome único. Lista inicial: Instagram, Indicação, Google, WhatsApp, Evento, Outro |
| `Venda` | id, produtoId, ofertaId?, vendedorId (Usuario), dataVenda (Date), dataEntradaLead? (Date), nomeCliente (≤150), whatsappCliente? (≤20, só dígitos), canalId?, dataEntrega? (Date), metodoPagamento (`pix`/`cartao`/`boleto`/`transferencia`), entrada, numeroParcelas (int ≥ 0), valorParcela, primeiroVencimento? (Date), valorTotal, observacoes? (Text), criadoPorId, excluidoEm? | Índices: (dataVenda), (vendedorId, dataVenda), (produtoId, dataVenda) |
| `MetaVenda` | id, mes (Date, sempre dia 1), produtoId, vendedorId, valorAlvo (Decimal), quantidadeAlvo (int) | Único por (mes, produtoId, vendedorId) |

`Papel` ganha o valor `comercial`, via migration.

## 5. Regras de negócio
1. `valorTotal = entrada + numeroParcelas × valorParcela`, calculado no servidor, que ignora o valor enviado pela tela. Deve ser maior que zero.
2. Ao escolher produto e oferta no formulário, entrada, parcelas e valor da parcela vêm da oferta: matrícula, parcelas e valor da parcela. Se o valor da parcela da oferta for 0, usa `(precoCheio − matricula) ÷ parcelas`, arredondado para centavos. O vendedor pode alterar tudo. A oferta padrão vem pré-selecionada.
3. Produto inativo ou excluído não aparece nos campos de escolha, mas continua nas vendas e metas antigas.
4. Excluir produto: só se ele não tiver nenhuma venda (mesmo excluída) nem meta. Senão, a ação é recusada com a orientação "desative o produto". A exclusão é lógica.
5. Vendedor de uma venda ou meta: usuário ativo com papel `comercial`, `gestor` ou `admin`.
6. O papel `comercial` só cria venda com ele mesmo como vendedor. Edita ou exclui a própria venda até 7 dias após `criadoEm`. Depois disso, só admin ou gestor.
7. Excluir venda é lógico (`excluidoEm`) e gera `registrarAuditoria()`. Criar e editar venda também geram auditoria, porque a venda guarda nome e WhatsApp do cliente.
8. Vendas excluídas não entram no dashboard nem na lista.
9. "Copiar metas do mês anterior" cria, para o mês escolhido, as metas que ainda não existem, com os mesmos valores do mês anterior. Não sobrescreve metas já cadastradas. Ignora produtos inativos e vendedores inativos.
10. O mês de uma venda é o mês de `dataVenda`. Como é uma data sem hora, não há conversão de fuso.
11. `dataEntradaLead`, quando preenchida, não pode ser posterior a `dataVenda`.

## 6. Permissões
Novas permissões em `src/lib/permissoes.ts`:

| Permissão | admin | gestor | comercial | demais |
|---|---|---|---|---|
| `comercial:ver` (entrar no módulo, consultar produtos, ver os próprios números) | ✅ | ✅ | ✅ | — |
| `comercial:registrar_venda` | ✅ | ✅ | ✅ 🔸 | — |
| `comercial:ver_equipe` (dashboard e vendas de todos) | ✅ | ✅ | — | — |
| `comercial:gerenciar_vendas` (qualquer venda, sem limite de 7 dias) | ✅ | ✅ | — | — |
| `comercial:gerenciar_metas` | ✅ | ✅ | — | — |
| `comercial:gerenciar_produtos` (produtos, ofertas, links e canais) | ✅ | ✅ | — | — |

🔸 Só as próprias vendas (regra 6), checada no serviço `src/modulos/comercial/servicos/acesso.ts`. Sem `comercial:ver_equipe`, o dashboard, a lista de vendas e as metas mostram só os registros do próprio usuário.

O papel `comercial` recebe também as permissões do `colaborador` (tarefas e conteúdo), para que o vendedor use o resto do sistema como a equipe.

Toda Server Action valida a entrada com Zod e checa acesso no servidor. Um registro fora do alcance responde "não encontrado".

## 7. Telas
| Rota | Conteúdo |
|---|---|
| `/comercial` | Dashboard (seção 8) |
| `/comercial/vendas` | Tabela de vendas com data, produto, cliente, vendedor, canal, método e valor total. Filtros na URL: período (este mês, mês passado ou intervalo), produto, vendedor e canal. Total do filtro no rodapé. Botão "Registrar venda" abre o formulário em diálogo, com os campos e a ordem da referência do usuário. Clicar numa venda abre a edição |
| `/comercial/metas` | Seletor de mês (padrão: mês atual). Tabela com uma linha por vendedor e um bloco por produto ativo, com campos de valor (R$) e quantidade, e totais por produto e por vendedor. Botão "Copiar do mês anterior". Quem não gerencia metas vê só as próprias, sem editar |
| `/comercial/produtos` | Lista agrupada por tipo, com filtros (tipo, área e ativos/inativos) e "+ Novo produto" |
| `/comercial/produtos/[id]` | Detalhe e edição em seções: dados gerais, carga horária, comissão, ofertas, links, descrição, ementa e observações. Ações "Desativar/Ativar" e "Excluir" (regra 4). Para o papel `comercial`, a mesma tela só para leitura |
| `/comercial/canais` | Lista editável de canais (nome, ativo e ordem) |

**Navegação:** o menu principal ganha o item **Comercial** para quem tem `comercial:ver`. Dentro do módulo há abas: Dashboard, Vendas, Metas e Produtos (Canais fica dentro de Produtos, para quem gerencia).

## 8. Dashboard
Tema escuro só nesta tela, inspirado na referência do usuário: fundo escuro em degradê, cartões arredondados translúcidos, números grandes e cor de destaque da marca IPEMaster. Responsivo, com o celular como referência principal.

**Filtros (na URL):** mês (padrão: atual), produto e vendedor. Sem `comercial:ver_equipe`, o vendedor fica fixo no próprio usuário.

| Bloco | Conteúdo |
|---|---|
| Cartões | **Vendido no mês** (soma de `valorTotal`) com selo de variação contra o mês anterior (verde se subiu, vermelho se caiu, sem selo se o mês anterior for 0). **Vendas** (quantidade). **Ticket médio** (vendido ÷ quantidade; "—" sem vendas). **% da meta** (vendido ÷ soma de `valorAlvo` do filtro; "—" sem meta) |
| Vendido × Meta | Linha do vendido por mês e linha tracejada da meta de cada mês. Alternância 6M/12M, com o último mês sendo o do filtro. Resumo: "R$ X em N meses · K de N bateram a meta" |
| Ranking de vendedores | Avatar, nome, vendido, quantidade e barra de progresso do valor contra a meta do vendedor. Ordem: vendido, do maior para o menor. Só com `comercial:ver_equipe` |
| Por produto | Produto, vendido / meta (R$), vendas / meta (quantidade) e barra de progresso |
| Vendas recentes | As 6 últimas vendas do filtro em cartões: produto, cliente, vendedor, valor e data |
| Funil do Kommo | Cartão "Em breve" |

**Cores do progresso da meta:** 🟢 ≥ 100%, 🟡 70–99%, 🔴 < 70%. Sem meta, mostra "—".

**Cálculo:** feito no banco a cada consulta (agregações por mês, produto e vendedor). As regras de conta (variação, ticket, %, faixas e limites de mês) ficam em funções puras em `src/modulos/comercial/regras/`.

## 9. Importação do catálogo
Os 12 produtos do `produtos-ipemaster.md`, com ofertas, links, comissão, carga horária, descrição e ementa, entram por uma **migration de dados** do Prisma, que roda no deploy de `teste` e depois em `main`. Os ids são fixos, e a migration só insere o que ainda não existe. Valores ausentes no arquivo (ex.: "—x" parcelas) ficam vazios ou 0. Os canais iniciais entram na mesma migration. Os textos não têm dado pessoal de clientes. Nomes de docentes são dados públicos do produto.

## 10. Entregas
Cada entrega é publicada na branch `teste` e validada pelo usuário antes da seguinte:

1. **Produtos:** papel `comercial`, permissões, modelos e migration, catálogo (lista, detalhe, ofertas e links), canais, importação dos 12 produtos e item Comercial no menu.
2. **Vendas:** formulário com preenchimento pela oferta, lista com filtros, edição, exclusão e auditoria.
3. **Metas:** tabela do mês e copiar do mês anterior.
4. **Dashboard:** tema escuro, cartões, gráfico, ranking, tabela por produto e vendas recentes.

A entrega 1 só começa depois que a sessão do bloco 2 de Tarefas commitar a mudança dela no `prisma/schema.prisma`, para que as duas migrations não entrem em conflito.

## 11. Testes
- **Vitest:** valor total (regra 1); preenchimento pela oferta (regra 2, inclusive o valor da parcela 0); regra de exclusão de produto; janela de 7 dias (regra 6); copiar metas sem sobrescrever; ticket médio, % da meta, faixas de cor e variação contra o mês anterior (incluindo divisor 0); limites de mês e janela 6M/12M; matriz de permissões do papel `comercial`; esquemas Zod (WhatsApp só com dígitos, datas e valores).
- **Homologação:** roteiro curto de teste manual entregue ao usuário a cada entrega, passo a passo.

## 12. Riscos
- **Dados do Kommo e vendas manuais podem divergir** quando a integração chegar. Até lá, o registro manual é a fonte oficial, e a especificação do Kommo define como conciliar.
- **Migration concorrente:** outra sessão está alterando o schema. A regra da seção 10 evita o conflito.
- **Tema escuro só numa tela:** os componentes do shadcn precisam funcionar dentro de um contêiner com a classe `dark`, sem afetar o resto do app. Validar na entrega 4.
