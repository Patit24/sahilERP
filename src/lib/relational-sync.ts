import { supabase } from './supabase-client'
import { canUseRemoteStorage } from './remote-storage'
import { TenantData } from './storage-utils'

export async function syncRelationalTenantData(
  companyId: string,
  fy: string,
  payload: TenantData
): Promise<void> {
  if (!canUseRemoteStorage() || !supabase) return

  const { error } = await supabase.rpc('sync_relational_tenant', {
    p_company_id: companyId,
    p_fy: fy,
    p_payload: payload
  })

  if (error) {
    console.error('Relational tenant sync failed:', error)
    throw new Error(error.message)
  }
}
