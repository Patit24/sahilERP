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

export class RemoteAuthServiceUnavailableError extends Error {
  constructor(message = 'Supabase is temporarily unavailable. Please try again in a minute.') {
    super(message)
    this.name = 'RemoteAuthServiceUnavailableError'
  }
}

export function canUseSupabaseAuth(): boolean {
  return isSupabaseAuthEnabled && isSupabaseConfigured && Boolean(supabase)
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

async function clearLocalSupabaseSession(): Promise<void> {
  if (!supabase) return

  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.warn('Local Supabase sign-out failed:', error)
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

  const { data, error } = await supabase
    .from('app_user_profiles')
    .select('id,email,display_name,role,permissions,is_active,created_at,updated_at')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (error) {
    if (isTransientSupabaseError(error)) {
      throw new RemoteAuthServiceUnavailableError()
    }
    await clearLocalSupabaseSession()
    return null
  }

  if (!data || !data.is_active) {
    await clearLocalSupabaseSession()
    return null
  }

  return toAuthenticatedUser(data as AppUserProfileRow)
}

export async function signInRemoteUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  if (!canUseSupabaseAuth() || !supabase) return null

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  })

  if (error) throw new Error(error.message)
  return getRemoteCurrentUser()
}

export async function signOutRemoteUser(): Promise<void> {
  await clearLocalSupabaseSession()
}

export async function listRemoteUserProfiles(): Promise<UserAccount[]> {
  if (!canUseSupabaseAuth() || !supabase) return []

  const { data, error } = await supabase
    .from('app_user_profiles')
    .select('id,email,display_name,role,permissions,is_active,created_at,updated_at')
    .order('created_at', { ascending: false })

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
