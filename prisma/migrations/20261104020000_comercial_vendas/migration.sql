-- CreateTable
CREATE TABLE `vendas` (
    `id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `oferta_id` VARCHAR(191) NULL,
    `vendedor_id` VARCHAR(191) NOT NULL,
    `data_venda` DATE NOT NULL,
    `data_entrada_lead` DATE NULL,
    `nome_cliente` VARCHAR(150) NOT NULL,
    `whatsapp_cliente` VARCHAR(20) NULL,
    `canal_id` VARCHAR(191) NULL,
    `data_entrega` DATE NULL,
    `metodo_pagamento` ENUM('pix', 'cartao', 'boleto', 'transferencia') NOT NULL,
    `entrada` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `numero_parcelas` INTEGER NOT NULL DEFAULT 0,
    `valor_parcela` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `primeiro_vencimento` DATE NULL,
    `valor_total` DECIMAL(12, 2) NOT NULL,
    `observacoes` TEXT NULL,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `vendas_data_venda_idx`(`data_venda`),
    INDEX `vendas_vendedor_id_data_venda_idx`(`vendedor_id`, `data_venda`),
    INDEX `vendas_produto_id_data_venda_idx`(`produto_id`, `data_venda`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_oferta_id_fkey` FOREIGN KEY (`oferta_id`) REFERENCES `ofertas_produto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_vendedor_id_fkey` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_canal_id_fkey` FOREIGN KEY (`canal_id`) REFERENCES `canais_venda`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

