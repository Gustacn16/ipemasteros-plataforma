-- Venda: próximos passos (abaixo das observações).
ALTER TABLE `vendas` ADD COLUMN `proximos_passos` TEXT NULL;

-- Canais de venda novos. INSERT IGNORE: se alguém já criou com o mesmo nome, fica o que existe.
INSERT IGNORE INTO `canais_venda` (`id`, `nome`, `ativo`, `ordem`, `atualizado_em`)
SELECT 'canal_meta_ads', 'Meta Ads', true, COALESCE(MAX(`ordem`), 0) + 1, CURRENT_TIMESTAMP(3) FROM `canais_venda`;
INSERT IGNORE INTO `canais_venda` (`id`, `nome`, `ativo`, `ordem`, `atualizado_em`)
SELECT 'canal_google_ads', 'Google Ads', true, COALESCE(MAX(`ordem`), 0) + 1, CURRENT_TIMESTAMP(3) FROM `canais_venda`;

-- Metas passam a ser só quantidade: valor = quantidade × preço cheio da oferta padrão (sem padrão, a primeira oferta).
-- Recalcula a partir de novembro de 2026; meses anteriores e metas sem quantidade ficam como estão.
UPDATE `metas_venda` m
JOIN (
  SELECT o.`produto_id`,
    COALESCE(
      MAX(CASE WHEN o.`padrao` THEN o.`preco_cheio` END),
      (SELECT o2.`preco_cheio` FROM `ofertas_produto` o2 WHERE o2.`produto_id` = o.`produto_id` ORDER BY o2.`ordem` LIMIT 1)
    ) AS `preco`
  FROM `ofertas_produto` o
  GROUP BY o.`produto_id`
) p ON p.`produto_id` = m.`produto_id`
SET m.`valor_alvo` = ROUND(m.`quantidade_alvo` * p.`preco`, 2)
WHERE m.`quantidade_alvo` > 0 AND m.`mes` >= '2026-11-01';
