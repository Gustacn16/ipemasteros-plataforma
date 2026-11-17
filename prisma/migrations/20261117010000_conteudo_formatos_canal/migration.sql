-- Formatos por canal (ex.: YouTube → Avulso, Entrevista, Vlog). O formato antigo (enum) fica opcional e não é mais gravado.

-- AlterTable
ALTER TABLE `conteudos` ADD COLUMN `formato_id` VARCHAR(191) NULL,
    MODIFY `formato` ENUM('reels', 'carrossel', 'post', 'story', 'video', 'short', 'live', 'newsletter', 'artigo', 'outro') NULL;

-- CreateTable
CREATE TABLE `formatos_canal` (
    `id` VARCHAR(191) NOT NULL,
    `canal_id` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(60) NOT NULL,
    `ordem` INTEGER NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `formatos_canal_canal_id_nome_key`(`canal_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `conteudos_formato_id_idx` ON `conteudos`(`formato_id`);

-- AddForeignKey
ALTER TABLE `formatos_canal` ADD CONSTRAINT `formatos_canal_canal_id_fkey` FOREIGN KEY (`canal_id`) REFERENCES `canais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conteudos` ADD CONSTRAINT `conteudos_formato_id_fkey` FOREIGN KEY (`formato_id`) REFERENCES `formatos_canal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Dados: formatos iniciais de cada canal, pela plataforma (mesma lista de regras/formatos.ts).
INSERT INTO `formatos_canal` (`id`, `canal_id`, `nome`, `ordem`, `ativo`, `criado_em`, `atualizado_em`)
SELECT REPLACE(UUID(), '-', ''), c.`id`, d.`nome`, d.`ordem`, true, NOW(3), NOW(3)
FROM `canais` c
JOIN (
  SELECT 'instagram' AS plataforma, 'Reels' AS nome, 1 AS ordem
  UNION ALL SELECT 'instagram', 'Carrossel', 2
  UNION ALL SELECT 'instagram', 'Post', 3
  UNION ALL SELECT 'instagram', 'Story', 4
  UNION ALL SELECT 'instagram', 'Live', 5
  UNION ALL SELECT 'youtube', 'Vídeo', 1
  UNION ALL SELECT 'youtube', 'Short', 2
  UNION ALL SELECT 'youtube', 'Live', 3
  UNION ALL SELECT 'tiktok', 'Vídeo', 1
  UNION ALL SELECT 'tiktok', 'Live', 2
  UNION ALL SELECT 'facebook', 'Post', 1
  UNION ALL SELECT 'facebook', 'Vídeo', 2
  UNION ALL SELECT 'facebook', 'Reels', 3
  UNION ALL SELECT 'linkedin', 'Post', 1
  UNION ALL SELECT 'linkedin', 'Artigo', 2
  UNION ALL SELECT 'linkedin', 'Vídeo', 3
  UNION ALL SELECT 'newsletter', 'Newsletter', 1
  UNION ALL SELECT 'blog', 'Artigo', 1
  UNION ALL SELECT 'podcast', 'Episódio', 1
  UNION ALL SELECT 'outro', 'Outro', 1
) d ON d.`plataforma` = c.`plataforma`;

-- Dados: canal principal de cada conteúdo = a primeira publicação, pela ordem do canal.
CREATE TEMPORARY TABLE `tmp_canal_principal` AS
SELECT p.`conteudo_id`,
  (SELECT p2.`canal_id` FROM `publicacoes` p2 JOIN `canais` c2 ON c2.`id` = p2.`canal_id`
   WHERE p2.`conteudo_id` = p.`conteudo_id` ORDER BY c2.`ordem`, p2.`criado_em` LIMIT 1) AS `canal_id`
FROM `publicacoes` p
GROUP BY p.`conteudo_id`;

CREATE TEMPORARY TABLE `tmp_rotulo_formato` (`formato` VARCHAR(20) NOT NULL, `nome` VARCHAR(60) NOT NULL) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `tmp_rotulo_formato` VALUES
  ('reels', 'Reels'), ('carrossel', 'Carrossel'), ('post', 'Post'), ('story', 'Story'), ('video', 'Vídeo'),
  ('short', 'Short'), ('live', 'Live'), ('newsletter', 'Newsletter'), ('artigo', 'Artigo'), ('outro', 'Outro');

-- O formato antigo que o canal principal ainda não tem é criado no fim da lista.
INSERT IGNORE INTO `formatos_canal` (`id`, `canal_id`, `nome`, `ordem`, `ativo`, `criado_em`, `atualizado_em`)
SELECT REPLACE(UUID(), '-', ''), x.`canal_id`, x.`nome`, 100, true, NOW(3), NOW(3)
FROM (
  SELECT DISTINCT cp.`canal_id`, r.`nome`
  FROM `conteudos` ct
  JOIN `tmp_canal_principal` cp ON cp.`conteudo_id` = ct.`id`
  JOIN `tmp_rotulo_formato` r ON r.`formato` = ct.`formato`
) x;

UPDATE `conteudos` ct
JOIN `tmp_canal_principal` cp ON cp.`conteudo_id` = ct.`id`
JOIN `tmp_rotulo_formato` r ON r.`formato` = ct.`formato`
JOIN `formatos_canal` f ON f.`canal_id` = cp.`canal_id` AND f.`nome` = r.`nome`
SET ct.`formato_id` = f.`id`;

DROP TEMPORARY TABLE `tmp_canal_principal`;
DROP TEMPORARY TABLE `tmp_rotulo_formato`;
