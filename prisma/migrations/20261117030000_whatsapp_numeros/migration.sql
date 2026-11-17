-- CreateTable
CREATE TABLE `numeros_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `finalidade` ENUM('escola', 'vendedor') NOT NULL,
    `usuario_id` VARCHAR(191) NULL,
    `telefone` VARCHAR(20) NULL,
    `situacao` ENUM('desconectado', 'aguardando_qr', 'conectado', 'erro') NOT NULL DEFAULT 'desconectado',
    `qr_atual` TEXT NULL,
    `qr_em` DATETIME(3) NULL,
    `conectado_em` DATETIME(3) NULL,
    `ultimo_sinal_em` DATETIME(3) NULL,
    `erro` VARCHAR(255) NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `numeros_whatsapp_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `comandos_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `numero_id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('conectar', 'desconectar') NOT NULL,
    `dados` JSON NULL,
    `situacao` ENUM('pendente', 'em_andamento', 'concluido', 'falhou') NOT NULL DEFAULT 'pendente',
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `iniciado_em` DATETIME(3) NULL,
    `concluido_em` DATETIME(3) NULL,
    `erro` VARCHAR(255) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `comandos_whatsapp_situacao_criado_em_idx`(`situacao`, `criado_em`),
    INDEX `comandos_whatsapp_numero_id_situacao_idx`(`numero_id`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `numeros_whatsapp` ADD CONSTRAINT `numeros_whatsapp_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `comandos_whatsapp` ADD CONSTRAINT `comandos_whatsapp_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

