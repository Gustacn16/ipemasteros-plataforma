-- AlterTable
ALTER TABLE `conversas_whatsapp` ADD COLUMN `chave_grupo` VARCHAR(60) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `conversas_whatsapp_chave_grupo_key` ON `conversas_whatsapp`(`chave_grupo`);

