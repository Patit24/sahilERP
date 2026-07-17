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

type SupabaseErrorLike = { code?: string; message?: string; status?: number; details?: string } | null
type SupabaseResultLike = { error?: SupabaseErrorLike }

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new RemoteStorageUnavailableError())
    }, timeoutMs)

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

async function withTransientRetry<T>(operation: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await withTimeout(operation())
    } catch (error) {
      lastError = error
      if (!(error instanceof RemoteStorageUnavailableError) || attempt === attempts - 1) {
        throw error
      }
    }
  }

  throw lastError
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function withTransientResultRetry<T extends SupabaseResultLike>(
  operation: () => PromiseLike<T>,
  attempts = 1
): Promise<T> {
  let lastResult: T | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await withTransientRetry(operation, 1)
    lastResult = result

    if (!isTransientSupabaseError(result.error || null) || attempt === attempts - 1) {
      return result
    }

    await wait(350 * (attempt + 1))
  }

  return lastResult as T
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

function isTransientSupabaseError(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.status === 503 ||
    error.status === 504 ||
    error.code === '503' ||
    error.code === '504' ||
    error.code === 'PGRST003' ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout') ||
    message.includes('schema cache') ||
    message.includes('connection pool') ||
    message.includes('timed out acquiring') ||
    message.includes('fetch failed') ||
    message.includes('network')
  )
}

export async function loadRemoteTenantData(companyId: string, tenantKey: string): Promise<TenantSnapshot | null> {
  if (!canUseRemoteStorage() || !supabase) return null
  const client = supabase

  const { data, error } = await withTransientResultRetry(() =>
    client
      .from('tenant_snapshots')
      .select('tenant_key,company_id,payload,revision,updated_at,device_id')
      .eq('company_id', companyId)
      .eq('tenant_key', tenantKey)
      .maybeSingle()
  )

  if (error) {
    if (isTransientSupabaseError(error)) {
      console.error('Supabase load temporarily unavailable:', error)
      throw new RemoteStorageUnavailableError('Supabase data load timed out. Saved data was not overwritten.')
    }
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
  const client = supabase

  const { data, error } = await withTransientResultRetry(() =>
    client.rpc('save_tenant_snapshot', {
      p_company_id: companyId,
      p_tenant_key: tenantKey,
      p_payload: payload,
      p_expected_revision: expectedRevision,
      p_device_id: getDeviceId()
    })
  )

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
