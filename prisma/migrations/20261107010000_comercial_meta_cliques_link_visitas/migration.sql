-- AlterTable
ALTER TABLE `metricas_diarias_anuncio` ADD COLUMN `cliques_link` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `visitas_perfil` INTEGER NOT NULL DEFAULT 0;


-- Os números novos valem para o histórico: cada conta busca de novo desde 2026-01-01 na próxima importação.
UPDATE `contas_anuncio` SET `historico_completo_em` = NULL;
