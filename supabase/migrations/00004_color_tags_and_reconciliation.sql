-- =============================================
-- PDVTEC - Migration: Etiquetas de cor no Kanban
-- e Conciliação Financeira (importação de planilhas)
-- =============================================

-- Etiqueta de cor dos cartões do Kanban
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS color_tag text NOT NULL DEFAULT 'default';

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS chk_tasks_color_tag;
ALTER TABLE public.tasks
  ADD CONSTRAINT chk_tasks_color_tag
  CHECK (color_tag IN ('default', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink'));

-- Conciliação Financeira: cada linha é o resultado da auditoria de um item da planilha do parceiro
CREATE TABLE IF NOT EXISTS public.financial_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  reference_month text NOT NULL CHECK (reference_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  client_name_external text NOT NULL,
  contract_id uuid NULL REFERENCES public.contracts(id) ON DELETE SET NULL,
  expected_amount numeric(12, 2) NOT NULL DEFAULT 0.00,
  imported_amount numeric(12, 2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'divergent'
    CHECK (status IN ('matched', 'divergent', 'missing_in_system', 'missing_in_spreadsheet')),
  imported_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fin_reconciliations_month
  ON public.financial_reconciliations(reference_month, partner_name);
CREATE INDEX IF NOT EXISTS idx_fin_reconciliations_contract
  ON public.financial_reconciliations(contract_id);

ALTER TABLE public.financial_reconciliations ENABLE ROW LEVEL SECURITY;

-- Módulo exclusivo de administradores (sem acesso anônimo)
CREATE POLICY "fin_reconciliations_select_admin" ON public.financial_reconciliations
  FOR SELECT TO authenticated USING (public.get_user_role() = 'admin');

CREATE POLICY "fin_reconciliations_insert_admin" ON public.financial_reconciliations
  FOR INSERT TO authenticated WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "fin_reconciliations_update_admin" ON public.financial_reconciliations
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "fin_reconciliations_delete_admin" ON public.financial_reconciliations
  FOR DELETE TO authenticated USING (public.get_user_role() = 'admin');
