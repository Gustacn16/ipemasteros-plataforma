-- CreateTable
CREATE TABLE `itens_checklist` (
    `id` VARCHAR(191) NOT NULL,
    `tarefa_id` VARCHAR(191) NOT NULL,
    `texto` VARCHAR(200) NOT NULL,
    `concluido` BOOLEAN NOT NULL DEFAULT false,
    `ordem` DECIMAL(20, 10) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `itens_checklist_tarefa_id_ordem_idx`(`tarefa_id`, `ordem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `etiquetas` (
    `id` VARCHAR(191) NOT NULL,
    `espaco_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(40) NOT NULL,
    `cor` CHAR(7) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `etiquetas_espaco_id_nome_key`(`espaco_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarefas_etiquetas` (
    `tarefa_id` VARCHAR(191) NOT NULL,
    `etiqueta_id` VARCHAR(191) NOT NULL,

    INDEX `tarefas_etiquetas_etiqueta_id_idx`(`etiqueta_id`),
    PRIMARY KEY (`tarefa_id`, `etiqueta_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historico_tarefas` (
    `id` VARCHAR(191) NOT NULL,
    `tarefa_id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `campo` ENUM('status', 'responsaveis', 'data_inicio', 'data_entrega', 'prioridade', 'lista') NOT NULL,
    `valor_antes` JSON NULL,
    `valor_depois` JSON NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historico_tarefas_tarefa_id_criado_em_idx`(`tarefa_id`, `criado_em`),
    INDEX `historico_tarefas_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `itens_checklist` ADD CONSTRAINT `itens_checklist_tarefa_id_fkey` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `etiquetas` ADD CONSTRAINT `etiquetas_espaco_id_fkey` FOREIGN KEY (`espaco_id`) REFERENCES `espacos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas_etiquetas` ADD CONSTRAINT `tarefas_etiquetas_tarefa_id_fkey` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas_etiquetas` ADD CONSTRAINT `tarefas_etiquetas_etiqueta_id_fkey` FOREIGN KEY (`etiqueta_id`) REFERENCES `etiquetas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_tarefas` ADD CONSTRAINT `historico_tarefas_tarefa_id_fkey` FOREIGN KEY (`tarefa_id`) REFERENCES `tarefas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_tarefas` ADD CONSTRAINT `historico_tarefas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

