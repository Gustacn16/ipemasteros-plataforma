-- CreateTable
CREATE TABLE `marcas` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `cor` CHAR(7) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `canais` (
    `id` VARCHAR(191) NOT NULL,
    `marca_id` VARCHAR(191) NOT NULL,
    `plataforma` ENUM('instagram', 'youtube', 'tiktok', 'facebook', 'linkedin', 'newsletter', 'blog', 'podcast', 'outro') NOT NULL,
    `identificador` VARCHAR(100) NULL,
    `ordem` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `canais_marca_id_idx`(`marca_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conteudos` (
    `id` VARCHAR(191) NOT NULL,
    `marca_id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `formato` ENUM('reels', 'carrossel', 'post', 'story', 'video', 'short', 'live', 'newsletter', 'artigo', 'outro') NOT NULL,
    `etapa` ENUM('ideia', 'planejado', 'a_gravar', 'gravado', 'edicao', 'revisao', 'aprovado', 'publicado', 'cancelado') NOT NULL DEFAULT 'ideia',
    `roteiro` TEXT NULL,
    `legenda` TEXT NULL,
    `link_material` VARCHAR(500) NULL,
    `responsavel_id` VARCHAR(191) NULL,
    `data_gravacao` DATE NULL,
    `data_publicacao` DATE NULL,
    `aprovado_por_id` VARCHAR(191) NULL,
    `aprovado_em` DATETIME(3) NULL,
    `publicado_em` DATETIME(3) NULL,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `conteudos_marca_id_etapa_idx`(`marca_id`, `etapa`),
    INDEX `conteudos_data_publicacao_idx`(`data_publicacao`),
    INDEX `conteudos_data_gravacao_idx`(`data_gravacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publicacoes` (
    `id` VARCHAR(191) NOT NULL,
    `conteudo_id` VARCHAR(191) NOT NULL,
    `canal_id` VARCHAR(191) NOT NULL,
    `status` ENUM('pendente', 'publicado') NOT NULL DEFAULT 'pendente',
    `url` VARCHAR(500) NULL,
    `publicado_em` DATETIME(3) NULL,
    `alcance` INTEGER NULL,
    `visualizacoes` INTEGER NULL,
    `curtidas` INTEGER NULL,
    `comentarios` INTEGER NULL,
    `compartilhamentos` INTEGER NULL,
    `salvamentos` INTEGER NULL,
    `metricas_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `publicacoes_canal_id_publicado_em_idx`(`canal_id`, `publicado_em`),
    UNIQUE INDEX `publicacoes_conteudo_id_canal_id_key`(`conteudo_id`, `canal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `canais` ADD CONSTRAINT `canais_marca_id_fkey` FOREIGN KEY (`marca_id`) REFERENCES `marcas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conteudos` ADD CONSTRAINT `conteudos_marca_id_fkey` FOREIGN KEY (`marca_id`) REFERENCES `marcas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conteudos` ADD CONSTRAINT `conteudos_responsavel_id_fkey` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conteudos` ADD CONSTRAINT `conteudos_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conteudos` ADD CONSTRAINT `conteudos_aprovado_por_id_fkey` FOREIGN KEY (`aprovado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publicacoes` ADD CONSTRAINT `publicacoes_conteudo_id_fkey` FOREIGN KEY (`conteudo_id`) REFERENCES `conteudos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publicacoes` ADD CONSTRAINT `publicacoes_canal_id_fkey` FOREIGN KEY (`canal_id`) REFERENCES `canais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

