-- CreateTable
CREATE TABLE `planos_anuais` (
    `id` VARCHAR(191) NOT NULL,
    `ano` INTEGER NOT NULL,
    `observacoes` TEXT NULL,
    `conv_lead_agendada` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `comparecimento` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `conv_reuniao_venda` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `custo_por_lead` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `comissao_pct` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `teto_cac_pct` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `planos_anuais_ano_key`(`ano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `premissas_produto_plano` (
    `id` VARCHAR(191) NOT NULL,
    `plano_id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `contrato_medio` DECIMAL(12, 2) NOT NULL,
    `alunos_por_turma` INTEGER NOT NULL,
    `janela_vendas_meses` INTEGER NOT NULL,
    `duracao_meses` INTEGER NOT NULL,

    INDEX `premissas_produto_plano_produto_id_idx`(`produto_id`),
    UNIQUE INDEX `premissas_produto_plano_plano_id_produto_id_key`(`plano_id`, `produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `turmas_plano` (
    `id` VARCHAR(191) NOT NULL,
    `plano_id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(20) NOT NULL,
    `mes_abertura` DATE NOT NULL,
    `alunos` INTEGER NULL,
    `contrato_medio` DECIMAL(12, 2) NULL,
    `janela_vendas_meses` INTEGER NULL,
    `duracao_meses` INTEGER NULL,
    `observacoes` VARCHAR(300) NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `turmas_plano_plano_id_idx`(`plano_id`),
    INDEX `turmas_plano_produto_id_idx`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metas_avulsas_plano` (
    `id` VARCHAR(191) NOT NULL,
    `plano_id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `mes` DATE NOT NULL,
    `alunos` INTEGER NOT NULL DEFAULT 0,
    `valor` DECIMAL(12, 2) NOT NULL DEFAULT 0,

    INDEX `metas_avulsas_plano_produto_id_idx`(`produto_id`),
    UNIQUE INDEX `metas_avulsas_plano_plano_id_produto_id_mes_key`(`plano_id`, `produto_id`, `mes`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fechamentos_mes_plano` (
    `id` VARCHAR(191) NOT NULL,
    `plano_id` VARCHAR(191) NOT NULL,
    `mes` DATE NOT NULL,
    `dados` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fechamentos_mes_plano_plano_id_mes_key`(`plano_id`, `mes`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `indicadores_plano` (
    `id` VARCHAR(191) NOT NULL,
    `plano_id` VARCHAR(191) NOT NULL,
    `frente` ENUM('comercial', 'marketing') NOT NULL,
    `grupo` VARCHAR(60) NOT NULL DEFAULT '',
    `nome` VARCHAR(120) NOT NULL,
    `unidade` ENUM('numero', 'reais', 'percentual') NOT NULL DEFAULT 'numero',
    `sentido` ENUM('maior_melhor', 'menor_melhor') NOT NULL DEFAULT 'maior_melhor',
    `tipo` ENUM('fluxo', 'estoque', 'taxa') NOT NULL DEFAULT 'fluxo',
    `meta_calculada` VARCHAR(40) NULL,
    `fonte` VARCHAR(40) NOT NULL DEFAULT 'manual',
    `fonte_parametros` JSON NULL,
    `responsavel_id` VARCHAR(191) NULL,
    `no_painel` BOOLEAN NOT NULL DEFAULT true,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `indicadores_plano_plano_id_idx`(`plano_id`),
    INDEX `indicadores_plano_responsavel_id_idx`(`responsavel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metas_mensais_indicador` (
    `id` VARCHAR(191) NOT NULL,
    `indicador_id` VARCHAR(191) NOT NULL,
    `mes` DATE NOT NULL,
    `valor` DECIMAL(18, 4) NOT NULL,

    UNIQUE INDEX `metas_mensais_indicador_indicador_id_mes_key`(`indicador_id`, `mes`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `realizados_mensais_indicador` (
    `id` VARCHAR(191) NOT NULL,
    `indicador_id` VARCHAR(191) NOT NULL,
    `mes` DATE NOT NULL,
    `valor` DECIMAL(18, 4) NOT NULL,
    `observacao` VARCHAR(300) NULL,
    `registrado_por_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `realizados_mensais_indicador_registrado_por_id_idx`(`registrado_por_id`),
    UNIQUE INDEX `realizados_mensais_indicador_indicador_id_mes_key`(`indicador_id`, `mes`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `planos_anuais` ADD CONSTRAINT `planos_anuais_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `premissas_produto_plano` ADD CONSTRAINT `premissas_produto_plano_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos_anuais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `premissas_produto_plano` ADD CONSTRAINT `premissas_produto_plano_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turmas_plano` ADD CONSTRAINT `turmas_plano_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos_anuais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `turmas_plano` ADD CONSTRAINT `turmas_plano_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metas_avulsas_plano` ADD CONSTRAINT `metas_avulsas_plano_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos_anuais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metas_avulsas_plano` ADD CONSTRAINT `metas_avulsas_plano_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fechamentos_mes_plano` ADD CONSTRAINT `fechamentos_mes_plano_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos_anuais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indicadores_plano` ADD CONSTRAINT `indicadores_plano_plano_id_fkey` FOREIGN KEY (`plano_id`) REFERENCES `planos_anuais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `indicadores_plano` ADD CONSTRAINT `indicadores_plano_responsavel_id_fkey` FOREIGN KEY (`responsavel_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metas_mensais_indicador` ADD CONSTRAINT `metas_mensais_indicador_indicador_id_fkey` FOREIGN KEY (`indicador_id`) REFERENCES `indicadores_plano`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `realizados_mensais_indicador` ADD CONSTRAINT `realizados_mensais_indicador_indicador_id_fkey` FOREIGN KEY (`indicador_id`) REFERENCES `indicadores_plano`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `realizados_mensais_indicador` ADD CONSTRAINT `realizados_mensais_indicador_registrado_por_id_fkey` FOREIGN KEY (`registrado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

