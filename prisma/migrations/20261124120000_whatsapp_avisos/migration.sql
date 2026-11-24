-- AlterTable
ALTER TABLE `tipos_evento` ADD COLUMN `divulgar_nos_grupos` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `comandos_whatsapp` ADD COLUMN `executar_apos` DATETIME(3) NULL,
    MODIFY `tipo` ENUM('conectar', 'desconectar', 'enviar_grupo') NOT NULL;

-- CreateTable
CREATE TABLE `avisos_grupo` (
    `id` VARCHAR(191) NOT NULL,
    `evento_id` VARCHAR(191) NULL,
    `texto` TEXT NOT NULL,
    `agendado_para` DATETIME(3) NOT NULL,
    `situacao` ENUM('rascunho', 'aprovado', 'enviando', 'concluido', 'cancelado', 'falhou') NOT NULL DEFAULT 'rascunho',
    `origem` ENUM('agenda', 'avulso') NOT NULL,
    `retrato_evento` JSON NULL,
    `alerta` VARCHAR(255) NULL,
    `texto_por_ia` BOOLEAN NOT NULL DEFAULT false,
    `aprovado_por_id` VARCHAR(191) NULL,
    `aprovado_em` DATETIME(3) NULL,
    `criado_por_id` VARCHAR(191) NULL,
    `cancelado_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `avisos_grupo_evento_id_key`(`evento_id`),
    INDEX `avisos_grupo_situacao_agendado_para_idx`(`situacao`, `agendado_para`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `envios_aviso_grupo` (
    `id` VARCHAR(191) NOT NULL,
    `aviso_id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `numero_id` VARCHAR(191) NULL,
    `comando_id` VARCHAR(191) NULL,
    `situacao` ENUM('aguardando', 'enviado', 'falhou', 'sem_numero', 'cancelado') NOT NULL DEFAULT 'aguardando',
    `erro` VARCHAR(255) NULL,
    `enviado_em` DATETIME(3) NULL,

    UNIQUE INDEX `envios_aviso_grupo_comando_id_key`(`comando_id`),
    UNIQUE INDEX `envios_aviso_grupo_aviso_id_conversa_id_key`(`aviso_id`, `conversa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grupos_padrao_tipo_evento` (
    `tipo_id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`tipo_id`, `conversa_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `avisos_grupo` ADD CONSTRAINT `avisos_grupo_evento_id_fkey` FOREIGN KEY (`evento_id`) REFERENCES `eventos_institucionais`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_aviso_grupo` ADD CONSTRAINT `envios_aviso_grupo_aviso_id_fkey` FOREIGN KEY (`aviso_id`) REFERENCES `avisos_grupo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `envios_aviso_grupo` ADD CONSTRAINT `envios_aviso_grupo_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grupos_padrao_tipo_evento` ADD CONSTRAINT `grupos_padrao_tipo_evento_tipo_id_fkey` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_evento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grupos_padrao_tipo_evento` ADD CONSTRAINT `grupos_padrao_tipo_evento_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

