-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `espiao_visto_em` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `configuracoes_ia` ADD COLUMN `limite_espiao_micro_usd` INTEGER NOT NULL DEFAULT 10000000;

-- CreateTable
CREATE TABLE `concorrentes` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `instagram` VARCHAR(30) NULL,
    `site` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,
    `excluido_em` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `paginas_concorrentes` (
    `id` VARCHAR(191) NOT NULL,
    `concorrente_id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `rotulo` VARCHAR(60) NOT NULL,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `legivel` BOOLEAN NOT NULL DEFAULT false,
    `ultimo_hash` VARCHAR(64) NULL,
    `ultima_captura_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,
    `excluido_em` DATETIME(3) NULL,

    INDEX `paginas_concorrentes_concorrente_id_idx`(`concorrente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `versoes_paginas` (
    `id` VARCHAR(191) NOT NULL,
    `pagina_id` VARCHAR(191) NOT NULL,
    `hash` VARCHAR(64) NOT NULL,
    `texto` LONGTEXT NOT NULL,
    `precos` JSON NOT NULL,
    `capturada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `versoes_paginas_pagina_id_capturada_em_idx`(`pagina_id`, `capturada_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fotos_instagram` (
    `id` VARCHAR(191) NOT NULL,
    `concorrente_id` VARCHAR(191) NOT NULL,
    `coleta_id` VARCHAR(191) NULL,
    `seguidores` INTEGER NOT NULL,
    `total_posts` INTEGER NOT NULL,
    `biografia` TEXT NULL,
    `site` VARCHAR(500) NULL,
    `capturada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fotos_instagram_concorrente_id_capturada_em_idx`(`concorrente_id`, `capturada_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `midias_concorrentes` (
    `id` VARCHAR(191) NOT NULL,
    `concorrente_id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(64) NOT NULL,
    `tipo` ENUM('post', 'carrossel', 'reels', 'video') NOT NULL,
    `legenda` TEXT NULL,
    `permalink` VARCHAR(500) NOT NULL,
    `publicado_em` DATETIME(3) NOT NULL,
    `curtidas` INTEGER NULL,
    `comentarios` INTEGER NULL,
    `visualizacoes` INTEGER NULL,
    `metricas_em` DATETIME(3) NOT NULL,
    `transcricao` LONGTEXT NULL,
    `resumo` TEXT NULL,
    `situacao_transcricao` ENUM('pendente', 'feita', 'sem_video', 'longa_demais', 'falhou', 'nao_se_aplica') NOT NULL DEFAULT 'nao_se_aplica',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `midias_concorrentes_id_externo_key`(`id_externo`),
    INDEX `midias_concorrentes_concorrente_id_publicado_em_idx`(`concorrente_id`, `publicado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `coletas_espiao` (
    `id` VARCHAR(191) NOT NULL,
    `origem` ENUM('agendada', 'manual') NOT NULL,
    `status` ENUM('rodando', 'concluida', 'parcial', 'falhou', 'sem_saldo') NOT NULL DEFAULT 'rodando',
    `iniciada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `progresso_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finalizada_em` DATETIME(3) NULL,
    `passos` JSON NOT NULL,
    `erros` JSON NOT NULL,

    INDEX `coletas_espiao_status_idx`(`status`),
    INDEX `coletas_espiao_iniciada_em_idx`(`iniciada_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sinais_espiao` (
    `id` VARCHAR(191) NOT NULL,
    `concorrente_id` VARCHAR(191) NOT NULL,
    `coleta_id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('conteudo_destaque', 'ritmo_mudou', 'seguidores_salto', 'pagina_nova', 'pagina_mudou', 'preco_mudou', 'bio_link_mudou') NOT NULL,
    `titulo` VARCHAR(300) NOT NULL,
    `detalhe` JSON NOT NULL,
    `origem_url` VARCHAR(500) NULL,
    `chave` VARCHAR(120) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sinais_espiao_chave_key`(`chave`),
    INDEX `sinais_espiao_criado_em_idx`(`criado_em`),
    INDEX `sinais_espiao_concorrente_id_criado_em_idx`(`concorrente_id`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `relatorios_espiao` (
    `id` VARCHAR(191) NOT NULL,
    `coleta_id` VARCHAR(191) NOT NULL,
    `analise` TEXT NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `relatorios_espiao_coleta_id_key`(`coleta_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gastos_espiao` (
    `id` VARCHAR(191) NOT NULL,
    `servico` ENUM('groq', 'dataforseo', 'apify') NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `custo_micro_usd` INTEGER NOT NULL,
    `coleta_id` VARCHAR(191) NULL,
    `usuario_id` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gastos_espiao_criado_em_idx`(`criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `paginas_concorrentes` ADD CONSTRAINT `paginas_concorrentes_concorrente_id_fkey` FOREIGN KEY (`concorrente_id`) REFERENCES `concorrentes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `versoes_paginas` ADD CONSTRAINT `versoes_paginas_pagina_id_fkey` FOREIGN KEY (`pagina_id`) REFERENCES `paginas_concorrentes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fotos_instagram` ADD CONSTRAINT `fotos_instagram_concorrente_id_fkey` FOREIGN KEY (`concorrente_id`) REFERENCES `concorrentes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fotos_instagram` ADD CONSTRAINT `fotos_instagram_coleta_id_fkey` FOREIGN KEY (`coleta_id`) REFERENCES `coletas_espiao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `midias_concorrentes` ADD CONSTRAINT `midias_concorrentes_concorrente_id_fkey` FOREIGN KEY (`concorrente_id`) REFERENCES `concorrentes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sinais_espiao` ADD CONSTRAINT `sinais_espiao_concorrente_id_fkey` FOREIGN KEY (`concorrente_id`) REFERENCES `concorrentes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sinais_espiao` ADD CONSTRAINT `sinais_espiao_coleta_id_fkey` FOREIGN KEY (`coleta_id`) REFERENCES `coletas_espiao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `relatorios_espiao` ADD CONSTRAINT `relatorios_espiao_coleta_id_fkey` FOREIGN KEY (`coleta_id`) REFERENCES `coletas_espiao`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gastos_espiao` ADD CONSTRAINT `gastos_espiao_coleta_id_fkey` FOREIGN KEY (`coleta_id`) REFERENCES `coletas_espiao`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gastos_espiao` ADD CONSTRAINT `gastos_espiao_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

