-- CreateTable
CREATE TABLE `contas_anuncio` (
    `id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(40) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `moeda` VARCHAR(3) NOT NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `historico_completo_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contas_anuncio_id_externo_key`(`id_externo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campanhas_anuncio` (
    `id` VARCHAR(191) NOT NULL,
    `conta_id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(40) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `objetivo` VARCHAR(60) NULL,
    `atribuicao` ENUM('produto', 'institucional', 'sem_produto') NOT NULL DEFAULT 'sem_produto',
    `produto_id` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `campanhas_anuncio_id_externo_key`(`id_externo`),
    INDEX `campanhas_anuncio_conta_id_idx`(`conta_id`),
    INDEX `campanhas_anuncio_produto_id_idx`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metricas_diarias_anuncio` (
    `id` VARCHAR(191) NOT NULL,
    `campanha_id` VARCHAR(191) NOT NULL,
    `data` DATE NOT NULL,
    `investimento` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressoes` INTEGER NOT NULL DEFAULT 0,
    `alcance` INTEGER NOT NULL DEFAULT 0,
    `cliques` INTEGER NOT NULL DEFAULT 0,
    `leads_formulario` INTEGER NOT NULL DEFAULT 0,
    `leads_site` INTEGER NOT NULL DEFAULT 0,
    `conversas_iniciadas` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `metricas_diarias_anuncio_data_idx`(`data`),
    UNIQUE INDEX `metricas_diarias_anuncio_campanha_id_data_key`(`campanha_id`, `data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `importacoes_anuncios` (
    `id` VARCHAR(191) NOT NULL,
    `origem` ENUM('agendada', 'manual') NOT NULL,
    `status` ENUM('em_andamento', 'concluida', 'falhou') NOT NULL DEFAULT 'em_andamento',
    `iniciado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalizado_em` DATETIME(3) NULL,
    `desde` DATE NULL,
    `ate` DATE NULL,
    `registros` INTEGER NOT NULL DEFAULT 0,
    `erro` TEXT NULL,
    `iniciada_por_id` VARCHAR(191) NULL,

    INDEX `importacoes_anuncios_iniciado_em_idx`(`iniciado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `campanhas_anuncio` ADD CONSTRAINT `campanhas_anuncio_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `contas_anuncio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campanhas_anuncio` ADD CONSTRAINT `campanhas_anuncio_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metricas_diarias_anuncio` ADD CONSTRAINT `metricas_diarias_anuncio_campanha_id_fkey` FOREIGN KEY (`campanha_id`) REFERENCES `campanhas_anuncio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `importacoes_anuncios` ADD CONSTRAINT `importacoes_anuncios_iniciada_por_id_fkey` FOREIGN KEY (`iniciada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

