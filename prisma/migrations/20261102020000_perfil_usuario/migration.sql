-- AlterTable
ALTER TABLE `usuarios` ADD COLUMN `apelido` VARCHAR(40) NULL,
    ADD COLUMN `cargo` VARCHAR(80) NULL,
    ADD COLUMN `data_nascimento` DATE NULL,
    ADD COLUMN `perfil_completo_em` DATETIME(3) NULL,
    ADD COLUMN `whatsapp` VARCHAR(15) NULL;

-- CreateTable
CREATE TABLE `fotos_usuarios` (
    `usuario_id` VARCHAR(191) NOT NULL,
    `dados` MEDIUMBLOB NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fotos_usuarios` ADD CONSTRAINT `fotos_usuarios_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

