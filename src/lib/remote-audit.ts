import { supabase } from './supabase-client'
import { isSupabaseAuthEnabled, isSupabaseConfigured } from './supabase-client'

export async function appendServerAuditLog(
  companyId: string | null,
  tenantKey: string | null,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  if (!isSupabaseAuthEnabled || !isSupabaseConfigured || !supabase) return

  const { error } = await supabase.rpc('append_audit_log', {
    p_company_id: companyId,
    p_tenant_key: tenantKey,
    p_action: action,
    p_details: details
  })

  if (error) {
    console.error('Server audit log failed:', error)
  }
}
