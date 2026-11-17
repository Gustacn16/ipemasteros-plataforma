Loaded Prisma config from prisma.config.ts.

-- CreateTable
CREATE TABLE `conversas_nexu` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(120) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `conversas_nexu_usuario_id_atualizado_em_idx`(`usuario_id`, `atualizado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens_nexu` (
    `id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `papel` ENUM('usuario', 'assistente') NOT NULL,
    `conteudo` JSON NOT NULL,
    `ordem` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mensagens_nexu_conversa_id_ordem_idx`(`conversa_id`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `propostas_nexu` (
    `id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `tool_use_id` VARCHAR(64) NOT NULL,
    `tipo` ENUM('criar_tarefa', 'mudar_status_tarefa', 'adicionar_checklist', 'criar_evento', 'criar_post', 'registrar_venda') NOT NULL,
    `dados` JSON NOT NULL,
    `resumo` VARCHAR(500) NOT NULL,
    `status` ENUM('pendente', 'executando', 'confirmada', 'recusada', 'falhou') NOT NULL DEFAULT 'pendente',
    `erro` VARCHAR(500) NULL,
    `resultado_id` VARCHAR(40) NULL,
    `resultado_url` VARCHAR(300) NULL,
    `decidida_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `propostas_nexu_conversa_id_idx`(`conversa_id`),
    INDEX `propostas_nexu_usuario_id_status_idx`(`usuario_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usos_ia` (
    `id` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(30) NOT NULL,
    `usuario_id` VARCHAR(191) NULL,
    `inicio_pergunta` BOOLEAN NOT NULL DEFAULT false,
    `modelo` VARCHAR(60) NOT NULL,
    `tokens_entrada` INTEGER NOT NULL,
    `tokens_cache_escrita` INTEGER NOT NULL,
    `tokens_cache_leitura` INTEGER NOT NULL,
    `tokens_saida` INTEGER NOT NULL,
    `custo_micro_usd` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `usos_ia_criado_em_idx`(`criado_em`),
    INDEX `usos_ia_usuario_id_criado_em_idx`(`usuario_id`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracoes_ia` (
    `id` VARCHAR(191) NOT NULL,
    `modelo` VARCHAR(60) NOT NULL,
    `limite_mensal_micro_usd` INTEGER NOT NULL,
    `perguntas_por_dia` INTEGER NOT NULL,
    `atualizado_por_id` VARCHAR(191) NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `conversas_nexu` ADD CONSTRAINT `conversas_nexu_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_nexu` ADD CONSTRAINT `mensagens_nexu_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_nexu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `propostas_nexu` ADD CONSTRAINT `propostas_nexu_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_nexu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `propostas_nexu` ADD CONSTRAINT `propostas_nexu_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_ia` ADD CONSTRAINT `usos_ia_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configuracoes_ia` ADD CONSTRAINT `configuracoes_ia_atualizado_por_id_fkey` FOREIGN KEY (`atualizado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Configuração única do Nexu com os valores padrão (US$ 20 por mês, 50 perguntas por pessoa por dia).
INSERT INTO `configuracoes_ia` (`id`, `modelo`, `limite_mensal_micro_usd`, `perguntas_por_dia`, `atualizado_em`)
VALUES ('unica', 'claude-haiku-5-5', 20000000, 50, CURRENT_TIMESTAMP(3));
