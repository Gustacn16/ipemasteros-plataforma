-- AlterTable
ALTER TABLE `contas_anuncio` ADD COLUMN `historico_criativos_em` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `criativos_anuncio` (
    `id` VARCHAR(191) NOT NULL,
    `campanha_id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(40) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `status` VARCHAR(30) NOT NULL,
    `miniatura` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `criativos_anuncio_id_externo_key`(`id_externo`),
    INDEX `criativos_anuncio_campanha_id_idx`(`campanha_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metricas_diarias_criativo` (
    `id` VARCHAR(191) NOT NULL,
    `criativo_id` VARCHAR(191) NOT NULL,
    `data` DATE NOT NULL,
    `investimento` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impressoes` INTEGER NOT NULL DEFAULT 0,
    `cliques_link` INTEGER NOT NULL DEFAULT 0,
    `leads_formulario` INTEGER NOT NULL DEFAULT 0,
    `leads_site` INTEGER NOT NULL DEFAULT 0,
    `conversas_iniciadas` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `metricas_diarias_criativo_data_idx`(`data`),
    UNIQUE INDEX `metricas_diarias_criativo_criativo_id_data_key`(`criativo_id`, `data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `criativos_anuncio` ADD CONSTRAINT `criativos_anuncio_campanha_id_fkey` FOREIGN KEY (`campanha_id`) REFERENCES `campanhas_anuncio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metricas_diarias_criativo` ADD CONSTRAINT `metricas_diarias_criativo_criativo_id_fkey` FOREIGN KEY (`criativo_id`) REFERENCES `criativos_anuncio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

