/**
 * DEPRECATED — replaced by firebase-storage.ts.
 * This stub exists only to avoid compile errors in any stale import.
 */
export class RemoteSnapshotConflictError extends Error {}
export class RemoteStorageUnavailableError extends Error {}
export function canUseRemoteStorage() { return false }
export async function loadRemoteTenantData() { return null }
export async function saveRemoteTenantData() { return null }
export function subscribeTenantData() { return null }
