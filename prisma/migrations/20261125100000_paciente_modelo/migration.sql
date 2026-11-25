-- Indicador "Pacientes modelo" nos planos que já existem (os novos já nascem com ele).
INSERT INTO `indicadores_plano` (`id`, `plano_id`, `frente`, `grupo`, `nome`, `unidade`, `sentido`, `tipo`, `fonte`, `no_painel`, `ordem`, `criado_em`, `atualizado_em`)
SELECT UUID(), p.`id`, 'comercial', 'Pacientes modelo', 'Pacientes modelo', 'numero', 'maior_melhor', 'fluxo', 'manual', true,
       COALESCE((SELECT MAX(i.`ordem`) + 1 FROM `indicadores_plano` i WHERE i.`plano_id` = p.`id` AND i.`frente` = 'comercial'), 0),
       NOW(3), NOW(3)
FROM `planos_anuais` p
WHERE NOT EXISTS (
  SELECT 1 FROM `indicadores_plano` i WHERE i.`plano_id` = p.`id` AND i.`nome` = 'Pacientes modelo' AND i.`excluido_em` IS NULL
);
