-- CreateTable
CREATE TABLE `avaliacoes_conversa` (
    `id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `numero_id` VARCHAR(191) NOT NULL,
    `dia` DATE NOT NULL,
    `time` ENUM('cs', 'paciente_modelo', 'comercial', 'outro') NOT NULL,
    `lote_id` VARCHAR(191) NULL,
    `situacao` ENUM('pendente', 'pronto', 'falhou') NOT NULL DEFAULT 'pendente',
    `erro` VARCHAR(255) NULL,
    `modelo` VARCHAR(60) NOT NULL,
    `situacao_lead` ENUM('novo', 'qualificando', 'interessado', 'objecao', 'negociando', 'sem_retorno', 'fechou', 'perdido') NULL,
    `temperatura` ENUM('quente', 'morno', 'frio') NULL,
    `motivo_temperatura` TEXT NULL,
    `o_que_respondeu` TEXT NULL,
    `proximo_passo` TEXT NULL,
    `criterios` JSON NULL,
    `nota_tempo` INTEGER NULL,
    `nota_geral_decimos` INTEGER NULL,
    `pontos_fortes` TEXT NULL,
    `melhorar` TEXT NULL,
    `venda_id` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `avaliacoes_conversa_dia_idx`(`dia`),
    INDEX `avaliacoes_conversa_numero_id_dia_idx`(`numero_id`, `dia`),
    UNIQUE INDEX `avaliacoes_conversa_conversa_id_dia_key`(`conversa_id`, `dia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `avaliacoes_conversa` ADD CONSTRAINT `avaliacoes_conversa_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes_conversa` ADD CONSTRAINT `avaliacoes_conversa_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes_conversa` ADD CONSTRAINT `avaliacoes_conversa_lote_id_fkey` FOREIGN KEY (`lote_id`) REFERENCES `lotes_ia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `avaliacoes_conversa` ADD CONSTRAINT `avaliacoes_conversa_venda_id_fkey` FOREIGN KEY (`venda_id`) REFERENCES `vendas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

