-- Carga do calendário de aulas (dados do calendário institucional, sem dados pessoais).
-- Origem: calendários da Pós em Tricologia e Transplante Capilar (Turma 3 e Cíclica 2026,
-- Turma 4 2026/2–2027/1, Turma 5 2027) e matriz da Pós em Psiquiatria Clínica (out/2026–out/2027).
-- Todos ficam visíveis para professores e podem ser editados ou excluídos na Agenda.
-- O autor é o primeiro admin cadastrado; sem admin, nada é inserido.
INSERT INTO `eventos_institucionais`
  (`id`, `tipo_id`, `titulo`, `turma`, `local`, `descricao`, `data_inicio`, `data_fim`, `hora_inicio`, `hora_fim`,
   `visivel_professores`, `lote_id`, `criado_por_id`, `criado_em`, `atualizado_em`)
SELECT v.id, v.tipo_id, v.titulo, v.turma, v.local_, v.descricao, v.data_inicio, v.data_fim, v.hora_inicio, v.hora_fim,
       true, v.lote_id, u.id, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT 'aula_001' AS id, 'tipo_aulas_pos' AS tipo_id, 'Centro cirúrgico (André Rosique)' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, 'Antecipado para janeiro por causa do Carnaval.' AS descricao, '2026-01-30' AS data_inicio, '2026-02-01' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_002' AS id, 'tipo_aulas_pos' AS tipo_id, 'Semana cirúrgica' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-02-02' AS data_inicio, '2026-02-06' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_003' AS id, 'tipo_aulas_pos' AS tipo_id, 'Ambulatório — procedimentos' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2026-03-13' AS data_inicio, '2026-03-15' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_004' AS id, 'tipo_aulas_pos' AS tipo_id, 'Centro cirúrgico (André Rosique)' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-04-10' AS data_inicio, '2026-04-12' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_005' AS id, 'tipo_aulas_pos' AS tipo_id, 'Semana cirúrgica' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-04-13' AS data_inicio, '2026-04-17' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_006' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Alopecia androgenética' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-05-08' AS data_inicio, '2026-05-08' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_007' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento e TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-05-09' AS data_inicio, '2026-05-10' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_008' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de TX de sobrancelha' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-06-12' AS data_inicio, '2026-06-12' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_009' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento e TX de sobrancelha' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-06-13' AS data_inicio, '2026-06-14' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_010' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de Terapia regenerativa' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-08-07' AS data_inicio, '2026-08-07' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_011' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento e TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-08-08' AS data_inicio, '2026-08-09' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_012' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Eflúvio telógeno' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-09-11' AS data_inicio, '2026-09-11' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_013' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento e TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-09-12' AS data_inicio, '2026-09-13' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_014' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Meu protocolo Trico e TX' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-11-13' AS data_inicio, '2026-11-13' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_015' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento e TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-11-14' AS data_inicio, '2026-11-15' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_016' AS id, 'tipo_aulas_pos' AS tipo_id, 'Semana cirúrgica — acompanhamento' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-06-15' AS data_inicio, '2026-06-17' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_017' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Alopecia de tração' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-10-09' AS data_inicio, '2026-10-09' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_018' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2026-10-10' AS data_inicio, '2026-10-10' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_019' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-10-11' AS data_inicio, '2026-10-11' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_020' AS id, 'tipo_aulas_pos' AS tipo_id, 'Fellow' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-12-11' AS data_inicio, '2026-12-11' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_021' AS id, 'tipo_formatura' AS tipo_id, 'Formatura — todos os alunos' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, NULL AS local_, NULL AS descricao, '2026-12-12' AS data_inicio, '2026-12-12' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_022' AS id, 'tipo_aulas_pos' AS tipo_id, 'Prática: TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 3 e Cíclica' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2026-12-13' AS data_inicio, '2026-12-13' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_tc_t3' AS lote_id
  UNION ALL
  SELECT 'aula_023' AS id, 'tipo_aulas_pos' AS tipo_id, 'IPEMaster Day — Aula inaugural' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-08-28' AS data_inicio, '2026-08-28' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_024' AS id, 'tipo_aulas_pos' AS tipo_id, 'Base da tricologia (aula teórica)' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-08-29' AS data_inicio, '2026-08-29' AS data_fim, '08:00' AS hora_inicio, '12:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_025' AS id, 'tipo_aulas_pos' AS tipo_id, 'Avaliação, tricoscopia e intervenções capilares' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2026-08-29' AS data_inicio, '2026-08-29' AS data_fim, '13:30' AS hora_inicio, '18:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_026' AS id, 'tipo_aulas_pos' AS tipo_id, 'Avaliação, tricoscopia e intervenções capilares' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2026-08-30' AS data_inicio, '2026-08-30' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_027' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Do zero ao transplante capilar' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-09-25' AS data_inicio, '2026-09-25' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_028' AS id, 'tipo_aulas_pos' AS tipo_id, 'Anamnese, desenho capilar e perioperatório' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-09-26' AS data_inicio, '2026-09-26' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_029' AS id, 'tipo_aulas_pos' AS tipo_id, 'Simulação realística em explante e transplante do fio' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-09-27' AS data_inicio, '2026-09-27' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_030' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de alopecias cicatricial e não cicatricial' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-10-16' AS data_inicio, '2026-10-16' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_031' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-10-17' AS data_inicio, '2026-10-17' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_032' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-10-18' AS data_inicio, '2026-10-18' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_033' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Alopecia androgenética' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-11-27' AS data_inicio, '2026-11-27' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_034' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-11-28' AS data_inicio, '2026-11-28' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_035' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-11-29' AS data_inicio, '2026-11-29' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_036' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Eflúvio telógeno e alopecia por tração' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2026-12-18' AS data_inicio, '2026-12-18' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_037' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-12-19' AS data_inicio, '2026-12-19' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_038' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2026-12-20' AS data_inicio, '2026-12-20' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_039' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Alopecia não cicatricial' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, 'No PDF está "Sexta 23", mas 23/01/2027 é sábado; lançado na sexta 22. Confirmar.' AS descricao, '2027-01-22' AS data_inicio, '2027-01-22' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_040' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, 'No PDF está "Sexta 23", mas 23/01/2027 é sábado; lançado na sexta 22. Confirmar.' AS descricao, '2027-01-23' AS data_inicio, '2027-01-23' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_041' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, 'No PDF está "Sexta 23", mas 23/01/2027 é sábado; lançado na sexta 22. Confirmar.' AS descricao, '2027-01-24' AS data_inicio, '2027-01-24' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_042' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de Terapia regenerativa' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2027-02-19' AS data_inicio, '2027-02-19' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_043' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-02-20' AS data_inicio, '2027-02-20' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_044' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-02-21' AS data_inicio, '2027-02-21' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_045' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Meu protocolo de Transplante capilar' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2027-03-19' AS data_inicio, '2027-03-19' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_046' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-03-20' AS data_inicio, '2027-03-20' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_047' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-03-21' AS data_inicio, '2027-03-21' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_048' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Transplante de sobrancelhas' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2027-04-23' AS data_inicio, '2027-04-23' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_049' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-04-24' AS data_inicio, '2027-04-24' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_050' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-04-25' AS data_inicio, '2027-04-25' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_051' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Quando houver complicações, o que fazer?' AS titulo, 'Transplante Capilar — Turma 4' AS turma, NULL AS local_, NULL AS descricao, '2027-05-21' AS data_inicio, '2027-05-21' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_052' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-05-22' AS data_inicio, '2027-05-22' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_053' AS id, 'tipo_aulas_pos' AS tipo_id, 'TX capilar - couro cabeludo' AS titulo, 'Transplante Capilar — Turma 4' AS turma, 'Ambulatório / Centro cirúrgico' AS local_, NULL AS descricao, '2027-05-23' AS data_inicio, '2027-05-23' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t4' AS lote_id
  UNION ALL
  SELECT 'aula_054' AS id, 'tipo_aulas_pos' AS tipo_id, 'IPEMaster Day — Aula inaugural' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-01-29' AS data_inicio, '2027-01-29' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_055' AS id, 'tipo_aulas_pos' AS tipo_id, 'Base da tricologia (aula teórica)' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-01-30' AS data_inicio, '2027-01-30' AS data_fim, '08:00' AS hora_inicio, '12:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_056' AS id, 'tipo_aulas_pos' AS tipo_id, 'Avaliação, tricoscopia e intervenções capilares' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-01-30' AS data_inicio, '2027-01-30' AS data_fim, '13:30' AS hora_inicio, '18:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_057' AS id, 'tipo_aulas_pos' AS tipo_id, 'Avaliação, tricoscopia e intervenções capilares' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-01-31' AS data_inicio, '2027-01-31' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_058' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Do zero ao transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-02-26' AS data_inicio, '2027-02-26' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_059' AS id, 'tipo_aulas_pos' AS tipo_id, 'Simulação realística em explante e transplante do fio' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-02-27' AS data_inicio, '2027-02-27' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_060' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-02-28' AS data_inicio, '2027-02-28' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_061' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de alopecias cicatricial e não cicatricial' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-03-26' AS data_inicio, '2027-03-26' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_062' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-03-27' AS data_inicio, '2027-03-27' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_063' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-03-28' AS data_inicio, '2027-03-28' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_064' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Alopecia androgenética' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-04-30' AS data_inicio, '2027-04-30' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_065' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-05-01' AS data_inicio, '2027-05-01' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_066' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-05-02' AS data_inicio, '2027-05-02' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_067' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: ANC - Eflúvio telógeno e alopecia por tração' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-05-28' AS data_inicio, '2027-05-28' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_068' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-05-29' AS data_inicio, '2027-05-29' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_069' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-05-30' AS data_inicio, '2027-05-30' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_070' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Alopecia não cicatricial' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-06-25' AS data_inicio, '2027-06-25' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_071' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-06-26' AS data_inicio, '2027-06-26' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_072' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-06-27' AS data_inicio, '2027-06-27' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_073' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Conceito de Terapia regenerativa' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-08-13' AS data_inicio, '2027-08-13' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_074' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-08-14' AS data_inicio, '2027-08-14' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_075' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-08-15' AS data_inicio, '2027-08-15' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_076' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Meu protocolo de Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-09-10' AS data_inicio, '2027-09-10' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_077' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-09-11' AS data_inicio, '2027-09-11' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_078' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-09-12' AS data_inicio, '2027-09-12' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_079' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Transplante de sobrancelhas' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-10-15' AS data_inicio, '2027-10-15' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_080' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-10-16' AS data_inicio, '2027-10-16' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_081' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-10-17' AS data_inicio, '2027-10-17' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_082' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula teórica: Quando houver complicações, o que fazer?' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-11-12' AS data_inicio, '2027-11-12' AS data_fim, '19:00' AS hora_inicio, '22:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_083' AS id, 'tipo_aulas_pos' AS tipo_id, 'Consulta/diagnóstico/tratamento' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Ambulatório' AS local_, NULL AS descricao, '2027-11-13' AS data_inicio, '2027-11-13' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_084' AS id, 'tipo_aulas_pos' AS tipo_id, 'Transplante capilar' AS titulo, 'Transplante Capilar — Turma 5' AS turma, 'Centro cirúrgico' AS local_, NULL AS descricao, '2027-11-14' AS data_inicio, '2027-11-14' AS data_fim, '07:00' AS hora_inicio, '20:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_085' AS id, 'tipo_aulas_pos' AS tipo_id, 'Fellow na Master Capilar (prático)' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-12-02' AS data_inicio, '2027-12-03' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_086' AS id, 'tipo_aulas_pos' AS tipo_id, 'Imersão de negócios (aulas teóricas)' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, NULL AS descricao, '2027-12-04' AS data_inicio, '2027-12-04' AS data_fim, '08:00' AS hora_inicio, '17:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_087' AS id, 'tipo_formatura' AS tipo_id, 'Formatura' AS titulo, 'Transplante Capilar — Turma 5' AS turma, NULL AS local_, 'Horário de término a confirmar (no calendário: a partir das 19:00).' AS descricao, '2027-12-04' AS data_inicio, '2027-12-04' AS data_fim, '19:00' AS hora_inicio, '23:00' AS hora_fim, 'lote_tc_t5' AS lote_id
  UNION ALL
  SELECT 'aula_088' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 01 — M1: Normalidade em Psiquiatria e Psicofarmacologia I (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2026-10-15' AS data_inicio, '2026-10-15' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_089' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 02 — M1: Normalidade em Psiquiatria e Psicofarmacologia I (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2026-10-29' AS data_inicio, '2026-10-29' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_090' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 03 — M2: História da Psiquiatria, Entrevista Psiquiátrica e Psicopatologia Geral (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2026-11-12' AS data_inicio, '2026-11-12' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_091' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 04 — M2: História da Psiquiatria, Entrevista Psiquiátrica e Psicopatologia Geral (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2026-11-26' AS data_inicio, '2026-11-26' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_092' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 05 — M3: Psicopatologia dos Transtornos Psicóticos e Psicofarmacologia II (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2026-12-10' AS data_inicio, '2026-12-10' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_093' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 06 — M3: Psicopatologia dos Transtornos Psicóticos e Psicofarmacologia II (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, 'Véspera de Natal — sujeito a reagendamento.' AS descricao, '2026-12-24' AS data_inicio, '2026-12-24' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_094' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 07 — M4: Transtornos de Humor (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-01-07' AS data_inicio, '2027-01-07' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_095' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 08 — M4: Transtornos de Humor (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-01-21' AS data_inicio, '2027-01-21' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_096' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 09 — M5: Transtornos de Ansiedade e TOC (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-02-04' AS data_inicio, '2027-02-04' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_097' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 10 — M5: Transtornos de Ansiedade e TOC (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-02-18' AS data_inicio, '2027-02-18' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_098' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 11 — M6: Transtornos Psicóticos e Emergências Psiquiátricas (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-03-04' AS data_inicio, '2027-03-04' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_099' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 12 — M6: Transtornos Psicóticos e Emergências Psiquiátricas (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-03-18' AS data_inicio, '2027-03-18' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_100' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 13 — M7: Transtornos de Sintomas Somáticos e Dor Crônica (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-04-01' AS data_inicio, '2027-04-01' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_101' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 14 — M7: Transtornos de Sintomas Somáticos e Dor Crônica (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-04-15' AS data_inicio, '2027-04-15' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_102' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 15 — M8: Transtornos de Personalidade (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-04-29' AS data_inicio, '2027-04-29' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_103' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 16 — M8: Transtornos de Personalidade (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-05-13' AS data_inicio, '2027-05-13' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_104' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 17 — M9: Transtornos de Controle dos Impulsos, Alimentares e Uso de Substâncias (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-05-27' AS data_inicio, '2027-05-27' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_105' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 18 — M9: Transtornos de Controle dos Impulsos, Alimentares e Uso de Substâncias (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-06-10' AS data_inicio, '2027-06-10' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_106' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 19 — M10: Psiquiatria da Infância e Adolescência (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, 'Corpus Christi (24/06): aula remarcada para sexta 25/06.' AS descricao, '2027-06-25' AS data_inicio, '2027-06-25' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_107' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 20 — M10: Psiquiatria da Infância e Adolescência (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-07-08' AS data_inicio, '2027-07-08' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_108' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 21 — M11: Psicogeriatria e Demências (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-07-22' AS data_inicio, '2027-07-22' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_109' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 22 — M11: Psicogeriatria e Demências (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-08-05' AS data_inicio, '2027-08-05' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_110' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 23 — M12: Psicoterapias em Psiquiatria e Psiquiatria Forense (1/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-08-19' AS data_inicio, '2027-08-19' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_111' AS id, 'tipo_aulas_pos' AS tipo_id, 'Aula ao vivo 24 — M12: Psicoterapias em Psiquiatria e Psiquiatria Forense (2/2)' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online (ao vivo e gravada)' AS local_, NULL AS descricao, '2027-09-02' AS data_inicio, '2027-09-02' AS data_fim, '19:00' AS hora_inicio, '22:30' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_112' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 1' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2026-10-17' AS data_inicio, '2026-10-17' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_113' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 2' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2026-11-21' AS data_inicio, '2026-11-21' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_114' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 3' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2026-12-19' AS data_inicio, '2026-12-19' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_115' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 4' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-01-09' AS data_inicio, '2027-01-09' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_116' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 5' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-02-20' AS data_inicio, '2027-02-20' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_117' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 6' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-03-20' AS data_inicio, '2027-03-20' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_118' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 7' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-04-10' AS data_inicio, '2027-04-10' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_119' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 8' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-05-15' AS data_inicio, '2027-05-15' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_120' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 9' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-06-19' AS data_inicio, '2027-06-19' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_121' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 10' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-07-10' AS data_inicio, '2027-07-10' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_122' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 11' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-08-21' AS data_inicio, '2027-08-21' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_123' AS id, 'tipo_aulas_pos' AS tipo_id, 'Teleambulatório — Módulo 12' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Online' AS local_, 'Ambos os planos (EAD e Híbrido).' AS descricao, '2027-09-18' AS data_inicio, '2027-09-18' AS data_fim, '08:00' AS hora_inicio, '18:00' AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_124' AS id, 'tipo_aulas_pos' AS tipo_id, 'Imersão presencial 1 (Híbrido) — Módulos 1–3' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Presencial' AS local_, 'Exclusiva do Plano Híbrido. Sexta, sábado e domingo, dia todo.' AS descricao, '2027-01-15' AS data_inicio, '2027-01-17' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_125' AS id, 'tipo_aulas_pos' AS tipo_id, 'Imersão presencial 2 (Híbrido) — Módulos 4–7' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Presencial' AS local_, 'Exclusiva do Plano Híbrido. Sexta, sábado e domingo, dia todo.' AS descricao, '2027-04-16' AS data_inicio, '2027-04-18' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_126' AS id, 'tipo_aulas_pos' AS tipo_id, 'Imersão presencial 3 (Híbrido) — Módulos 8–10' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Presencial' AS local_, 'Exclusiva do Plano Híbrido. Sexta, sábado e domingo, dia todo.' AS descricao, '2027-07-16' AS data_inicio, '2027-07-18' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_psq' AS lote_id
  UNION ALL
  SELECT 'aula_127' AS id, 'tipo_aulas_pos' AS tipo_id, 'Imersão presencial 4 (Híbrido) — Módulos 11–12, defesa do TFI e formatura' AS titulo, 'Psiquiatria Clínica — EAD e Híbrido' AS turma, 'Presencial' AS local_, 'Exclusiva do Plano Híbrido. Sexta, sábado e domingo, dia todo.' AS descricao, '2027-10-15' AS data_inicio, '2027-10-17' AS data_fim, NULL AS hora_inicio, NULL AS hora_fim, 'lote_psq' AS lote_id
) AS v
CROSS JOIN (SELECT `id` FROM `usuarios` WHERE `papel` = 'admin' ORDER BY `criado_em` LIMIT 1) AS u;
