import { db } from './firebase-client'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'

export async function appendServerAuditLog(
  companyId: string | null,
  tenantKey: string | null,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  if (!db) return

  try {
    await addDoc(collection(db, 'audit_logs'), {
      companyId,
      tenantKey,
      action,
      details,
      timestamp: serverTimestamp()
    })
  } catch (error) {
    console.error('Firebase audit log failed:', error)
  }
}
