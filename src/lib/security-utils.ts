export interface AuditLogEntry {
  id: string
  timestamp: string
  action: string
  tenantKey?: string
  details?: Record<string, unknown>
}

export type UserRole = 'master_admin' | 'agent'
export type PermissionLevel = 'none' | 'view' | 'edit'
export type PermissionMap = Record<string, PermissionLevel>

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: UserRole
  permissions: PermissionMap
  isActive: boolean
  allowedCounters?: string[]
  salt: string
  passcodeHash: string
  createdAt: string
  updatedAt: string
}

export interface AuthenticatedUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  permissions: PermissionMap
  isActive: boolean
  allowedCounters?: string[]
}

const AUDIT_LOG_KEY = 'app_audit_log'
const APP_LOCK_HASH_KEY = 'app_lock_hash'
const APP_LOCK_SALT_KEY = 'app_lock_salt'
const APP_AUTH_SESSION_KEY = 'app_auth_session'
const APP_AUTH_USER_ID_KEY = 'app_auth_user_id'
const APP_USERS_KEY = 'app_user_accounts'
const PASSCODE_HASH_ITERATIONS = 210000

export function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function isAllowedRestoreKey(key: string): boolean {
  return (
    key === 'app_metadata' ||
    key === 'storedCompanies' ||
    key.startsWith('data_') ||
    key.startsWith('cashbank_')
  )
}

export function appendAuditLog(action: string, details?: Record<string, unknown>, tenantKey?: string): void {
  try {
    const current = safeJsonParse<AuditLogEntry[]>(localStorage.getItem(AUDIT_LOG_KEY), [])
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      action,
      tenantKey,
      details
    }
    const next = [entry, ...current].slice(0, 1000)
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function createSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes.buffer)
}

async function hashPasscode(passcode: string, salt: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passcode),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(salt),
      iterations: PASSCODE_HASH_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  )
  return bytesToHex(derivedBits)
}

async function legacyHashPasscode(passcode: string, salt: string): Promise<string> {
  const encoded = new TextEncoder().encode(`${salt}:${passcode}`)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return bytesToHex(digest)
}

export function hasAppLock(): boolean {
  return hasMasterAdmin() || Boolean(localStorage.getItem(APP_LOCK_HASH_KEY) && localStorage.getItem(APP_LOCK_SALT_KEY))
}

export function hasAuthenticatedSession(): boolean {
  return sessionStorage.getItem(APP_AUTH_SESSION_KEY) === 'true' && Boolean(sessionStorage.getItem(APP_AUTH_USER_ID_KEY))
}

export function getUserAccounts(): UserAccount[] {
  return safeJsonParse<UserAccount[]>(localStorage.getItem(APP_USERS_KEY), [])
}

function saveUserAccounts(accounts: UserAccount[]): void {
  localStorage.setItem(APP_USERS_KEY, JSON.stringify(accounts))
}

function toAuthenticatedUser(account: UserAccount): AuthenticatedUser {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: account.role,
    permissions: account.permissions,
    isActive: account.isActive
  }
}

function createAccountId(role: UserRole): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function hasMasterAdmin(): boolean {
  return getUserAccounts().some((account) => account.role === 'master_admin' && account.isActive)
}

export function getCurrentUser(): AuthenticatedUser | null {
  const userId = sessionStorage.getItem(APP_AUTH_USER_ID_KEY)
  if (!userId) return null
  const account = getUserAccounts().find((item) => item.id === userId && item.isActive)
  return account ? toAuthenticatedUser(account) : null
}

export async function createMasterAdmin(username: string, displayName: string, passcode: string): Promise<AuthenticatedUser> {
  const now = new Date().toISOString()
  const accounts = getUserAccounts()
  const normalizedUsername = username.trim().toLowerCase() || 'admin'
  const salt = createSalt()
  const passcodeHash = await hashPasscode(passcode, salt)
  const account: UserAccount = {
    id: createAccountId('master_admin'),
    username: normalizedUsername,
    displayName: displayName.trim() || 'Master Admin',
    role: 'master_admin',
    permissions: {},
    isActive: true,
    salt,
    passcodeHash,
    createdAt: now,
    updatedAt: now
  }
  const next = accounts.filter((item) => item.role !== 'master_admin')
  saveUserAccounts([account, ...next])
  sessionStorage.setItem(APP_AUTH_SESSION_KEY, 'true')
  sessionStorage.setItem(APP_AUTH_USER_ID_KEY, account.id)
  appendAuditLog('master_admin_created', { username: account.username })
  return toAuthenticatedUser(account)
}

