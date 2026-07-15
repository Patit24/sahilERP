# Source-Driven Architecture - Quick Reference

## ✅ Verified Implementation

Your SK TRADERS application correctly implements source-driven architecture:

### 1. Source Data Preservation ✓
- **Invoices**: `orderDate` and `invoiceDate` stored exactly as entered
- **Payments**: `paymentDate` and `doNotApplyCD` flag preserved
- **All entities**: No auto-modification after save/edit/restore

### 2. Backup/Restore ✓
- Pure serialization (no transformation)
- Pure deserialization (no recalculation)
- All fields preserved exactly as stored

### 3. Report Calculations ✓
- All reports use `useMemo` for live calculation
- Source data (invoices, payments, etc.) is read-only in reports
- Month filters work by filtering source data first, then calculating

### 4. Edit Operations ✓
- Invoice edit preserves `orderDate` when not modified
- Payment edit preserves `doNotApplyCD` flag
- Spread operator (`...editingInvoice`) ensures all fields preserved

## Key Code Patterns

### Invoice Edit (Correct Implementation)
```typescript
const updated: PurchaseInvoice = {
  ...editingInvoice,  // Preserve all existing data
  invoiceNo: newValue,
  invoiceDate: newValue,
  orderDate: orderDate !== undefined ? orderDate : editingInvoice.orderDate,
  // ... other explicit updates only
}
```

### Restore (Correct Implementation)
```typescript
// Direct assignment - no transformation
setInvoicesRaw(data.data.invoices)
setPaymentsRaw(data.data.payments)
```

### Report Calculation (Correct Implementation)
```typescript
// Live calculation from source
const expectedDiscounts = useMemo(() => 
  calculateExpectedDiscounts(invoices, payments, suppliers, fixedSchemes),
  [invoices, payments, suppliers, fixedSchemes]
)
```

## Documentation Added

1. **App.tsx** - Architecture principle comment at top
2. **backup-utils.ts** - Data preservation documentation
3. **calculations.ts** - Source-driven calculation principles
4. **ARCHITECTURE.md** - Comprehensive architecture guide

## Future Development Guidelines

When adding new features:

1. **New User Input** → Store in `useKV` as source data
2. **New Calculation** → Implement in calculation function with `useMemo`
3. **New Report** → Calculate from source data, never store results
4. **New Edit Form** → Use spread operator to preserve all existing fields

Your application architecture is solid! All reports calculate from source data, and source data is never auto-modified.
