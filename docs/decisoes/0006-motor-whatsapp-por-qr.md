# 0006 — Motor de WhatsApp por QR (Baileys)

- **Status:** Aceito
- **Data:** 2026-11-17

## Contexto
O módulo de WhatsApp precisa ler os grupos e as conversas que os vendedores já têm no aplicativo, nos números da empresa. Só a conexão por QR (como o WhatsApp Web, um "aparelho conectado") enxerga esses grupos e esse histórico. A API oficial da Meta não lê os grupos existentes nem o que está no aplicativo do vendedor. A conexão por QR precisa de um programa sempre ligado, segurando a conexão aberta, e isso não cabe no servidor Node da Hostinger, que reinicia o app e não mantém processos longos.

## Decisão
- Um programa Node + TypeScript à parte, `motor-whatsapp/`, usando a biblioteca **Baileys** (pacote `baileys`, mantido pela WhiskeySockets), roda numa **VPS** sempre ligada.
- O motor conversa com o IPEMaster OS **só por HTTPS**, nas rotas `/api/whatsapp/motor/*`, com `Authorization: Bearer $MOTOR_WHATSAPP_SEGREDO`. Ele manda eventos em lote (QR novo, conectado, desconectado, sinal de vida a cada 60 s) e busca a fila de comandos (conectar, desconectar) a cada 3 s. Não acessa o banco.
- A sessão de cada número (chaves do aparelho conectado) fica **no disco da VPS**, em `sessoes/<numeroId>`, com cópia diária. Se perder, basta ler o QR de novo. O amigo guardava no banco; aqui as chaves mudam com frequência e mandar isso por HTTP seria pesado.
- Entra com `markOnlineOnConnect: false`, `syncFullHistory: false` e sem confirmação de leitura. Reconexão com espera crescente (2 s, 4 s, 8 s… até 5 min). Se o celular remove o aparelho, o motor apaga a sessão e avisa o sistema.
- Logs citam só o id da vaga e o estado. QR, telefone e segredo nunca vão para log.
- **Versão da Baileys: `6.7.24`, travada.** Em 2026-11-17 a tag `latest` do npm é `7.0.0-rc14` (ainda release candidate), a versão em que o sistema do amigo teve o bug de pareamento (o celular fica carregando e depois diz que não é possível conectar). A `6.7.24` é a estável mais nova (tag `legacy`, publicada junto com a rc14, já com a correção de segurança GHSA-qvv5-jq5g-4cgg, que pede 6.7.22 ou mais nova). Comparando o código de pareamento das duas, a rc14 define o prefixo de assinatura de aparelho para contas "hosted" mas não o usa; a 6.7.24 usa. Não há patch aplicado: não encontramos uma correção concreta e confirmada do bug do amigo para aplicar com `patch-package`.

## Alternativas consideradas
- **Evolution API:** servidor pronto em cima da Baileys, com painel próprio. Traz muito mais do que precisamos (banco próprio, filas, integrações), mais uma peça para atualizar e proteger, e os mesmos riscos da Baileys. Um motor pequeno nosso é mais fácil de entender e manter.
- **API oficial da Meta (Cloud API):** sem risco de bloqueio e oficial, mas não lê os grupos existentes nem o histórico do aplicativo, e cobra por conversa. Fica como caminho para disparo em massa no futuro.

## Consequências
- Conseguimos ler grupos e conversas reais dos números da empresa, com custo baixo (só a VPS).
- **Risco de bloqueio:** a conexão por QR não é oficial. Seguimos as regras da seção 9 do spec (`docs/superpowers/specs/2026-11-17-whatsapp-design.md`): sem "online" automático, sem confirmação de leitura, reconexão com espera crescente, disparo só para grupos com espera e limites.
- **Mais uma máquina para manter:** a VPS precisa de atualizações, vigia que religa o motor e cópia diária da pasta `sessoes/`.
- O MySQL continua fechado para fora: o motor só fala com o sistema por HTTPS.
- **Risco do pareamento:** a leitura real do QR só é testada na Task 9. Se o celular falhar ao conectar, as próximas tentativas são: subir para a versão estável mais nova que existir; pegar a versão atual do WhatsApp Web com `fetchLatestWaWebVersion`; ou aplicar um patch com `patch-package`, registrado num novo ADR.
- O motor não usa o `tsconfig.json`, o ESLint nem o Vitest da raiz, e o build da Hostinger não o inclui.