export async function createAgentAccount(input: {
  username: string
  displayName: string
  passcode: string
  permissions?: PermissionMap
  allowedCounters?: string[]
}): Promise<UserAccount> {
  const accounts = getUserAccounts()
  const normalizedUsername = input.username.trim().toLowerCase()
  if (!normalizedUsername) throw new Error('Username is required')
  if (accounts.some((account) => account.username.toLowerCase() === normalizedUsername)) {
    throw new Error('Username already exists')
  }

  const now = new Date().toISOString()
  const salt = createSalt()
  const passcodeHash = await hashPasscode(input.passcode, salt)
  const account: UserAccount = {
    id: createAccountId('agent'),
    username: normalizedUsername,
    displayName: input.displayName.trim() || normalizedUsername,
    role: 'agent',
    permissions: input.permissions || {},
    isActive: true,
    allowedCounters: input.allowedCounters || [],
    salt,
    passcodeHash,
    createdAt: now,
    updatedAt: now
  }
  saveUserAccounts([account, ...accounts])
  appendAuditLog('agent_account_created', { username: account.username })
  return account
}

export async function updateAgentAccount(id: string, input: {
  displayName: string
  passcode?: string
  permissions?: PermissionMap
  isActive?: boolean
  allowedCounters?: string[]
}): Promise<UserAccount[]> {
  const accounts = getUserAccounts()
  const target = accounts.find((account) => account.id === id && account.role === 'agent')
  if (!target) throw new Error('Agent not found')

  let salt = target.salt
  let passcodeHash = target.passcodeHash
  if (input.passcode?.trim()) {
    salt = createSalt()
    passcodeHash = await hashPasscode(input.passcode, salt)
  }

  const nextAccounts = accounts.map((account) => {
    if (account.id !== id || account.role !== 'agent') return account
    return {
      ...account,
      displayName: input.displayName.trim() || account.username,
      permissions: input.permissions ?? account.permissions,
      isActive: input.isActive ?? account.isActive,
      allowedCounters: input.allowedCounters ?? account.allowedCounters,
      salt,
      passcodeHash,
      updatedAt: new Date().toISOString()
    }
  })
  saveUserAccounts(nextAccounts)
  appendAuditLog('agent_account_updated', { agentId: id, isActive: input.isActive })
  return nextAccounts
}

export function deleteAgentAccount(id: string): UserAccount[] {
  const accounts = getUserAccounts()
  const target = accounts.find((account) => account.id === id && account.role === 'agent')
  if (!target) throw new Error('Agent not found')
  const next = accounts.filter((account) => account.id !== id)
  saveUserAccounts(next)
  appendAuditLog('agent_account_deleted', { agentId: id, username: target.username })
  if (sessionStorage.getItem(APP_AUTH_USER_ID_KEY) === id) {
    lockAppSession()
  }
  return next
}

export async function verifyUserLogin(username: string, passcode: string): Promise<AuthenticatedUser | null> {
  const normalizedUsername = username.trim().toLowerCase()
  const account = getUserAccounts().find((item) => item.username.toLowerCase() === normalizedUsername && item.isActive)
  if (!account) return null
  const hash = await hashPasscode(passcode, account.salt)
  if (hash !== account.passcodeHash) {
    const legacyHash = await legacyHashPasscode(passcode, account.salt)
    if (legacyHash !== account.passcodeHash) return null
    const accounts = getUserAccounts().map((item) => (
      item.id === account.id
        ? { ...item, passcodeHash: hash, updatedAt: new Date().toISOString() }
        : item
    ))
    saveUserAccounts(accounts)
  }
  sessionStorage.setItem(APP_AUTH_SESSION_KEY, 'true')
  sessionStorage.setItem(APP_AUTH_USER_ID_KEY, account.id)
  appendAuditLog('user_logged_in', { username: account.username, role: account.role })
  return toAuthenticatedUser(account)
}

export async function setAppPasscode(passcode: string): Promise<void> {
  const salt = createSalt()
  const hash = await hashPasscode(passcode, salt)
  localStorage.setItem(APP_LOCK_SALT_KEY, salt)
  localStorage.setItem(APP_LOCK_HASH_KEY, hash)
  sessionStorage.setItem(APP_AUTH_SESSION_KEY, 'true')
  sessionStorage.setItem(APP_AUTH_USER_ID_KEY, 'legacy-admin')
  appendAuditLog('app_lock_created')
}

export async function verifyAppPasscode(passcode: string): Promise<boolean> {
  const salt = localStorage.getItem(APP_LOCK_SALT_KEY)
  const storedHash = localStorage.getItem(APP_LOCK_HASH_KEY)
  if (!salt || !storedHash) return false
  const hash = await hashPasscode(passcode, salt)
  let isValid = hash === storedHash
  if (!isValid) {
    const legacyHash = await legacyHashPasscode(passcode, salt)
    isValid = legacyHash === storedHash
    if (isValid) {
      localStorage.setItem(APP_LOCK_HASH_KEY, hash)
    }
  }
  if (isValid) {
    sessionStorage.setItem(APP_AUTH_SESSION_KEY, 'true')
    sessionStorage.setItem(APP_AUTH_USER_ID_KEY, 'legacy-admin')
    appendAuditLog('app_unlocked')
  }
  return isValid
}

export function lockAppSession(): void {
  sessionStorage.removeItem(APP_AUTH_SESSION_KEY)
  sessionStorage.removeItem(APP_AUTH_USER_ID_KEY)
  appendAuditLog('app_locked')
}
