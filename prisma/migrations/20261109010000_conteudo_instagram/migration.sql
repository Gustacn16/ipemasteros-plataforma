-- AlterTable
ALTER TABLE `publicacoes` ADD COLUMN `metricas_origem` ENUM('manual', 'instagram') NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE `contas_instagram` (
    `id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(40) NOT NULL,
    `usuario` VARCHAR(60) NOT NULL,
    `nome` VARCHAR(100) NULL,
    `pagina_id` VARCHAR(40) NULL,
    `foto_url` VARCHAR(1000) NULL,
    `canal_id` VARCHAR(191) NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contas_instagram_id_externo_key`(`id_externo`),
    UNIQUE INDEX `contas_instagram_canal_id_key`(`canal_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `midias_instagram` (
    `id` VARCHAR(191) NOT NULL,
    `conta_id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(40) NOT NULL,
    `tipo` ENUM('post', 'carrossel', 'reels', 'story') NOT NULL,
    `legenda` TEXT NULL,
    `permalink` VARCHAR(500) NOT NULL,
    `codigo` VARCHAR(40) NOT NULL,
    `miniatura_url` VARCHAR(1000) NULL,
    `publicado_em` DATETIME(3) NOT NULL,
    `alcance` INTEGER NULL,
    `visualizacoes` INTEGER NULL,
    `curtidas` INTEGER NULL,
    `comentarios` INTEGER NULL,
    `salvamentos` INTEGER NULL,
    `compartilhamentos` INTEGER NULL,
    `interacoes` INTEGER NULL,
    `visitas_perfil` INTEGER NULL,
    `respostas` INTEGER NULL,
    `metricas_em` DATETIME(3) NULL,
    `publicacao_id` VARCHAR(191) NULL,
    `removida_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `midias_instagram_id_externo_key`(`id_externo`),
    UNIQUE INDEX `midias_instagram_publicacao_id_key`(`publicacao_id`),
    INDEX `midias_instagram_conta_id_publicado_em_idx`(`conta_id`, `publicado_em`),
    INDEX `midias_instagram_codigo_idx`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metricas_conta_instagram` (
    `id` VARCHAR(191) NOT NULL,
    `conta_id` VARCHAR(191) NOT NULL,
    `periodo` ENUM('dia', 'mes') NOT NULL,
    `data` DATE NOT NULL,
    `alcance` INTEGER NULL,
    `visualizacoes` INTEGER NULL,
    `interacoes` INTEGER NULL,
    `curtidas` INTEGER NULL,
    `comentarios` INTEGER NULL,
    `salvamentos` INTEGER NULL,
    `compartilhamentos` INTEGER NULL,
    `cliques_link` INTEGER NULL,
    `novos_seguidores` INTEGER NULL,
    `deixaram_de_seguir` INTEGER NULL,
    `seguidores` INTEGER NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `metricas_conta_instagram_conta_id_periodo_data_key`(`conta_id`, `periodo`, `data`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `atualizacoes_instagram` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('completa', 'stories') NOT NULL,
    `origem` ENUM('agendada', 'manual') NOT NULL,
    `status` ENUM('em_andamento', 'concluida', 'falhou') NOT NULL DEFAULT 'em_andamento',
    `iniciado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalizado_em` DATETIME(3) NULL,
    `registros` INTEGER NOT NULL DEFAULT 0,
    `erro` TEXT NULL,
    `iniciada_por_id` VARCHAR(191) NULL,

    INDEX `atualizacoes_instagram_tipo_iniciado_em_idx`(`tipo`, `iniciado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contas_instagram` ADD CONSTRAINT `contas_instagram_canal_id_fkey` FOREIGN KEY (`canal_id`) REFERENCES `canais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `midias_instagram` ADD CONSTRAINT `midias_instagram_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `contas_instagram`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `midias_instagram` ADD CONSTRAINT `midias_instagram_publicacao_id_fkey` FOREIGN KEY (`publicacao_id`) REFERENCES `publicacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metricas_conta_instagram` ADD CONSTRAINT `metricas_conta_instagram_conta_id_fkey` FOREIGN KEY (`conta_id`) REFERENCES `contas_instagram`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `atualizacoes_instagram` ADD CONSTRAINT `atualizacoes_instagram_iniciada_por_id_fkey` FOREIGN KEY (`iniciada_por_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

