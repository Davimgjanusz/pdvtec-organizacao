-- =============================================
-- PDVTEC - Migration: Kanban Avançado
-- Quadros, colunas com WIP limit, métricas
-- =============================================

-- Quadros Kanban
CREATE TABLE public.kanban_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NULL,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_boards_archived ON public.kanban_boards(archived);

ALTER TABLE public.kanban_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_boards_select_authenticated" ON public.kanban_boards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kanban_boards_insert_authenticated" ON public.kanban_boards
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "kanban_boards_update_authenticated" ON public.kanban_boards
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kanban_boards_delete_admin" ON public.kanban_boards
  FOR DELETE TO authenticated USING (public.get_user_role() = 'admin');

-- Colunas Kanban com WIP Limit
CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  wip_limit integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_columns_board_id ON public.kanban_columns(board_id);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kanban_columns_select_authenticated" ON public.kanban_columns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kanban_columns_insert_authenticated" ON public.kanban_columns
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "kanban_columns_update_authenticated" ON public.kanban_columns
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "kanban_columns_delete_admin" ON public.kanban_columns
  FOR DELETE TO authenticated USING (public.get_user_role() = 'admin');

-- Colunas adicionais na tabela tasks para métricas e vínculo com boards
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.kanban_boards(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS column_id uuid REFERENCES public.kanban_columns(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at timestamptz NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz NULL;

CREATE INDEX idx_tasks_board_id ON public.tasks(board_id);
CREATE INDEX idx_tasks_column_id ON public.tasks(column_id);
CREATE INDEX idx_tasks_completed_at ON public.tasks(completed_at);

-- Trigger: updated_at para kanban_boards
CREATE TRIGGER trg_kanban_boards_updated_at
  BEFORE UPDATE ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Função: criar quadro com colunas padrão
CREATE OR REPLACE FUNCTION public.create_default_board(
  p_title text,
  p_description text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  board_id uuid;
BEGIN
  INSERT INTO public.kanban_boards (title, description, created_by)
  VALUES (p_title, p_description, p_created_by)
  RETURNING id INTO board_id;

  INSERT INTO public.kanban_columns (board_id, title, slug, position) VALUES
    (board_id, 'A Fazer', 'todo', 0),
    (board_id, 'Em Andamento', 'in_progress', 1),
    (board_id, 'Em Revisão', 'review', 2),
    (board_id, 'Concluído', 'done', 3);

  RETURN board_id;
END;
$$;

-- Criar quadro padrão inicial
SELECT public.create_default_board('Quadro Principal', 'Quadro padrão do sistema');
