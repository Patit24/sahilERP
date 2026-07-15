# Multi-Tenant Architecture Implementation Guide

## Overview
This document outlines the complete multi-tenant architecture implementation for SK TRADERS application with localStorage-based data partitioning.

## Completed Components

### 1. Storage Utilities (`src/lib/storage-utils.ts`)
✅ **COMPLETED** - Financial year pool capped at FY2039-40
- `generateFYOptions()` now loops from 2021 to 2039
- Returns array of FY strings: ['FY2021-22', ..., 'FY2039-40']

### 2. Business Dialogs
✅ **CREATED** - `src/components/add-business-dialog.tsx` - Add new business functionality
✅ **CREATED** - `src/components/edit-business-dialog.tsx` - Edit/Delete business functionality

## Required App.tsx Refactor

### Current State
The App.tsx file is currently in a broken state due to incremental modifications. It needs a complete rewrite with the following architecture:

### A. State Management Structure

```typescript
// METADATA STATE (stored in localStorage as 'app_metadata')
const [metadata, setMetadata] = useState<AppMetadata>({
  businesses: [{ id: 'sk_traders', name: 'SK TRADERS', startFY: getCurrentFY() }],
  activeCompanyId: 'sk_traders',
  activeFY: getCurrentFY()
})

// TENANT DATA STATE (loaded from `data_${activeCompanyId}_${activeFY}`)
const [suppliers, setSuppliers] = useState<Supplier[]>([])
const [customers, setCustomers] = useState<Customer[]>([])
const [items, setItems] = useState<Item[]>([])
const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
const [payments, setPayments] = useState<Payment[]>([])
const [receivedDiscounts, setReceivedDiscounts] = useState<ReceivedDiscount[]>([])
const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([])
const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([])
const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([])
const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([])
const [fixedSchemes, setFixedSchemes] = useState<FixedScheme[]>([])
const [mtBookings, setMTBookings] = useState<MTBooking[]>([])

// SETTINGS STATE (per-tenant settings)
const [isLocked, setIsLocked] = useState(false)
const [gstPercentage, setGstPercentage] = useState(18)

// UI STATE
const [addBusinessDialogOpen, setAddBusinessDialogOpen] = useState(false)
const [editBusinessDialogOpen, setEditBusinessDialogOpen] = useState(false)
```

### B. Data Loading Logic

```typescript
// Load tenant data whenever activeCompanyId or activeFY changes
useEffect(() => {
  // ANTI-CRASH PROTOCOL: Reset all states to empty before loading
  setSuppliers([])
  setCustomers([])
  setItems([])
  setInvoices([])
  setPayments([])
  setReceivedDiscounts([])
  setSalesInvoices([])
  setCustomerPayments([])
  setExpenseTypes([])
  setExpenseEntries([])
  setFixedSchemes([])
  setMTBookings([])
  
  // Load data from localStorage partition
  const tenantData = getTenantData(metadata.activeCompanyId, metadata.activeFY)
  
  // Populate states
  setSuppliers(tenantData.suppliers)
  setCustomers(tenantData.customers)
  setItems(tenantData.items)
  setInvoices(tenantData.invoices)
  setPayments(tenantData.payments)
  setReceivedDiscounts(tenantData.receivedDiscounts)
  setSalesInvoices(tenantData.salesInvoices)
  setCustomerPayments(tenantData.customerPayments)
  setExpenseTypes(tenantData.expenseTypes)
  setExpenseEntries(tenantData.expenseEntries)
  setFixedSchemes(tenantData.fixedSchemes)
  setMTBookings(tenantData.mtBookings)
}, [metadata.activeCompanyId, metadata.activeFY])
```

### C. Data Persistence Logic

```typescript
// Save tenant data whenever any data state changes
useEffect(() => {
  const tenantData: TenantData = {
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
  }
  
  saveTenantData(metadata.activeCompanyId, metadata.activeFY, tenantData)
}, [suppliers, customers, items, invoices, payments, receivedDiscounts, 
    salesInvoices, customerPayments, expenseTypes, expenseEntries,
    fixedSchemes, mtBookings, metadata.activeCompanyId, metadata.activeFY])
```

### D. Business Management Handlers

```typescript
const handleBusinessCreated = (id: string, name: string, startFY: string) => {
  const newBusiness = { id, name, startFY }
  const updatedMetadata = {
    ...metadata,
    businesses: [...metadata.businesses, newBusiness],
    activeCompanyId: id,
    activeFY: startFY
  }
  setMetadata(updatedMetadata)
  saveMetadata(updatedMetadata)
  
  // Initialize empty tenant data
  saveTenantData(id, startFY, {
    suppliers: [], customers: [], items: [], invoices: [],
    payments: [], receivedDiscounts: [], salesInvoices: [],
    customerPayments: [], expenseTypes: [], expenseEntries: [],
    fixedSchemes: [], mtBookings: []
  })
  
  toast.success(`Business "${name}" created successfully`)
}

const handleBusinessUpdated = (id: string, newName: string) => {
  const updatedMetadata = {
    ...metadata,
    businesses: metadata.businesses.map(b => 
      b.id === id ? { ...b, name: newName } : b
    )
  }
  setMetadata(updatedMetadata)
  saveMetadata(updatedMetadata)
}

const handleBusinessDeleted = (id: string) => {
  // Remove all data partitions for this business
  const fyOptions = generateFYOptions()
  fyOptions.forEach(fy => {
    localStorage.removeItem(getTenantKey(id, fy))
  })
  
  // Update metadata
  const updatedMetadata = {
    businesses: metadata.businesses.filter(b => b.id !== id),
    activeCompanyId: metadata.businesses[0]?.id || '',
    activeFY: metadata.businesses[0]?.startFY || getCurrentFY()
  }
  setMetadata(updatedMetadata)
  saveMetadata(updatedMetadata)
}
```

