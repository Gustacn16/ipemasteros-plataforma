-- AlterTable
ALTER TABLE `matriculas` ADD COLUMN `venda_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `matriculas_venda_id_key` ON `matriculas`(`venda_id`);

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_venda_id_fkey` FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

