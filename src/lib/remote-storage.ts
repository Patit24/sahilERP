import { supabase, isRemoteStorageEnabled, isSupabaseConfigured } from './supabase-client'
import { TenantData } from './storage-utils'

export interface TenantSnapshot {
  tenant_key: string
  company_id: string
  payload: TenantData
  revision: number
  updated_at: string
  device_id?: string
}

export class RemoteSnapshotConflictError extends Error {
  constructor(message = 'Remote data changed before your save completed. Reloading latest data.') {
    super(message)
    this.name = 'RemoteSnapshotConflictError'
  }
}

export class RemoteStorageUnavailableError extends Error {
  constructor(message = 'Supabase is temporarily unavailable. Your last change was not saved remotely yet.') {
    super(message)
    this.name = 'RemoteStorageUnavailableError'
  }
}

const DEVICE_ID_KEY = 'app_device_id'

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export function canUseRemoteStorage(): boolean {
  return isRemoteStorageEnabled && isSupabaseConfigured && Boolean(supabase)
}

function isTransientSupabaseError(error: { code?: string; message?: string; status?: number } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.status === 503 ||
    error.status === 504 ||
    error.code === '503' ||
    error.code === '504' ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout') ||
    message.includes('schema cache') ||
    message.includes('fetch failed') ||
    message.includes('network')
  )
}

export async function loadRemoteTenantData(companyId: string, tenantKey: string): Promise<TenantSnapshot | null> {
  if (!canUseRemoteStorage() || !supabase) return null

  const { data, error } = await supabase
    .from('tenant_snapshots')
    .select('tenant_key,company_id,payload,revision,updated_at,device_id')
    .eq('company_id', companyId)
    .eq('tenant_key', tenantKey)
    .maybeSingle()

  if (error) {
    console.error('Supabase load failed:', error)
    return null
  }

  return (data as TenantSnapshot | null) || null
}

export async function saveRemoteTenantData(
  companyId: string,
  tenantKey: string,
  payload: TenantData,
  expectedRevision: number | null
): Promise<TenantSnapshot | null> {
  if (!canUseRemoteStorage() || !supabase) return null

  const { data, error } = await supabase.rpc('save_tenant_snapshot', {
    p_company_id: companyId,
    p_tenant_key: tenantKey,
    p_payload: payload,
    p_expected_revision: expectedRevision,
    p_device_id: getDeviceId()
  })

  if (error) {
    if (isTransientSupabaseError(error)) {
      console.error('Supabase save temporarily unavailable:', error)
      throw new RemoteStorageUnavailableError()
    }
    if (
      error.code === '40001' ||
      error.message?.includes('Snapshot conflict') ||
      error.details?.includes('Snapshot conflict')
    ) {
      throw new RemoteSnapshotConflictError(error.message)
    }
    console.error('Supabase save failed:', error)
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data[0] as TenantSnapshot | undefined) || null : null
}

export function subscribeTenantData(
  companyId: string,
  tenantKey: string,
  onSnapshot: (snapshot: TenantSnapshot) => void
): (() => void) | null {
  if (!canUseRemoteStorage() || !supabase) return null
  const client = supabase

  const channel = client
    .channel(`tenant-snapshot:${tenantKey}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tenant_snapshots',
        filter: `company_id=eq.${companyId}`
      },
      (event) => {
        const nextRecord = event.new as TenantSnapshot | null
        if (nextRecord?.tenant_key !== tenantKey) return
        if (nextRecord?.device_id === getDeviceId()) return
        if (nextRecord?.payload) {
          onSnapshot(nextRecord)
        }
      }
    )
    .subscribe((status, error) => {
      if (error) {
        console.error('Supabase realtime subscription failed:', status, error)
      }
    })

  return () => {
    client.removeChannel(channel)
  }
}
