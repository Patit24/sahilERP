/*
 * MULTI-TENANT LOCALSTORAGE UTILITIES
 * Manages isolated data partitions per business/FY
 */

export interface BusinessMetadata {
  id: string
  name: string
  startFY: string
}

export interface AppMetadata {
  businesses: BusinessMetadata[]
  activeCompanyId: string
  activeFY: string
}

export interface TenantData {
  suppliers: any[]
  customers: any[]
  items: any[]
  invoices: any[]
  payments: any[]
  receivedDiscounts: any[]
  salesInvoices: any[]
  customerPayments: any[]
  expenseTypes: any[]
  expenseEntries: any[]
  fixedSchemes: any[]
  mtBookings: any[]
}

const METADATA_KEY = 'app_metadata'

export function getMetadata(): AppMetadata {
  const stored = localStorage.getItem(METADATA_KEY)
  if (!stored) {
    const defaultMeta: AppMetadata = {
      businesses: [],
      activeCompanyId: '',
      activeFY: ''
    }
    localStorage.setItem(METADATA_KEY, JSON.stringify(defaultMeta))
    return defaultMeta
  }
  return JSON.parse(stored)
}

export function saveMetadata(metadata: AppMetadata): void {
  localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
}

export function getTenantKey(companyId: string, fy: string): string {
  return `data_${companyId}_${fy}`
}

export function getTenantData(companyId: string, fy: string): TenantData {
  const key = getTenantKey(companyId, fy)
  const stored = localStorage.getItem(key)
  
  if (!stored) {
    const emptyData: TenantData = {
      suppliers: [],
      customers: [],
      items: [],
      invoices: [],
      payments: [],
      receivedDiscounts: [],
      salesInvoices: [],
      customerPayments: [],
      expenseTypes: [],
      expenseEntries: [],
      fixedSchemes: [],
      mtBookings: []
    }
    localStorage.setItem(key, JSON.stringify(emptyData))
    return emptyData
  }
  
  return JSON.parse(stored)
}

export function saveTenantData(companyId: string, fy: string, data: TenantData): void {
  const key = getTenantKey(companyId, fy)
  localStorage.setItem(key, JSON.stringify(data))
}

export function generateFYOptions(): string[] {
  const years: string[] = []
  for (let i = 2021; i <= 2039; i++) {
    years.push(`FY${i}-${(i + 1).toString().slice(2)}`)
  }
  return years
}

export function createBusinessId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}
