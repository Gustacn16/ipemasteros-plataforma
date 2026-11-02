-- CreateTable
CREATE TABLE `agendas_externas` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `cor` VARCHAR(7) NOT NULL,
    `url_cifrada` TEXT NOT NULL,
    `ultimo_sucesso_em` DATETIME(3) NULL,
    `ultimo_erro` VARCHAR(200) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `agendas_externas_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assinaturas_agenda` (
    `usuario_id` VARCHAR(191) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `assinaturas_agenda_token_hash_key`(`token_hash`),
    PRIMARY KEY (`usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agendas_externas` ADD CONSTRAINT `agendas_externas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assinaturas_agenda` ADD CONSTRAINT `assinaturas_agenda_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