### E. Dropdown Change Handlers

```typescript
const handleCompanyChange = (newCompanyId: string) => {
  const updatedMetadata = { ...metadata, activeCompanyId: newCompanyId }
  setMetadata(updatedMetadata)
  saveMetadata(updatedMetadata)
}

const handleFYChange = (newFY: string) => {
  const updatedMetadata = { ...metadata, activeFY: newFY }
  setMetadata(updatedMetadata)
  saveMetadata(updatedMetadata)
}
```

### F. Sidebar Header UI

Replace the existing sidebar header section (around line 893-942) with:

```tsx
<div className="px-responsive-lg py-responsive-md border-b border-sidebar-border flex-shrink-0">
  <div className="flex items-center gap-responsive-sm mb-1">
    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary via-accent to-sidebar-primary/80 flex items-center justify-center shadow-md ring-1 ring-sidebar-border/20">
      <Buildings className="h-6 w-6 text-primary-foreground drop-shadow-sm" weight="duotone" />
    </div>
    <AnimatePresence mode="wait">
      {(sidebarExpanded || isHoveringsidebar) && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.5 }}
          className="flex-1 min-w-0 space-y-1"
        >
          <div className="flex items-center gap-1">
            <select
              value={metadata.activeCompanyId}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="flex-1 text-sm font-semibold text-sidebar-foreground bg-sidebar-accent/30 border border-sidebar-border rounded-md px-2 py-1 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-colors"
            >
              {metadata.businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 flex-shrink-0 hover:bg-sidebar-accent text-sidebar-foreground" 
              title="Edit Business"
              onClick={() => setEditBusinessDialogOpen(true)}
            >
              <Gear className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 flex-shrink-0 hover:bg-sidebar-accent text-sidebar-foreground" 
              title="Add Business"
              onClick={() => setAddBusinessDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <select
            value={metadata.activeFY}
            onChange={(e) => handleFYChange(e.target.value)}
            className="w-full text-xs font-medium text-sidebar-foreground/80 bg-sidebar-accent/20 border border-sidebar-border rounded-md px-2 py-0.5 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-colors"
          >
            {generateFYOptions().map((fy) => (
              <option key={fy} value={fy}>
                {fy}
              </option>
            ))}
          </select>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</div>
```

### G. Dialog Components

Add before the closing tags of the return statement:

```tsx
<AddBusinessDialog
  open={addBusinessDialogOpen}
  onOpenChange={setAddBusinessDialogOpen}
  onBusinessCreated={handleBusinessCreated}
/>

<EditBusinessDialog
  open={editBusinessDialogOpen}
  onOpenChange={setEditBusinessDialogOpen}
  businessId={metadata.activeCompanyId}
  businessName={metadata.businesses.find(b => b.id === metadata.activeCompanyId)?.name || ''}
  onBusinessUpdated={handleBusinessUpdated}
  onBusinessDeleted={handleBusinessDeleted}
  canDelete={metadata.businesses.length > 1}
/>
```

### H. Safe Values for Page Rendering

```typescript
const safeSuppliers = suppliers || []
const safeCustomers = customers || []
const safeItems = items || []
const safeInvoices = invoices || []
const safePayments = payments || []
const safeReceivedDiscounts = receivedDiscounts || []
const safeSalesInvoices = salesInvoices || []
const safeCustomerPayments = customerPayments || []
const safeExpenseTypes = expenseTypes || []
const safeExpenseEntries = expenseEntries || []
const safeFixedSchemes = fixedSchemes || []
const safeMTBookings = mtBookings || []
const safeBusinessName = metadata.businesses.find(b => b.id === metadata.activeCompanyId)?.name || 'SK TRADERS'
const safeCurrentFY = metadata.activeFY || getCurrentFY()
```

## Key Principles

1. **Anti-Crash Protocol**: Always reset all operational states to empty arrays BEFORE loading new tenant data
2. **Data Isolation**: Each business/FY combination has its own localStorage key: `data_${companyId}_${fy}`
3. **Metadata Management**: Single source of truth in 'app_metadata' key
4. **Safe Defaults**: Always provide fallback values when rendering to avoid undefined errors
5. **Financial Year Cap**: Maximum FY is FY2039-40 (19 years from 2021)

## Testing Checklist

- [ ] Create new business successfully
- [ ] Switch between businesses without crashes
- [ ] Switch between financial years without crashes
- [ ] Edit business name
- [ ] Delete business (when multiple businesses exist)
- [ ] Cannot delete last remaining business
- [ ] Data persists after page refresh
- [ ] Backup/restore works with new structure
- [ ] Empty state renders correctly for new business/FY

## Files Modified

1. ✅ `/workspaces/spark-template/src/lib/storage-utils.ts` - FY cap implemented
2. ✅ `/workspaces/spark-template/src/components/add-business-dialog.tsx` - Created
3. ✅ `/workspaces/spark-template/src/components/edit-business-dialog.tsx` - Created
4. ⚠️ `/workspaces/spark-template/src/App.tsx` - **NEEDS COMPLETE REWRITE** (currently broken)

## Next Steps

The App.tsx file is too large (1500+ lines) to safely modify incrementally. It requires a complete rewrite following the patterns outlined above. The file should be rewritten section by section, testing each part before moving to the next.
