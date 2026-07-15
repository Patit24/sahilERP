/*
 * BACKUP & RESTORE UTILITIES
 * ==========================
 * 
 * CRITICAL PRINCIPLE: SOURCE DATA PRESERVATION
 * 
 * These utilities handle backup and restore operations with ZERO transformation.
 * All source data must be preserved EXACTLY as stored:
 * 
 * ✓ orderDate preserved as entered (not auto-changed to invoiceDate)
 * ✓ invoiceDate preserved as entered
 * ✓ All numeric values preserved with exact precision
 * ✓ All string values preserved without trimming/formatting
 * ✓ All arrays preserved with original order
 * 
 * The backup/restore process is a pure save/load operation with no business logic.
 * Reports and calculations happen AFTER data is loaded, never during restore.
 * 
 * MULTI-TENANT ARCHITECTURE:
 * - Single Entity Export: Exports data for one business + FY combination
 * - Master Export: Exports all businesses and all FY data
 * - Smart Restore: Auto-detects backup type and restores accordingly
 */

export interface SingleEntityBackupData {
  version: string
  backupType: 'single'
  timestamp: string
  company: string
  fy: string
  data: {
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
  cashBankData?: any
}

export interface MasterBackupData {
  version: string
  backupType: 'master'
  timestamp: string
  businesses: {
    [companyName: string]: {
      [fy: string]: {
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
    }
  }
  settings: {
    gstPercentage: number
    companies: string[]
    lastActiveCompany?: string
    lastActiveFY?: string
  }
}

export type BackupData = SingleEntityBackupData | MasterBackupData

export function createSingleEntityBackup(
  company: string,
  fy: string,
  suppliers: any[],
  customers: any[],
  items: any[],
  invoices: any[],
  payments: any[],
  receivedDiscounts: any[],
  salesInvoices: any[],
  customerPayments: any[],
  expenseTypes: any[],
  expenseEntries: any[],
  fixedSchemes: any[],
  mtBookings: any[],
  cashBankData?: any
): SingleEntityBackupData {
  return {
    version: '2.0',
    backupType: 'single',
    timestamp: new Date().toISOString(),
    company,
    fy,
    data: {
      suppliers,
      customers,
      items,
      invoices,
      payments,
      receivedDiscounts,
      salesInvoices,
      customerPayments,
      expenseTypes,
      expenseEntries,
      fixedSchemes,
      mtBookings
    },
    cashBankData
  }
}

export function createMasterBackup(
  allBusinessData: Map<string, Map<string, any>>,
  settings: { gstPercentage: number; companies: string[]; lastActiveCompany?: string; lastActiveFY?: string }
): MasterBackupData {
  const businesses: MasterBackupData['businesses'] = {}
  
  allBusinessData.forEach((fyMap, company) => {
    businesses[company] = {}
    fyMap.forEach((data, fy) => {
      businesses[company][fy] = data
    })
  })
  
  return {
    version: '2.0',
    backupType: 'master',
    timestamp: new Date().toISOString(),
    businesses,
    settings
  }
}

export function downloadSingleEntityBackup(backup: SingleEntityBackupData) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const sanitizedCompany = backup.company.replace(/[^a-zA-Z0-9]/g, '_')
  link.download = `${sanitizedCompany}_${backup.fy}_${new Date().getTime()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadMasterBackup(backup: MasterBackupData) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `MASTER_BACKUP_${new Date().getTime()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function validateSingleEntityBackup(data: any): data is SingleEntityBackupData {
  if (!data || typeof data !== 'object') return false
  if (data.backupType !== 'single') return false
  if (!data.version || !data.timestamp || !data.company || !data.fy || !data.data) return false
  
  const requiredKeys = [
    'suppliers', 'customers', 'items', 'invoices', 'payments',
    'receivedDiscounts', 'salesInvoices', 'customerPayments',
    'expenseTypes', 'expenseEntries', 'fixedSchemes', 'mtBookings'
  ]
  
  return requiredKeys.every(key => Array.isArray(data.data[key]))
}

export function validateMasterBackup(data: any): data is MasterBackupData {
  if (!data || typeof data !== 'object') return false
  if (data.backupType !== 'master') return false
  if (!data.version || !data.timestamp || !data.businesses || !data.settings) return false
  if (typeof data.businesses !== 'object') return false
  
  return true
}

export function validateBackup(data: any): data is BackupData {
  if (!data || typeof data !== 'object') return false
  
  if (data.backupType === 'single') {
    return validateSingleEntityBackup(data)
  } else if (data.backupType === 'master') {
    return validateMasterBackup(data)
  } else if (!data.backupType && data.fy && data.data) {
    return true
  }
  
  return false
}

export function detectBackupType(data: any): 'single' | 'master' | 'legacy' | 'invalid' {
  if (!data || typeof data !== 'object') return 'invalid'
  
  if (data.backupType === 'single' && validateSingleEntityBackup(data)) {
    return 'single'
  }
  
  if (data.backupType === 'master' && validateMasterBackup(data)) {
    return 'master'
  }
  
  if (!data.backupType && data.fy && data.data) {
    return 'legacy'
  }
  
  return 'invalid'
}
