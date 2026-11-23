-- DropForeignKey
ALTER TABLE `indicadores_processo` DROP FOREIGN KEY `indicadores_processo_documento_id_fkey`;

-- DropForeignKey
ALTER TABLE `indicadores_processo` DROP FOREIGN KEY `indicadores_processo_responsavel_id_fkey`;

-- DropForeignKey
ALTER TABLE `medicoes_indicador` DROP FOREIGN KEY `medicoes_indicador_indicador_id_fkey`;

-- DropForeignKey
ALTER TABLE `medicoes_indicador` DROP FOREIGN KEY `medicoes_indicador_registrado_por_id_fkey`;

-- DropTable
DROP TABLE `indicadores_processo`;

-- DropTable
DROP TABLE `medicoes_indicador`;

