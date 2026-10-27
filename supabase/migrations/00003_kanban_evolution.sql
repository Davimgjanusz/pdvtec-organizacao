-- =============================================
-- PDVTEC - Migration: Evolução do Kanban
-- Vínculo de tarefas legadas a quadros, integridade
-- de colunas/WIP e base para métricas de fluxo
-- =============================================

-- Tarefas criadas antes dos múltiplos quadros passam a pertencer ao quadro mais antigo
UPDATE public.tasks
SET board_id = (
  SELECT id FROM public.kanban_boards WHERE archived = false ORDER BY created_at LIMIT 1
)
WHERE board_id IS NULL;

-- Sincroniza column_id com a coluna (slug) do quadro
UPDATE public.tasks t
SET column_id = c.id
FROM public.kanban_columns c
WHERE c.board_id = t.board_id
  AND c.slug = t.column_status
  AND t.column_id IS DISTINCT FROM c.id;

-- Backfill das datas usadas no Lead Time / Cycle Time
UPDATE public.tasks
SET started_at = COALESCE(started_at, updated_at)
WHERE column_status <> 'todo' AND started_at IS NULL;

UPDATE public.tasks
SET completed_at = COALESCE(completed_at, updated_at)
WHERE column_status = 'done' AND completed_at IS NULL;

-- Uma coluna por slug em cada quadro
CREATE UNIQUE INDEX IF NOT EXISTS uq_kanban_columns_board_slug
  ON public.kanban_columns(board_id, slug);

-- Limite WIP deve ser positivo (NULL = sem limite)
ALTER TABLE public.kanban_columns
  DROP CONSTRAINT IF EXISTS chk_kanban_columns_wip_limit;
ALTER TABLE public.kanban_columns
  ADD CONSTRAINT chk_kanban_columns_wip_limit CHECK (wip_limit IS NULL OR wip_limit > 0);

-- Ordenação do quadro: board -> coluna -> posição
CREATE INDEX IF NOT EXISTS idx_tasks_board_column_position
  ON public.tasks(board_id, column_status, position);
