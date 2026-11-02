-- CreateTable
CREATE TABLE `tipos_evento` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(40) NOT NULL,
    `cor` VARCHAR(7) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tipos_evento_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_institucionais` (
    `id` VARCHAR(191) NOT NULL,
    `tipo_id` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `turma` VARCHAR(100) NULL,
    `local` VARCHAR(150) NULL,
    `descricao` TEXT NULL,
    `data_inicio` DATE NOT NULL,
    `data_fim` DATE NOT NULL,
    `hora_inicio` CHAR(5) NULL,
    `hora_fim` CHAR(5) NULL,
    `visivel_professores` BOOLEAN NOT NULL DEFAULT false,
    `lote_id` VARCHAR(191) NULL,
    `criado_por_id` VARCHAR(191) NOT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `eventos_institucionais_data_inicio_data_fim_idx`(`data_inicio`, `data_fim`),
    INDEX `eventos_institucionais_lote_id_idx`(`lote_id`),
    INDEX `eventos_institucionais_tipo_id_idx`(`tipo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `eventos_institucionais` ADD CONSTRAINT `eventos_institucionais_tipo_id_fkey` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_evento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `eventos_institucionais` ADD CONSTRAINT `eventos_institucionais_criado_por_id_fkey` FOREIGN KEY (`criado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Semente dos tipos de evento (o seed não roda na homologação)
INSERT INTO `tipos_evento` (`id`, `nome`, `cor`, `ordem`, `ativo`, `criado_em`, `atualizado_em`) VALUES
    ('tipo_aulas_pos', 'Aulas da pós', '#5F45F4', 1, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('tipo_evento', 'Evento', '#0EA5E9', 2, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('tipo_formatura', 'Formatura', '#F59E0B', 3, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('tipo_feriado', 'Feriado/Recesso', '#EF4444', 4, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('tipo_reuniao', 'Reunião interna', '#64748B', 5, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
