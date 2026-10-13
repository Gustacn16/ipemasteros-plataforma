-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `email_verificado` BOOLEAN NOT NULL DEFAULT false,
    `imagem` VARCHAR(500) NULL,
    `papel` ENUM('admin', 'gestor', 'colaborador', 'professor', 'aluno') NOT NULL DEFAULT 'colaborador',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_acesso_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessoes` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessoes_token_key`(`token`),
    INDEX `sessoes_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contas` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NOT NULL,
    `conta_id` VARCHAR(191) NOT NULL,
    `provedor_id` VARCHAR(50) NOT NULL,
    `access_token` TEXT NULL,
    `refresh_token` TEXT NULL,
    `id_token` TEXT NULL,
    `access_token_expira_em` DATETIME(3) NULL,
    `refresh_token_expira_em` DATETIME(3) NULL,
    `scope` TEXT NULL,
    `senha_hash` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `contas_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `verificacoes` (
    `id` VARCHAR(191) NOT NULL,
    `identificador` VARCHAR(191) NOT NULL,
    `valor` TEXT NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `verificacoes_identificador_idx`(`identificador`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convites` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `papel` ENUM('admin', 'gestor', 'colaborador', 'professor', 'aluno') NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `aceito_em` DATETIME(3) NULL,
    `revogado_em` DATETIME(3) NULL,
    `convidado_por_id` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `convites_token_hash_key`(`token_hash`),
    INDEX `convites_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `logs_auditoria` (
    `id` VARCHAR(191) NOT NULL,
    `usuario_id` VARCHAR(191) NULL,
    `acao` VARCHAR(100) NOT NULL,
    `entidade` VARCHAR(50) NOT NULL,
    `entidade_id` VARCHAR(191) NULL,
    `diff` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `logs_auditoria_usuario_id_criado_em_idx`(`usuario_id`, `criado_em`),
    INDEX `logs_auditoria_entidade_entidade_id_idx`(`entidade`, `entidade_id`),
    INDEX `logs_auditoria_acao_criado_em_idx`(`acao`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitacoes_titular` (
    `id` VARCHAR(191) NOT NULL,
    `tipo` ENUM('acesso', 'correcao', 'anonimizacao', 'portabilidade') NOT NULL,
    `titular_tipo` VARCHAR(30) NOT NULL,
    `titular_id` VARCHAR(191) NULL,
    `titular_nome` VARCHAR(150) NOT NULL,
    `titular_email` VARCHAR(191) NOT NULL,
    `status` ENUM('aberta', 'em_atendimento', 'concluida', 'recusada') NOT NULL DEFAULT 'aberta',
    `prazo_em` DATETIME(3) NOT NULL,
    `atendido_por_id` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessoes` ADD CONSTRAINT `sessoes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contas` ADD CONSTRAINT `contas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `convites` ADD CONSTRAINT `convites_convidado_por_id_fkey` FOREIGN KEY (`convidado_por_id`) REFERENCES `usuarios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `logs_auditoria` ADD CONSTRAINT `logs_auditoria_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

