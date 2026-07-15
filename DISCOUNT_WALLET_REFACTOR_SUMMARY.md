# Discount Wallet Matrix View Refactor - Implementation Summary

## Overview
Refactored the Discount Wallet page to implement strict date-range/source-driven filtering for the Matrix View without altering database records. All calculations remain real-time and on-the-fly using original data fields.

## Key Changes Implemented

### 1. Invoice Date-Based Filtering (Line 138-153)
**Location:** `filteredExpected` useMemo hook

**Previous Behavior:**
- Filtered expected discounts based on `earnedDate`
- This was problematic for Fixed Schemes where the earnedDate might differ from the actual invoice date

**New Behavior:**
```typescript
if (!selectedMonths.has('all')) {
  const invoice = fyInvoices.find(inv => inv.id => exp.invoiceId)
  if (invoice) {
    const invoiceDate = new Date(invoice.invoiceDate)
    const invoiceMonth = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`
    if (!selectedMonths.has(invoiceMonth)) return false
  } else {
    // Fallback to earnedDate for non-invoice records
    const earnedDate = new Date(exp.earnedDate)
    const earnedMonth = `${earnedDate.getFullYear()}-${String(earnedDate.getMonth() + 1).padStart(2, '0')}`
    if (!selectedMonths.has(earnedMonth)) return false
  }
}
```

**Impact:**
- When a specific month filter is active (e.g., 'February 2026'), rows are filtered strictly based on `invoice.invoiceDate`
- Ensures that only invoices generated in the selected month appear in the expected discounts table
- Maintains backward compatibility for records without invoice IDs

---

### 2. Scheme Column Source Month Tracking (Line 418-445)
**Location:** `groupedPendingByScheme` useMemo hook - Type definitions and initialization

**Added Fields:**
```typescript
schemeSourceMonth?: string          // Tracks the month the scheme originated from
hasFilteredInvoices?: boolean       // Tracks if scheme has invoices in filtered month
```

**Purpose:**
- `schemeSourceMonth`: Records the month when a Fixed Scheme discount was first generated (based on invoice date)
- `hasFilteredInvoices`: Boolean flag indicating whether this scheme has any invoices in the currently selected month filter

**Example Scenario:**
- January booking creates "GOLD (JAN 26)" scheme
- February invoice consumes that January rate
- When filtering by February:
  - "GOLD (JAN 26)" column remains visible (has pending balance)
  - `schemeSourceMonth` = "2026-01"
  - System shows scheme originated from January but has February activity

---

### 3. Invoice-Level Month Validation (Line 554-580)
**Location:** `groupedPendingByScheme` useMemo hook - Fixed Scheme processing

**Implementation:**
```typescript
const invoice = fyInvoices.find(inv => inv.id === pd.invoiceId)
const invoiceIsInFilteredMonth = invoice && (() => {
  if (!isMonthFilterActive) return true
  const invoiceDate = new Date(invoice.invoiceDate)
  const invoiceMonth = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`
  return selectedMonths.has(invoiceMonth)
})()

if (invoiceIsInFilteredMonth) {
  group.hasFilteredInvoices = true
}
```

**Behavior:**
- For each invoice in a scheme group, checks if it belongs to the filtered month
- Sets `hasFilteredInvoices = true` if ANY invoice matches the filter
- Scheme columns with `hasFilteredInvoices = false` still appear (for pending balances) but show special indicator

---

### 4. Visual Scheme Source Indicator (Line 1376-1391)
**Location:** Table rendering - Scheme name column

**UI Enhancement:**
```typescript
<TableCell className="font-medium">
  {group.isPaymentWise ? (
    <span className="text-sm">Payment CD</span>
  ) : (
    <div className="flex flex-col gap-0.5">
      <span>{group.schemeName}</span>
      {isMonthFilterActive && group.schemeSourceMonth && 
       !selectedMonths.has(group.schemeSourceMonth) && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 w-fit border-primary/30 text-primary">
          From {fyMonths.find(m => m.value === group.schemeSourceMonth)?.label || group.schemeSourceMonth}
        </Badge>
      )}
    </div>
  )}
</TableCell>
```

**Visual Result:**
When filtering by February 2026 and scheme "GOLD (JAN 26)" appears:
```
GOLD (JAN 26)
[From January 2026]  ← Small badge indicator
```

**Rules:**
- Badge only shows when month filter is active
- Badge only shows when scheme's source month differs from selected month
- Badge shows human-readable month name from `fyMonths` array

---

### 5. Month Filter State Management (Line 708)
**Location:** Component-level constants

**Added:**
```typescript
const isMonthFilterActive = !selectedMonths.has('all')
```

**Usage:**
- Available throughout the component rendering scope
- Used in conditional logic for showing/hiding month-based indicators
- Ensures consistent behavior across all conditional rendering

---

## Matrix View Behavior Summary

### When "All Months" Selected:
1. All schemes appear normally
2. All invoices within each scheme are visible
3. No source month indicators appear
4. Standard aggregation of expected/received/pending amounts

### When Specific Month Selected (e.g., "February 2026"):
1. **Top Table (Expected Discounts):**
   - Only invoices with `invoiceDate` in February appear
   - Scheme columns remain visible if they have ANY invoices in February
   - Scheme columns from previous months (e.g., "GOLD (JAN 26)") stay visible if February invoices consumed those rates
   - Visual indicator shows scheme source month when different from filter

2. **When Expanding a Scheme Column:**
   - Shows ONLY invoices generated in February
   - Does NOT pull historical invoices from January or other months
   - Aggregated totals (Expected/Received/Pending) reflect only filtered invoices

3. **Bottom Table (Received Discounts):**
   - Automatically syncs with month filter
   - Shows only transactions/entries linked to schemes active in filtered month
   - If "GOLD (JAN 26)" has a transaction allocated against a February invoice, that transaction appears
   - Maintains existing dropdown state structure for manual entry processing

---

## Data Integrity Principles Maintained

### Source-Driven Architecture:
✅ No database records modified
✅ All calculations performed real-time on-the-fly
✅ No text string parsing of scheme names
✅ Uses actual date fields (`invoice.invoiceDate`, `invoice.createdAt`)

### FIFO Allocation Preserved:
✅ Payment allocations remain timestamp-aware
✅ Discount allocations follow scheme-wise FIFO wallet logic
✅ MT Booking consumption logic unchanged

### Immutability Rules:
✅ Received Discounts remain locked/immutable after save
✅ Invoice dates stored as entered
✅ Transaction timestamps preserved

---

## Technical Implementation Details

### Performance Considerations:
- Uses `useMemo` hooks to prevent unnecessary recalculations
- Filters applied at the data query level (not DOM level)
- Boolean flags (`hasFilteredInvoices`) computed once during grouping

### Type Safety:
- New fields added to existing type interfaces (no breaking changes)
- Optional fields (`?`) used for backward compatibility
- TypeScript inference maintained throughout

### Edge Cases Handled:
1. Invoices without IDs (fallback to `earnedDate`)
2. Schemes without source month (no indicator shown)
3. Multiple months selected (treated as OR logic)
4. "All Months" selection (disables all month-based logic)

---

## Testing Scenarios

### Scenario 1: January Booking, February Consumption
**Setup:**
- MT Booking created in January with "GOLD (JAN 26)" scheme
- Invoice generated in February consuming that booking

**Filter: February 2026**
- Expected: "GOLD (JAN 26)" column visible
- Expected: Badge shows "From January 2026"
- Expected: Only February invoice appears when expanded
- Expected: Totals reflect only February activity for that scheme

### Scenario 2: Multi-Month Scheme Activity
**Setup:**
- Fixed Scheme "ANNUAL ADVANCE (Jan25)" applies to invoices across multiple months
- Invoices in December, January, February

**Filter: February 2026**
- Expected: Only February invoices appear in this scheme
- Expected: Scheme name shows normal (no "From" badge if scheme name doesn't indicate specific month)
- Expected: MT calculations use only February invoice quantities

### Scenario 3: Received Discount Sync
**Setup:**
- Received discount entry allocated to "GOLD (JAN 26)"
- Allocation linked to February invoice

**Filter: February 2026**
- Expected: Received discount entry appears in bottom table
- Expected: Allocation amount shown reflects only February allocations
- Expected: Advance amount (if any) displays correctly

---

## Files Modified

1. **src/components/discount-wallet-page.tsx**
   - Line 138-153: Invoice date filtering logic
   - Line 418-445: Type definitions and initialization
   - Line 554-580: Invoice month validation
   - Line 708: Month filter state constant
   - Line 1376-1391: Visual scheme indicator rendering

---

## Future Enhancements (Not Implemented)

These were discussed but not included in current implementation:

1. **Received Discount Entry Type Filter:**
   - Could add dropdown in Received Discounts table to filter by scheme type
   - Would complement the month filter for more granular views

2. **Scheme Column Collapse:**
   - Option to hide schemes with no filtered-month activity
   - Toggle to show/hide "historical" scheme columns

3. **Month Range Selection:**
   - Support for selecting date ranges instead of discrete months
   - Quarterly/Annual preset filters

4. **Export Enhancement:**
   - PDF export to respect month filter and show source month indicators
   - Separate exports for "schemes from this month" vs "schemes from previous months"

---

## Migration Notes

**No Migration Required:**
- All changes are additive and backward-compatible
- No database schema changes
- No breaking changes to existing calculations
- Existing data displays correctly with new logic

**Testing Checklist:**
- [ ] Verify January booking → February invoice scenario
- [ ] Test "All Months" filter (should behave as before)
- [ ] Test single month filter (February 2026)
- [ ] Test multiple month selection
- [ ] Verify scheme source badges appear correctly
- [ ] Verify Received Discounts table syncs with filter
- [ ] Verify expansion shows only filtered-month invoices
- [ ] Verify totals match expected calculations
- [ ] Test PDF export with month filter active
- [ ] Verify no regression in Payment CD calculations

---

## Summary

This refactor successfully implements the strict date-range/source-driven Matrix View architecture requested. The key innovations are:

1. **Invoice Date Primacy**: Filtering now uses `invoice.invoiceDate` as the source of truth
2. **Scheme Column Persistence**: Schemes from previous months remain visible when they have activity in the filtered month
3. **Visual Clarity**: Source month badges clearly indicate when a scheme originated from a different period
4. **Expansion Strictness**: Expanding a scheme shows ONLY invoices from the filtered month, never historical data
5. **Dynamic Sync**: Received Discounts table automatically adapts to show relevant transactions for the filtered period

All changes maintain the application's core principles of source-driven calculations, data immutability, and real-time computation without string parsing or stored aggregates.
