-- CreateTable
CREATE TABLE `configuracoes_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `modelo` VARCHAR(60) NOT NULL,
    `limite_mensal_micro_usd` INTEGER NOT NULL,
    `atualizado_por_id` VARCHAR(191) NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lotes_ia` (
    `id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(100) NULL,
    `tipo` ENUM('resumo_grupo', 'avaliacao') NOT NULL,
    `dia` DATE NOT NULL,
    `situacao` ENUM('aberto', 'concluido', 'falhou') NOT NULL DEFAULT 'aberto',
    `erro` VARCHAR(255) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `concluido_em` DATETIME(3) NULL,

    UNIQUE INDEX `lotes_ia_id_externo_key`(`id_externo`),
    UNIQUE INDEX `lotes_ia_tipo_dia_key`(`tipo`, `dia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `resumos_grupo` (
    `id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `dia` DATE NOT NULL,
    `lote_id` VARCHAR(191) NULL,
    `resumo` TEXT NULL,
    `temas` JSON NULL,
    `pendencias` JSON NULL,
    `destaques` JSON NULL,
    `participacao` JSON NOT NULL,
    `total_mensagens` INTEGER NOT NULL,
    `modelo` VARCHAR(60) NOT NULL,
    `situacao` ENUM('pendente', 'pronto', 'falhou') NOT NULL DEFAULT 'pendente',
    `erro` VARCHAR(255) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `resumos_grupo_dia_idx`(`dia`),
    UNIQUE INDEX `resumos_grupo_conversa_id_dia_key`(`conversa_id`, `dia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `configuracoes_whatsapp` ADD CONSTRAINT `configuracoes_whatsapp_atualizado_por_id_fkey` FOREIGN KEY (`atualizado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resumos_grupo` ADD CONSTRAINT `resumos_grupo_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `resumos_grupo` ADD CONSTRAINT `resumos_grupo_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lotes_ia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

