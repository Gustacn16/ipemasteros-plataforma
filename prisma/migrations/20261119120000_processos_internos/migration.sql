-- CreateTable
CREATE TABLE `categorias_processo` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `descricao` VARCHAR(300) NULL,
    `icone` VARCHAR(30) NOT NULL DEFAULT 'pasta',
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `areas_processo` (
    `id` VARCHAR(191) NOT NULL,
    `categoria_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `descricao` VARCHAR(300) NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `areas_processo_categoria_id_idx`(`categoria_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documentos_processo` (
    `id` VARCHAR(191) NOT NULL,
    `area_id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('texto', 'processo') NOT NULL DEFAULT 'processo',
    `titulo` VARCHAR(150) NOT NULL,
    `resumo` VARCHAR(300) NULL,
    `conteudo` MEDIUMTEXT NULL,
    `objetivo` TEXT NULL,
    `dono_id` VARCHAR(191) NULL,
    `fornecedores` TEXT NULL,
    `entradas` TEXT NULL,
    `saidas` TEXT NULL,
    `clientes` TEXT NULL,
    `frequencia` VARCHAR(120) NULL,
    `fluxo` JSON NULL,
    `revisar_a_cada_meses` INTEGER NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `versao_publicada` INTEGER NOT NULL DEFAULT 0,
    `titulo_publicado` VARCHAR(150) NULL,
    `resumo_publicado` VARCHAR(300) NULL,
    `publicado_em` DATETIME(3) NULL,
    `alterado_apos_publicar` BOOLEAN NOT NULL DEFAULT true,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `atualizado_por_id` VARCHAR(191) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `documentos_processo_area_id_idx`(`area_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `versoes_documento_processo` (
    `id` VARCHAR(191) NOT NULL,
    `documento_id` VARCHAR(191) NOT NULL,
    `numero` INTEGER NOT NULL,
    `nota` VARCHAR(300) NOT NULL,
    `dados` JSON NOT NULL,
    `publicado_por_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `versoes_documento_processo_documento_id_numero_key`(`documento_id`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ligacoes_documento_processo` (
    `origem_id` VARCHAR(191) NOT NULL,
    `destino_id` VARCHAR(191) NOT NULL,

    INDEX `ligacoes_documento_processo_destino_id_idx`(`destino_id`),
    PRIMARY KEY (`origem_id`, `destino_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indicadores_processo` (
    `id` VARCHAR(191) NOT NULL,
    `documento_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `descricao` TEXT NULL,
    `unidade` VARCHAR(20) NOT NULL DEFAULT '',
    `sentido` ENUM('maior_melhor', 'menor_melhor') NOT NULL DEFAULT 'maior_melhor',
    `meta` DECIMAL(18, 4) NULL,
    `frequencia` ENUM('semanal', 'mensal', 'trimestral') NOT NULL DEFAULT 'mensal',
    `responsavel_id` VARCHAR(191) NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `indicadores_processo_documento_id_idx`(`documento_id`),
    INDEX `indicadores_processo_responsavel_id_idx`(`responsavel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `medicoes_indicador` (
    `id` VARCHAR(191) NOT NULL,
    `indicador_id` VARCHAR(191) NOT NULL,
    `periodo` DATE NOT NULL,
    `valor` DECIMAL(18, 4) NOT NULL,
    `meta` DECIMAL(18, 4) NULL,
    `analise` TEXT NULL,
    `registrado_por_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `medicoes_indicador_indicador_id_periodo_key`(`indicador_id`, `periodo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `areas_processo` ADD CONSTRAINT `areas_processo_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_processo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_processo` ADD CONSTRAINT `documentos_processo_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `areas_processo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_processo` ADD CONSTRAINT `documentos_processo_dono_id_fkey` FOREIGN KEY (`dono_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_processo` ADD CONSTRAINT `documentos_processo_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documentos_processo` ADD CONSTRAINT `documentos_processo_atualizado_por_id_fkey` FOREIGN KEY (`atualizado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `versoes_documento_processo` ADD CONSTRAINT `versoes_documento_processo_documento_id_fkey` FOREIGN KEY (`documento_id`) REFERENCES `documentos_processo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `versoes_documento_processo` ADD CONSTRAINT `versoes_documento_processo_publicado_por_id_fkey` FOREIGN KEY (`publicado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ligacoes_documento_processo` ADD CONSTRAINT `ligacoes_documento_processo_origem_id_fkey` FOREIGN KEY (`origem_id`) REFERENCES `documentos_processo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ligacoes_documento_processo` ADD CONSTRAINT `ligacoes_documento_processo_destino_id_fkey` FOREIGN KEY (`destino_id`) REFERENCES `documentos_processo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indicadores_processo` ADD CONSTRAINT `indicadores_processo_documento_id_fkey` FOREIGN KEY (`documento_id`) REFERENCES `documentos_processo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indicadores_processo` ADD CONSTRAINT `indicadores_processo_responsavel_id_fkey` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicoes_indicador` ADD CONSTRAINT `medicoes_indicador_indicador_id_fkey` FOREIGN KEY (`indicador_id`) REFERENCES `indicadores_processo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `medicoes_indicador` ADD CONSTRAINT `medicoes_indicador_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

