/**
 * DEPRECATED — replaced by firebase-auth.ts.
 * This stub exists only to avoid compile errors in any stale import.
 */
export class RemoteAuthServiceUnavailableError extends Error {}
export function canUseSupabaseAuth() { return false }
export async function getRemoteCurrentUser() { return null }
export async function listRemoteUserProfiles() { return [] }
export async function signInRemoteUser() { return null }
export async function signOutRemoteUser() {}
export async function updateRemoteUserProfile() { return [] }
