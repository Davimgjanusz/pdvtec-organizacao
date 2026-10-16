export type UserRole = "admin" | "comercial" | "operacional";

export type ProposalStatus = "draft" | "sent" | "approved" | "rejected" | "cancelled";

export type BillingType = "one_off" | "recurring" | "hybrid";

export type ContractStatus = "active" | "pending_renewal" | "expired" | "cancelled";

export type TaskColumnStatus = "todo" | "in_progress" | "review" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  corporate_name: string;
  trade_name: string | null;
  cnpj: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  zip_code: string | null;
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  billing_type: BillingType;
  setup_value: number;
  recurring_value: number;
  status: ProposalStatus;
  valid_until: string;
  scope_description: string;
  notes: string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  user?: Profile;
}

export interface Contract {
  id: string;
  proposal_id: string | null;
  client_id: string;
  contract_number: string;
  status: ContractStatus;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  file_storage_path: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  proposal?: Proposal;
}

export interface Task {
  id: string;
  contract_id: string | null;
  assigned_to: string | null;
  board_id: string | null;
  column_id: string | null;
  title: string;
  description: string | null;
  column_status: TaskColumnStatus;
  priority: TaskPriority;
  due_date: string | null;
  position: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  contract?: Contract;
  assignee?: Profile;
  board?: KanbanBoard;
}

export interface KanbanBoard {
  id: string;
  title: string;
  description: string | null;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  columns?: KanbanColumn[];
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  title: string;
  slug: string;
  position: number;
  wip_limit: number | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user?: Profile;
}
