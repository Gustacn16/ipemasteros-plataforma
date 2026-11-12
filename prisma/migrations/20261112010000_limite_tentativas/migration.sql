-- CreateTable
CREATE TABLE `limites_tentativas` (
    `chave` CHAR(64) NOT NULL,
    `contagem` INTEGER NOT NULL,
    `inicio_janela` DATETIME(3) NOT NULL,

    INDEX `limites_tentativas_inicio_janela_idx`(`inicio_janela`),
    PRIMARY KEY (`chave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
