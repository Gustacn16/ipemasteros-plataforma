-- CreateTable
CREATE TABLE `configuracoes_comercial` (
    `id` VARCHAR(191) NOT NULL,
    `webhook_venda_cifrado` TEXT NULL,
    `aviso_venda_ativo` BOOLEAN NOT NULL DEFAULT true,
    `atualizado_por_id` VARCHAR(191) NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

