-- AlterTable
ALTER TABLE `usuarios` MODIFY `papel` ENUM('admin', 'gestor', 'colaborador', 'comercial', 'professor', 'aluno') NOT NULL DEFAULT 'colaborador';

-- AlterTable
ALTER TABLE `convites` MODIFY `papel` ENUM('admin', 'gestor', 'colaborador', 'comercial', 'professor', 'aluno') NOT NULL;

-- CreateTable
CREATE TABLE `produtos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `tipo` ENUM('curso_livre', 'paciente_modelo', 'pos_graduacao') NOT NULL,
    `area` VARCHAR(80) NULL,
    `sku` VARCHAR(60) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `duracao_meses` INTEGER NULL,
    `recorrente` BOOLEAN NOT NULL DEFAULT false,
    `responsavel_pedagogico` VARCHAR(150) NULL,
    `corpo_docente` TEXT NULL,
    `carga_teorica_presencial` INTEGER NULL,
    `carga_teorica_sincrona` INTEGER NULL,
    `carga_teorica_assincrona` INTEGER NULL,
    `carga_pratica` INTEGER NULL,
    `carga_extra` INTEGER NULL,
    `comissao_tipo` ENUM('valor', 'percentual') NOT NULL DEFAULT 'valor',
    `comissao_base` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `comissao_bonus` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `descricao` TEXT NULL,
    `ementa` TEXT NULL,
    `observacoes` TEXT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `produtos_sku_idx`(`sku`),
    INDEX `produtos_tipo_ativo_idx`(`tipo`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ofertas_produto` (
    `id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(80) NOT NULL,
    `padrao` BOOLEAN NOT NULL DEFAULT false,
    `preco_cheio` DECIMAL(12, 2) NOT NULL,
    `matricula` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `parcelas` INTEGER NOT NULL DEFAULT 0,
    `valor_parcela` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `desconto_pontualidade_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `formas_pagamento` JSON NOT NULL,
    `link` VARCHAR(500) NULL,
    `ordem` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `ofertas_produto_produto_id_idx`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `links_produto` (
    `id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `categoria` ENUM('vendas', 'aulas', 'outro') NOT NULL DEFAULT 'outro',
    `ordem` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `links_produto_produto_id_idx`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `canais_venda` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ordem` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `canais_venda_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ofertas_produto` ADD CONSTRAINT `ofertas_produto_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `links_produto` ADD CONSTRAINT `links_produto_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

