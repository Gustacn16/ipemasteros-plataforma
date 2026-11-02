-- CreateTable
CREATE TABLE `espacos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `cor` CHAR(7) NOT NULL,
    `ordem` DECIMAL(20, 10) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membros_espaco` (
    `espaco_id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membros_espaco_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`espaco_id`, `usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listas` (
    `id` VARCHAR(191) NOT NULL,
    `espaco_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `ordem` DECIMAL(20, 10) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `listas_espaco_id_idx`(`espaco_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `status_lista` (
    `id` VARCHAR(191) NOT NULL,
    `lista_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(40) NOT NULL,
    `cor` CHAR(7) NOT NULL,
    `tipo` ENUM('aberto', 'em_andamento', 'concluido') NOT NULL,
    `ordem` DECIMAL(20, 10) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `status_lista_lista_id_idx`(`lista_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarefas` (
    `id` VARCHAR(191) NOT NULL,
    `lista_id` VARCHAR(191) NOT NULL,
    `tarefa_pai_id` VARCHAR(191) NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `descricao` TEXT NULL,
    `status_id` VARCHAR(191) NOT NULL,
    `prioridade` ENUM('urgente', 'alta', 'normal', 'baixa') NOT NULL DEFAULT 'normal',
    `data_inicio` DATE NULL,
    `data_entrega` DATE NULL,
    `ordem` DECIMAL(20, 10) NOT NULL,
    `concluida_em` DATETIME(3) NULL,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `tarefas_lista_id_status_id_ordem_idx`(`lista_id`, `status_id`, `ordem`),
    INDEX `tarefas_tarefa_pai_id_idx`(`tarefa_pai_id`),
    INDEX `tarefas_data_entrega_idx`(`data_entrega`),
    INDEX `tarefas_concluida_em_idx`(`concluida_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarefas_responsaveis` (
    `tarefa_id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,

    INDEX `tarefas_responsaveis_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`tarefa_id`, `usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `membros_espaco` ADD CONSTRAINT `membros_espaco_espaco_id_fkey` FOREIGN KEY (`espaco_id`) REFERENCES `espacos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membros_espaco` ADD CONSTRAINT `membros_espaco_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listas` ADD CONSTRAINT `listas_espaco_id_fkey` FOREIGN KEY (`espaco_id`) REFERENCES `espacos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `status_lista` ADD CONSTRAINT `status_lista_lista_id_fkey` FOREIGN KEY (`lista_id`) REFERENCES `listas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_lista_id_fkey` FOREIGN KEY (`lista_id`) REFERENCES `listas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_tarefa_pai_id_fkey` FOREIGN KEY (`tarefa_pai_id`) REFERENCES `tarefas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_status_id_fkey` FOREIGN KEY (`status_id`) REFERENCES `status_lista`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas_responsaveis` ADD CONSTRAINT `tarefas_responsaveis_tarefa_id_fkey` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas_responsaveis` ADD CONSTRAINT `tarefas_responsaveis_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

