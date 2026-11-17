-- CreateTable
CREATE TABLE `contatos_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `telefone` VARCHAR(20) NULL,
    `lid` VARCHAR(40) NULL,
    `nome_exibido` VARCHAR(100) NULL,
    `aluno_id` VARCHAR(191) NULL,
    `usuario_id` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `contatos_whatsapp_telefone_key`(`telefone`),
    UNIQUE INDEX `contatos_whatsapp_lid_key`(`lid`),
    INDEX `contatos_whatsapp_aluno_id_idx`(`aluno_id`),
    INDEX `contatos_whatsapp_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversas_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `jid` VARCHAR(60) NOT NULL,
    `tipo` ENUM('grupo', 'individual') NOT NULL,
    `numero_id` VARCHAR(191) NULL,
    `nome` VARCHAR(120) NULL,
    `contato_id` VARCHAR(191) NULL,
    `turma_id` VARCHAR(191) NULL,
    `numero_envio_id` VARCHAR(191) NULL,
    `categoria` ENUM('aluno', 'lead', 'equipe', 'pessoal', 'outro') NOT NULL DEFAULT 'outro',
    `monitorada` BOOLEAN NOT NULL DEFAULT false,
    `provisoria_ate` DATETIME(3) NULL,
    `ultima_mensagem_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `conversas_whatsapp_tipo_monitorada_idx`(`tipo`, `monitorada`),
    INDEX `conversas_whatsapp_jid_idx`(`jid`),
    UNIQUE INDEX `conversas_whatsapp_numero_id_jid_key`(`numero_id`, `jid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `numeros_no_grupo` (
    `numero_id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`numero_id`, `conversa_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens_whatsapp` (
    `id` VARCHAR(191) NOT NULL,
    `conversa_id` VARCHAR(191) NOT NULL,
    `id_externo` VARCHAR(100) NOT NULL,
    `numero_id` VARCHAR(191) NOT NULL,
    `contato_id` VARCHAR(191) NULL,
    `de_mim` BOOLEAN NOT NULL,
    `tipo` ENUM('texto', 'imagem', 'audio', 'video', 'documento', 'figurinha', 'outro') NOT NULL,
    `texto` TEXT NULL,
    `responde_a_id_externo` VARCHAR(100) NULL,
    `enviada_em` DATETIME(3) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mensagens_whatsapp_conversa_id_enviada_em_idx`(`conversa_id`, `enviada_em`),
    INDEX `mensagens_whatsapp_enviada_em_idx`(`enviada_em`),
    UNIQUE INDEX `mensagens_whatsapp_conversa_id_id_externo_key`(`conversa_id`, `id_externo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contatos_whatsapp` ADD CONSTRAINT `contatos_whatsapp_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `alunos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contatos_whatsapp` ADD CONSTRAINT `contatos_whatsapp_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversas_whatsapp` ADD CONSTRAINT `conversas_whatsapp_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversas_whatsapp` ADD CONSTRAINT `conversas_whatsapp_contato_id_fkey` FOREIGN KEY (`contato_id`) REFERENCES `contatos_whatsapp`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversas_whatsapp` ADD CONSTRAINT `conversas_whatsapp_turma_id_fkey` FOREIGN KEY (`turma_id`) REFERENCES `turmas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `numeros_no_grupo` ADD CONSTRAINT `numeros_no_grupo_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `numeros_no_grupo` ADD CONSTRAINT `numeros_no_grupo_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_whatsapp` ADD CONSTRAINT `mensagens_whatsapp_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `conversas_whatsapp`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_whatsapp` ADD CONSTRAINT `mensagens_whatsapp_numero_id_fkey` FOREIGN KEY (`numero_id`) REFERENCES `numeros_whatsapp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens_whatsapp` ADD CONSTRAINT `mensagens_whatsapp_contato_id_fkey` FOREIGN KEY (`contato_id`) REFERENCES `contatos_whatsapp`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

