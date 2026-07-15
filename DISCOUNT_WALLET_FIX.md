# Discount Wallet Page - Month Filter Fix

## Problem
The month filter was breaking business logic by filtering the "Received Discounts" table strictly by the literal transaction entry date (`discountReceivedDate`). This caused historical balances to show as ₹0.00 in their respective earning months.

## Root Cause
When a payment was recorded in January but explicitly allocated to settle a November 2025 scheme/booking, it would NOT appear when the filter was set to "Nov 25" because the code was checking:
```typescript
const receivedDate = new Date(rd.discountReceivedDate)
const receivedMonth = `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, '0')}`
if (!selectedMonths.has(receivedMonth)) return sum
```

## Solution
Modified the filtering logic to be **allocation-based** instead of **date-based**:

### 1. Updated `totalReceived` calculation (lines 195-221)
**Before:** Filtered by `discountReceivedDate`
**After:** Filters by checking if the received discount has allocations linked to expected discounts in the filtered month

```typescript
if (!selectedMonths.has('all')) {
  const allocationsMatchingFilter = allocationsForRd.filter(alloc => {
    return filteredExpectedIds.has(alloc.expectedDiscountId)
  })
  
  const totalAllocatedForFilteredMonth = allocationsMatchingFilter
    .reduce((s, a) => s + a.allocatedAmount, 0)
  
  return sum + totalAllocatedForFilteredMonth
}
```

### 2. Updated `filteredReceived` calculation (lines 218-236)
**Before:** Filtered by `discountReceivedDate`
**After:** Filters by checking if any allocation from this received discount is linked to an expected discount in the filtered month

```typescript
if (!selectedMonths.has('all')) {
  const allocationsForRd = rd.type === 'annual' 
    ? annualAllocations.filter(a => a.receivedDiscountId === rd.id)
    : discountAllocations.filter(a => a.receivedDiscountId === rd.id)
  
  const hasAllocationInFilteredMonth = allocationsForRd.some(alloc => 
    filteredExpectedIds.has(alloc.expectedDiscountId)
  )
  
  if (!hasAllocationInFilteredMonth) return false
}
```

## Benefits
1. **Correct Historical Balance**: When "Nov 25" is selected, the user sees exactly how much of November's expected discount has been received, regardless of which calendar date the voucher was entered
2. **Allocation-Based Logic**: Aligns with the core principle that the received table should map against the target data source (expected discounts)
3. **Dynamic Summary Card**: The "Received Amount" summary card now dynamically sums only the filtered rows currently visible in the bottom table for the active month block
4. **No Side Effects**: Zero impact on the core `MT * rate` math or any other calculations

## Technical Details
- Uses `filteredExpectedIds` (Set of expected discount IDs for the filtered month) as the source of truth
- Checks allocation linkage via `discountAllocations` and `annualAllocations`
- Maintains separation between "Other" and "Annual" discount types
- No duplicate rendering loops, no text parsing of scheme strings

## Testing Scenarios
1. ✓ Payment recorded in January for November scheme → Appears when Nov 25 is selected
2. ✓ Payment recorded in November for November scheme → Appears when Nov 25 is selected
3. ✓ Payment recorded in November for December scheme → Does NOT appear when Nov 25 is selected
4. ✓ "Received Amount" card shows correct total matching visible rows
5. ✓ "All Months" filter shows all received discounts (original behavior preserved)
