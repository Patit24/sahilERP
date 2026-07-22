import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  getAuth
} from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db, isFirebaseAuthEnabled, isFirebaseConfigured } from './firebase-client'
import { AuthenticatedUser, PermissionMap, UserAccount } from './security-utils'

// ─── Error Classes ────────────────────────────────────────────────────────────

export class RemoteAuthServiceUnavailableError extends Error {
  constructor(message = 'Firebase Auth is temporarily unavailable. Please try again in a moment.') {
    super(message)
    this.name = 'RemoteAuthServiceUnavailableError'
  }
}

// ─── Firestore User Profile Shape ─────────────────────────────────────────────

interface FirestoreUserProfile {
  email: string
  displayName: string | null
  role: 'master_admin' | 'agent'
  permissions: PermissionMap | null
  isActive: boolean
  companyId: string | null
  allowedCounters?: string[]
  createdAt: string
  updatedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function canUseFirebaseAuth(): boolean {
  return isFirebaseAuthEnabled && isFirebaseConfigured && Boolean(auth) && Boolean(db)
}

function withTimeout<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(
      () => reject(new RemoteAuthServiceUnavailableError('Firebase request timed out.')),
      ms
    )
    promise.then(resolve).catch(reject).finally(() => window.clearTimeout(id))
  })
}

function toAuthenticatedUser(uid: string, profile: FirestoreUserProfile): AuthenticatedUser {
  return {
    id: uid,
    username: profile.email,
    displayName: profile.displayName || profile.email,
    role: profile.role,
    permissions: profile.permissions || {},
    isActive: profile.isActive,
    allowedCounters: profile.allowedCounters || []
  }
}

function firebaseUserToAuthenticatedUser(fbUser: FirebaseUser): AuthenticatedUser | null {
  const email = fbUser.email?.trim().toLowerCase()
  if (!email) return null
  return {
    id: fbUser.uid,
    username: email,
    displayName: fbUser.displayName || email,
    role: 'master_admin', // default until Firestore profile is fetched
    permissions: {},
    isActive: true
  }
}

async function fetchFirestoreProfile(uid: string): Promise<FirestoreUserProfile | null> {
  if (!db) return null
  try {
    const snap = await withTimeout(getDoc(doc(db, 'users', uid)))
    return snap.exists() ? (snap.data() as FirestoreUserProfile) : null
  } catch {
    return null
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check Firebase Auth for a currently-signed-in user and return the ERP profile.
 */
export async function getRemoteCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!canUseFirebaseAuth() || !auth) return null

  // Wait for auth to settle (avoids race on page load)
  const fbUser = await withTimeout(
    new Promise<FirebaseUser | null>((resolve) => {
      const unsub = onAuthStateChanged(auth!, (user) => {
        unsub()
        resolve(user)
      })
    })
  )

  if (!fbUser) return null

  const profile = await fetchFirestoreProfile(fbUser.uid)
  if (profile) {
    if (!profile.isActive) {
      await signOut(auth!)
      return null
    }
    return toAuthenticatedUser(fbUser.uid, profile)
  }

  // No Firestore profile yet — use Firebase user metadata as fallback
  return firebaseUserToAuthenticatedUser(fbUser)
}

/**
 * Sign in with email and password via Firebase Auth.
 */
export async function signInRemoteUser(
  email: string,
  password: string
): Promise<AuthenticatedUser | null> {
  if (!canUseFirebaseAuth() || !auth) return null

  try {
    const credential = await withTimeout(
      signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
    )
    const profile = await fetchFirestoreProfile(credential.user.uid)
    if (profile) {
      if (!profile.isActive) {
        await signOut(auth)
        throw new Error('Your account is inactive. Contact the admin.')
      }
      return toAuthenticatedUser(credential.user.uid, profile)
    }
    return firebaseUserToAuthenticatedUser(credential.user)
  } catch (error: unknown) {
    if (error instanceof RemoteAuthServiceUnavailableError) throw error
    const code = (error as { code?: string }).code
    const msg =
      code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
        ? 'Incorrect email or password.'
        : code === 'auth/too-many-requests'
        ? 'Too many login attempts. Try again later.'
        : (error instanceof Error ? error.message : 'Login failed.')
    throw new Error(msg)
  }
}

/**
 * Sign out from Firebase Auth.
 */
export async function signOutRemoteUser(): Promise<void> {
  if (!auth) return
  try {
    await signOut(auth)
  } catch (error) {
    console.warn('Firebase sign-out failed:', error)
  }
}

/**
 * List all user profiles from Firestore (master_admin only).
 */
export async function listRemoteUserProfiles(): Promise<UserAccount[]> {
  if (!canUseFirebaseAuth() || !db) return []
  const snap = await withTimeout(getDocs(collection(db, 'users')))
  return snap.docs.map((d) => {
    const data = d.data() as FirestoreUserProfile
    return {
      id: d.id,
      username: data.email,
      displayName: data.displayName || data.email,
      role: data.role,
      permissions: data.permissions || {},
      isActive: data.isActive,
      salt: '',
      passcodeHash: '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || ''
    }
  })
}

/**
 * Update a user profile in Firestore.
 */
export async function updateRemoteUserProfile(input: {
  id: string
  companyId: string
  displayName: string
  role: 'master_admin' | 'agent'
  permissions: PermissionMap
  isActive: boolean
}): Promise<UserAccount[]> {
  if (!canUseFirebaseAuth() || !db) return []

  await withTimeout(
    updateDoc(doc(db, 'users', input.id), {
      displayName: input.displayName.trim(),
      role: input.role,
      permissions: input.permissions,
      isActive: input.isActive,
      companyId: input.companyId,
      updatedAt: new Date().toISOString()
    })
  )

  return listRemoteUserProfiles()
}

/**
 * Create or overwrite a user profile in Firestore (call after Firebase Auth user creation).
 */
export async function createRemoteUserProfile(
  uid: string,
  email: string,
  displayName: string,
  role: 'master_admin' | 'agent',
  companyId: string,
  permissions: PermissionMap = {}
): Promise<void> {
  if (!db) return
  const now = new Date().toISOString()
  await withTimeout(
    setDoc(doc(db, 'users', uid), {
      email: email.trim().toLowerCase(),
      displayName: displayName.trim(),
      role,
      permissions,
      isActive: true,
      companyId,
      createdAt: now,
      updatedAt: now
    } satisfies FirestoreUserProfile)
  )
}

// Re-export for App.tsx compatibility
export { RemoteAuthServiceUnavailableError as default }
