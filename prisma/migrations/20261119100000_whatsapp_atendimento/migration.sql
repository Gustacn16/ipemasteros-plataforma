-- AlterTable
ALTER TABLE `numeros_whatsapp` ADD COLUMN `time` ENUM('cs', 'paciente_modelo', 'comercial', 'outro') NOT NULL DEFAULT 'outro',
    ADD COLUMN `time_desde` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `configuracoes_whatsapp` ADD COLUMN `regras_atendimento` JSON NULL;

-- CreateTable
CREATE TABLE `metricas_atendimento_dia` (
    `id` VARCHAR(191) NOT NULL,
    `numero_id` VARCHAR(191) NOT NULL,
    `dia` DATE NOT NULL,
    `time` ENUM('cs', 'paciente_modelo', 'comercial', 'outro') NOT NULL,
    `conversas_com_cliente` INTEGER NOT NULL,
    `primeiras_respostas_seg` JSON NOT NULL,
    `respostas_seg` JSON NOT NULL,
    `respostas_no_sla` INTEGER NOT NULL,
    `sem_resposta` INTEGER NOT NULL,
    `followups_feitos` INTEGER NOT NULL,
    `followups_perdidos` INTEGER NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `metricas_atendimento_dia_dia_idx`(`dia`),
    UNIQUE INDEX `metricas_atendimento_dia_numero_id_dia_key`(`numero_id`, `dia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `metricas_atendimento_dia` ADD CONSTRAINT `metricas_atendimento_dia_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

