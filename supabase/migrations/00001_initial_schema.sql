-- =============================================
-- PDVTEC - Migration inicial
-- Tabelas, índices, triggers, RLS e políticas
-- =============================================

-- =============================================
-- TABELA: profiles (criada primeiro pois get_user_role() depende dela)
-- =============================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'comercial', 'operacional')),
  avatar_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- Função auxiliar para obter o role do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (true);

-- =============================================
-- TABELA: clients
-- =============================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_name text NOT NULL,
  trade_name text NULL,
  cnpj text UNIQUE NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  zip_code text NULL,
  street text NULL,
  neighborhood text NULL,
  city text NULL,
  state text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_cnpj ON public.clients(cnpj);
CREATE INDEX idx_clients_corporate_name ON public.clients(corporate_name);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_authenticated" ON public.clients
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clients_insert_admin_comercial" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "clients_update_admin_comercial" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'comercial'))
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "clients_delete_admin" ON public.clients
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- =============================================
-- TABELA: proposals
-- =============================================
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  billing_type text NOT NULL CHECK (billing_type IN ('one_off', 'recurring', 'hybrid')),
  setup_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (setup_value >= 0),
  recurring_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (recurring_value >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'cancelled')),
  valid_until date NOT NULL,
  scope_description text NOT NULL,
  notes text NULL,
  document_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_valid_until ON public.proposals(valid_until);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposals_select_admin_comercial" ON public.proposals
  FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "proposals_insert_admin_comercial" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "proposals_update_admin_comercial" ON public.proposals
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'comercial'))
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "proposals_delete_admin" ON public.proposals
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- Operacional pode ver propostas aprovadas (necessário para contratos)
CREATE POLICY "proposals_select_operacional_approved" ON public.proposals
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'operacional' AND status = 'approved');

-- =============================================
-- TABELA: contracts
-- =============================================
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid UNIQUE NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  contract_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_renewal', 'expired', 'cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  file_storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_contract_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_contracts_client_id ON public.contracts(client_id);
CREATE INDEX idx_contracts_proposal_id ON public.contracts(proposal_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);
CREATE INDEX idx_contracts_contract_number ON public.contracts(contract_number);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contracts_select_authenticated" ON public.contracts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "contracts_insert_admin_comercial" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "contracts_update_admin_comercial" ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'comercial'))
  WITH CHECK (public.get_user_role() IN ('admin', 'comercial'));

CREATE POLICY "contracts_delete_admin" ON public.contracts
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- =============================================
-- TABELA: tasks
-- =============================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NULL REFERENCES public.contracts(id) ON DELETE SET NULL,
  assigned_to uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NULL,
  column_status text NOT NULL DEFAULT 'todo' CHECK (column_status IN ('todo', 'in_progress', 'review', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_contract_id ON public.tasks(contract_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_column_status ON public.tasks(column_status);
CREATE INDEX idx_tasks_priority ON public.tasks(priority);
CREATE INDEX idx_tasks_position ON public.tasks(column_status, position);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_authenticated" ON public.tasks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tasks_insert_admin_operacional" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('admin', 'operacional'));

CREATE POLICY "tasks_update_admin_operacional" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('admin', 'operacional'))
  WITH CHECK (public.get_user_role() IN ('admin', 'operacional'));

CREATE POLICY "tasks_delete_admin" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- =============================================
-- TABELA: audit_logs
-- =============================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  details jsonb NULL,
  ip_address inet NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Somente admin pode ler logs
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'admin');

-- Inserção via função SECURITY DEFINER (servidor)
CREATE POLICY "audit_logs_insert_service" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Bloquear UPDATE e DELETE para roles da aplicação
CREATE POLICY "audit_logs_no_update" ON public.audit_logs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON public.audit_logs
  FOR DELETE TO authenticated
  USING (false);

-- =============================================
-- TRIGGERS: updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- FUNÇÃO: Gerar número de contrato concorrente-seguro
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_contract_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year text;
  next_seq int;
  result text;
BEGIN
  current_year := to_char(now(), 'YYYY');

  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(contract_number FROM 'CTR-' || current_year || '-(\d+)') AS int
      )
    ), 0
  ) + 1
  INTO next_seq
  FROM public.contracts
  WHERE contract_number LIKE 'CTR-' || current_year || '-%';

  result := 'CTR-' || current_year || '-' || LPAD(next_seq::text, 4, '0');
  RETURN result;
END;
$$;

-- =============================================
-- FUNÇÃO: Registrar audit log
-- =============================================
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_user_id uuid,
  p_action text,
  p_table_name text,
  p_record_id uuid,
  p_details jsonb DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, details, ip_address)
  VALUES (p_user_id, p_action, p_table_name, p_record_id, p_details, p_ip_address)
  RETURNING id INTO log_id;
  RETURN log_id;
END;
$$;

-- =============================================
-- TRIGGER: Criar perfil ao criar usuário no Auth
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operacional')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- STORAGE: Bucket privado para documentos
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdvtec-documents',
  'pdvtec-documents',
  false,
  15728640, -- 15 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "documents_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pdvtec-documents');

CREATE POLICY "documents_insert_admin_comercial" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pdvtec-documents'
    AND public.get_user_role() IN ('admin', 'comercial')
  );

CREATE POLICY "documents_update_admin_comercial" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pdvtec-documents'
    AND public.get_user_role() IN ('admin', 'comercial')
  );

CREATE POLICY "documents_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pdvtec-documents'
    AND public.get_user_role() = 'admin'
  );
