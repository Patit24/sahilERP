import { db, isRemoteStorageEnabled, isFirebaseConfigured } from './firebase-client'
import { doc, getDocs, setDoc, collection } from 'firebase/firestore'
import { BusinessMetadata } from './storage-utils'

export interface BusinessDetails {
  phone?: string
  email?: string
  billingAddress?: string
  state?: string
  city?: string
  pincode?: string
  businessType?: string
  industryType?: string
  registrationType?: string
  gstRegistered?: 'yes' | 'no'
  panNumber?: string
  website?: string
}

export interface BusinessCloudData {
  metadata: BusinessMetadata
  details: BusinessDetails
}

export async function saveBusinessToCloud(businessId: string, metadata: BusinessMetadata, details: BusinessDetails) {
  if (!isRemoteStorageEnabled || !isFirebaseConfigured || !db) return;
  try {
    await setDoc(doc(db, 'businesses', businessId), {
      metadata,
      details,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to save business to cloud:', e);
  }
}

export async function loadBusinessesFromCloud(): Promise<BusinessCloudData[]> {
  if (!isRemoteStorageEnabled || !isFirebaseConfigured || !db) return [];
  try {
    const snap = await getDocs(collection(db, 'businesses'));
    return snap.docs.map(doc => doc.data() as BusinessCloudData);
  } catch (e) {
    console.error('Failed to load businesses from cloud:', e);
    return [];
  }
}
