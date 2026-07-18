/**
 * DEPRECATED — Postgres relational sync has been removed.
 * Data is now stored in Firestore via firebase-storage.ts.
 */
export class RelationalStorageNotReadyError extends Error {}
export async function loadRelationalTenantData() { return null }
export async function saveRelationalTenantData() {}
