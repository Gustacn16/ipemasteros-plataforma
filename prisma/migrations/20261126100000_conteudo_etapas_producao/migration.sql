-- Produção do Conteúdo em 5 etapas: Ideia, Planejado, Gravação (a_gravar), Edição e Finalizado (aprovado).
-- "Gravado" e "Revisão" saem: os conteúdos nelas passam para Edição (nenhum conteúdo é apagado).
UPDATE `conteudos` SET `etapa` = 'edicao' WHERE `etapa` IN ('gravado', 'revisao');

-- AlterTable
ALTER TABLE `conteudos` MODIFY `etapa` ENUM('ideia', 'planejado', 'a_gravar', 'edicao', 'aprovado', 'publicado', 'cancelado') NOT NULL DEFAULT 'ideia';
