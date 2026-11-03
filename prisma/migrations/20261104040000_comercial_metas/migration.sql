-- CreateTable
CREATE TABLE `metas_venda` (
    `id` VARCHAR(191) NOT NULL,
    `mes` DATE NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `vendedor_id` VARCHAR(191) NOT NULL,
    `valor_alvo` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `quantidade_alvo` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `metas_venda_vendedor_id_mes_idx`(`vendedor_id`, `mes`),
    UNIQUE INDEX `metas_venda_mes_produto_id_vendedor_id_key`(`mes`, `produto_id`, `vendedor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `metas_venda` ADD CONSTRAINT `metas_venda_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metas_venda` ADD CONSTRAINT `metas_venda_vendedor_id_fkey` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

