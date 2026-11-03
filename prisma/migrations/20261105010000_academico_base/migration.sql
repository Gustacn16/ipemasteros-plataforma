-- CreateTable
CREATE TABLE `turmas` (
    `id` VARCHAR(191) NOT NULL,
    `produto_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `ciclica` BOOLEAN NOT NULL DEFAULT false,
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `situacao` ENUM('planejada', 'em_andamento', 'concluida', 'cancelada') NOT NULL DEFAULT 'planejada',
    `observacoes` TEXT NULL,
    `excluido_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `turmas_produto_id_idx`(`produto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alunos` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `nome_busca` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NULL,
    `telefone` VARCHAR(20) NULL,
    `crm` VARCHAR(20) NULL,
    `crm_uf` CHAR(2) NULL,
    `observacoes` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `alunos_nome_busca_idx`(`nome_busca`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `matriculas` (
    `id` VARCHAR(191) NOT NULL,
    `aluno_id` VARCHAR(191) NOT NULL,
    `turma_id` VARCHAR(191) NOT NULL,
    `situacao` ENUM('ativa', 'trancada', 'concluida', 'cancelada') NOT NULL DEFAULT 'ativa',
    `data_inicio` DATE NULL,
    `data_formatura` DATE NULL,
    `vigencia` VARCHAR(40) NULL,
    `plano` VARCHAR(255) NULL,
    `observacoes` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `matriculas_turma_id_situacao_idx`(`turma_id`, `situacao`),
    UNIQUE INDEX `matriculas_aluno_id_turma_id_key`(`aluno_id`, `turma_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `professores` (
    `id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(150) NOT NULL,
    `email` VARCHAR(150) NULL,
    `telefone` VARCHAR(20) NULL,
    `crm` VARCHAR(20) NULL,
    `crm_uf` CHAR(2) NULL,
    `especialidade` VARCHAR(120) NULL,
    `mini_curriculo` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `turmas` ADD CONSTRAINT `turmas_produto_id_fkey` FOREIGN KEY (`produto_id`) REFERENCES `produtos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_aluno_id_fkey` FOREIGN KEY (`aluno_id`) REFERENCES `alunos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matriculas` ADD CONSTRAINT `matriculas_turma_id_fkey` FOREIGN KEY (`turma_id`) REFERENCES `turmas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

