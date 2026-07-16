import { AuthenticatedUser, PermissionMap, UserAccount } from './security-utils'
import { supabase, isSupabaseAuthEnabled, isSupabaseConfigured } from './supabase-client'
import { appendServerAuditLog } from './remote-audit'

interface AppUserProfileRow {
  id: string
  email: string
  display_name: string | null
  role: 'master_admin' | 'agent'
  permissions: PermissionMap | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface SupabaseAuthUserLike {
  id: string
  email?: string | null
  user_metadata?: {
    display_name?: string
    full_name?: string
    role?: 'master_admin' | 'agent'
    permissions?: PermissionMap
  }
  app_metadata?: {
    role?: 'master_admin' | 'agent'
    permissions?: PermissionMap
  }
}

export class RemoteAuthServiceUnavailableError extends Error {
  constructor(message = 'Supabase is temporarily unavailable. Please try again in a minute.') {
    super(message)
    this.name = 'RemoteAuthServiceUnavailableError'
  }
}

export function canUseSupabaseAuth(): boolean {
  return isSupabaseAuthEnabled && isSupabaseConfigured && Boolean(supabase)
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 7000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new RemoteAuthServiceUnavailableError('Supabase login service timed out. Please try again in a minute.'))
    }, timeoutMs)

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
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
    message.includes('fetch failed') ||
    message.includes('network')
  )
}

function isMissingRpcError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return error.code === 'PGRST202' || message.includes('could not find the function')
}

async function clearLocalSupabaseSession(): Promise<void> {
  if (!supabase) return

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.warn('Local Supabase sign-out failed:', error)
  }
}

function fallbackAuthUserToAuthenticatedUser(user: SupabaseAuthUserLike): AuthenticatedUser | null {
  const email = user.email?.trim().toLowerCase()
  if (!email) return null

  const metadataRole = user.app_metadata?.role || user.user_metadata?.role
  const role = metadataRole || (email === 'admin@gmail.com' ? 'master_admin' : undefined)
  if (!role) return null

  return {
    id: user.id,
    username: email,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || (role === 'master_admin' ? 'Super Admin' : email),
    role,
    permissions: user.app_metadata?.permissions || user.user_metadata?.permissions || {},
    isActive: true
  }
}

function toAuthenticatedUser(profile: AppUserProfileRow): AuthenticatedUser {
  return {
    id: profile.id,
    username: profile.email,
    displayName: profile.display_name || profile.email,
    role: profile.role,
    permissions: profile.permissions || {},
    isActive: profile.is_active
  }
}

async function fetchRemoteProfileForUserId(userId: string): Promise<AppUserProfileRow | null> {
  if (!supabase) return null

  const rpcResult = await withTimeout(
    supabase
      .rpc('get_my_app_user_profile')
      .maybeSingle()
  )

  if (!rpcResult.error) {
    return rpcResult.data as AppUserProfileRow | null
  }

  if (!isMissingRpcError(rpcResult.error)) {
    if (isTransientSupabaseError(rpcResult.error)) {
      throw new RemoteAuthServiceUnavailableError()
    }
    return null
  }

  const { data, error } = await withTimeout(
    supabase
      .from('app_user_profiles')
      .select('id,email,display_name,role,permissions,is_active,created_at,updated_at')
      .eq('id', userId)
      .maybeSingle()
  )

  if (error) {
    if (isTransientSupabaseError(error)) {
      throw new RemoteAuthServiceUnavailableError()
    }
    return null
  }

  return data as AppUserProfileRow | null
}

export function remoteProfileToUserAccount(profile: AppUserProfileRow): UserAccount {
  return {
    id: profile.id,
    username: profile.email,
    displayName: profile.display_name || profile.email,
    role: profile.role,
    permissions: profile.permissions || {},
    isActive: profile.is_active,
    salt: '',
    passcodeHash: '',
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  }
}

export async function getRemoteCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!canUseSupabaseAuth() || !supabase) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return null

  let profile: AppUserProfileRow | null = null
  try {
    profile = await fetchRemoteProfileForUserId(userData.user.id)
  } catch (error) {
    const fallbackUser = fallbackAuthUserToAuthenticatedUser(userData.user as SupabaseAuthUserLike)
    if (fallbackUser) return fallbackUser
    await clearLocalSupabaseSession()
    throw error
  }

  if (!profile || !profile.is_active) {
    await clearLocalSupabaseSession()
    return null
  }

  return toAuthenticatedUser(profile)
}

export async function signInRemoteUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  if (!canUseSupabaseAuth() || !supabase) return null

  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })
  )

  if (error) throw new Error(error.message)
  try {
    return await getRemoteCurrentUser()
  } catch (profileError) {
    const fallbackUser = data.user ? fallbackAuthUserToAuthenticatedUser(data.user as SupabaseAuthUserLike) : null
    if (fallbackUser) return fallbackUser
    throw profileError
  }
}

export async function signOutRemoteUser(): Promise<void> {
  await clearLocalSupabaseSession()
}

export async function listRemoteUserProfiles(): Promise<UserAccount[]> {
  if (!canUseSupabaseAuth() || !supabase) return []

  const { data, error } = await withTimeout(
    supabase
      .from('app_user_profiles')
      .select('id,email,display_name,role,permissions,is_active,created_at,updated_at')
      .order('created_at', { ascending: false })
  )

  if (error) {
    if (isTransientSupabaseError(error)) throw new RemoteAuthServiceUnavailableError()
    throw new Error(error.message)
  }
  return (data || []).map((profile) => remoteProfileToUserAccount(profile as AppUserProfileRow))
}

function hasAnyEditPermission(permissions: PermissionMap): boolean {
  return Object.values(permissions).some((level) => level === 'edit')
}

export async function updateRemoteUserProfile(input: {
  id: string
  companyId: string
  displayName: string
  role: 'master_admin' | 'agent'
  permissions: PermissionMap
  isActive: boolean
}): Promise<UserAccount[]> {
  if (!canUseSupabaseAuth() || !supabase) return []

  const { error } = await supabase
    .from('app_user_profiles')
    .update({
      display_name: input.displayName.trim(),
      role: input.role,
      permissions: input.permissions,
      is_active: input.isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)

  if (error) throw new Error(error.message)

  if (input.role === 'agent') {
    const memberRole = hasAnyEditPermission(input.permissions) ? 'admin' : 'agent'
    const { error: membershipError } = await supabase
      .from('company_members')
      .upsert({
        company_id: input.companyId,
        user_id: input.id,
        role: memberRole,
        is_active: input.isActive,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'company_id,user_id'
      })

    if (membershipError) throw new Error(membershipError.message)
  }

  await appendServerAuditLog(null, null, 'user_profile_updated', {
    targetUserId: input.id,
    companyId: input.companyId,
    role: input.role,
    isActive: input.isActive
  })
  return listRemoteUserProfiles()
}
