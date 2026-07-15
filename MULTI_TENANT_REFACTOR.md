# MULTI-TENANT ARCHITECTURE REFACTOR - IMPLEMENTATION PLAN

## Problem
The app crashes during business/FY switches because calculations run on stale/undefined data before the new tenant partition is fully initialized.

## Solution: LocalStorage-Based Multi-Tenant Architecture

### 1. DATA STRUCTURE

#### Metadata Storage (Single Key)
```
Key: 'app_metadata'
Value: {
  businesses: [
    { id: "sk-traders", name: "SK TRADERS", startFY: "FY2025-26" },
    { id: "new-business", name: "New Business", startFY: "FY2026-27" }
  ],
  activeCompanyId: "sk-traders",
  activeFY: "FY2025-26"
}
```

#### Tenant Data Partitions (Dynamic Keys)
```
Key: `data_${companyId}_${fy}`
Example: "data_sk-traders_FY2025-26"

Value: {
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
```

### 2. HEADER UI CHANGES

**Remove from Settings:**
- Business Name input
- Financial Year dropdown

**Add to Header (next to logo):**
- Business Name dropdown (shows all businesses from metadata)
- "+" button to add new business
- Financial Year dropdown (FY2021-22 to FY2060-61)

### 3. ANTI-CRASH SWITCHING PROTOCOL

When user changes business or FY:

```typescript
// STEP 1: Reset all states to empty FIRST
setSuppliers([])
setCustomers([])
setItems([])
setInvoices([])
setPayments([])
// ... reset all other states to []

// STEP 2: Update active IDs
setActiveCompanyId(newId)
setActiveFY(newFY)

// STEP 3: Load new tenant data
const tenantData = getTenantData(newId, newFY)
setSuppliers(tenantData.suppliers)
setCustomers(tenantData.customers)
// ... populate with new data
```

### 4. BACKUP/RESTORE HANDLERS

**Export Current Business Only:**
```typescript
const data = getTenantData(activeCompanyId, activeFY)
const backup = {
  type: 'single',
  companyId: activeCompanyId,
  companyName: activeCompanyName,
  fy: activeFY,
  data: data
}
downloadJSON(backup, `${companyName}_${fy}_backup.json`)
```

**Export Master Backup:**
```typescript
const metadata = getMetadata()
const allData = {}
metadata.businesses.forEach(biz => {
  // Get all FYs for this business
  const fys = getAllFYsForBusiness(biz.id)
  fys.forEach(fy => {
    const key = getTenantKey(biz.id, fy)
    allData[key] = getTenantData(biz.id, fy)
  })
})

const backup = {
  type: 'master',
  metadata,
  tenantData: allData
}
downloadJSON(backup, `master_backup_${timestamp}.json`)
```

**Import Logic:**
```typescript
const backup = JSON.parse(fileContent)

if (backup.type === 'master') {
  // Restore metadata
  saveMetadata(backup.metadata)
  
  // Restore all tenant partitions
  Object.keys(backup.tenantData).forEach(key => {
    localStorage.setItem(key, JSON.stringify(backup.tenantData[key]))
  })
  
} else if (backup.type === 'single') {
  // Write to current active partition only
  saveTenantData(activeCompanyId, activeFY, backup.data)
}
```

### 5. IMPLEMENTATION FILES

**Created:**
- `/src/lib/storage-utils.ts` - Multi-tenant storage utilities
- `/src/components/add-business-dialog.tsx` - Add new business modal

**Need to Modify:**
- `/src/App.tsx` - Replace useKV with localStorage, add switching logic
- Header section - Add business/FY dropdowns with + button
- Settings dialog - Remove business name and FY inputs

### 6. KEY BENEFITS

✅ **Crash Prevention:** Empty states load first, no undefined errors
✅ **Data Isolation:** Each business/FY completely separate
✅ **Easy Switching:** Simple dropdown to change context
✅ **Flexible Backup:** Single entity or full master backup
✅ **No Migration Needed:** Existing data can be imported as single backup

### 7. MIGRATION PATH

For existing users:
1. Export current data using old backup
2. System creates default business from current name
3. Import backup into new architecture
4. All data preserved in first partition

## NEXT STEPS

1. Modify App.tsx to use localStorage instead of useKV
2. Add business/FY dropdowns to header
3. Implement switching with reset-first protocol
4. Update backup/restore handlers
5. Test switching between multiple businesses
6. Add migration utility for existing users
