-- Migração opcional: alinhar regras ao comportamento atual (apenas tipos de recorrência cadastrados por área).
-- Use apenas se já tiver dados em rules com allowed_recorrencias preenchido e quiser que só custom_recorrencias definam as recorrências permitidas.
-- As colunas custom_recorrencias e default_recorrencias já são criadas automaticamente pelo app (src/db/sqlite.ts).

-- Zerar recorrências globais (checkboxes removidos da UI; só valem os "Tipos de recorrência da sua área")
UPDATE rules SET allowed_recorrencias = '[]' WHERE allowed_recorrencias != '[]' OR allowed_recorrencias IS NULL;
