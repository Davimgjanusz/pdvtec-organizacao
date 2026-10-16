import { createClient } from "@/lib/supabase/server";

export async function logAudit(params: {
  action: string;
  tableName: string;
  recordId: string;
  details?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.rpc("create_audit_log", {
    p_user_id: user.id,
    p_action: params.action,
    p_table_name: params.tableName,
    p_record_id: params.recordId,
    p_details: params.details ?? null,
    p_ip_address: null,
  });
}
