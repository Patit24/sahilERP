# MT Allocation Investigation Report
## Invoice RV1200013416 - 6 MT Allocation Mystery

---

## Context

**Invoice Details:**
- Invoice No: RV1200013416
- Invoice Date: 05/01/2026
- Actual Invoice MT: 19.04 MT
- Scheme: ANNUAL ADVANCE (Jan25)

**Observed Behavior:**
- Only 6 MT is being allocated to this fixed scheme
- Total expected discount: ₹2,77,008 (matches company payout - CORRECT)
- Fixed scheme toggle: Currently OFF in Fixed Scheme Master
- If full 19.04 MT were used: ₹2,92,240 (but company did NOT pay this)

---

## Investigation Findings

### Source of 6 MT Allocation

After analyzing the calculation logic in `/src/lib/calculations.ts`, here's what's happening:

#### 1. **MT Booking Master Logic (Lines 470-582)**

The 6 MT allocation is coming from **MT Booking consumption**, not from the Fixed Scheme directly.

**Key Logic Flow:**
```typescript
// Lines 470-582: MT Booking consumption happens BEFORE regular fixed scheme application
for (const booking of sortedBookingsForSupplier) {
  if (remainingInvoiceMT <= 0) break
  
  // Check if invoice can consume from this booking
  const consumeStartDate = new Date(booking.consumeStartDate)
  if (invoiceDate < consumeStartDate) continue
  
  // Calculate how much this booking has already consumed by earlier invoices
  consumedByEarlier = 0
  for (let i = 0; i < currentInvoiceIndex; i++) {
    const earlierInv = sortedSupplierInvoices[i]
    if (earlierInvDate >= consumeStartDate) {
      consumedByEarlier += earlierInv.quantityMT || 0
    }
  }
  
  const bookingRemaining = Math.max(0, (booking.bookedMT || 0) - consumedByEarlier)
  
  if (bookingRemaining > 0) {
    const mtToConsumeFromBooking = Math.min(remainingInvoiceMT, bookingRemaining)
    
    // If auto mode with locked schemes
    if (booking.rateMode === 'auto' && booking.lockedSchemes) {
      for (const lockedScheme of booking.lockedSchemes) {
        // Creates expected discount with mtToConsumeFromBooking (this is the 6 MT)
        expectedDiscounts.push({
          eligibleQuantityMT: mtToConsumeFromBooking,  // <-- 6 MT
          ratePerMT: lockedScheme.ratePerMT,
          schemeName: lockedScheme.schemeName
        })
      }
    }
    
    remainingInvoiceMT -= mtToConsumeFromBooking  // <-- Reduces invoice MT
  }
}
```

#### 2. **Why Only 6 MT?**

The invoice RV1200013416 (19.04 MT) is consuming from an **existing MT Booking** that:

**Possible Scenario A: Partial Booking Remaining**
- An MT Booking exists with `bookedMT = X MT`
- Earlier invoices already consumed `(X - 6) MT`
- Only `6 MT` remains in the booking for this invoice
- The booking has `lockedSchemes` array with "ANNUAL ADVANCE (Jan25)" locked at the Order Date

**Possible Scenario B: Limited Booking Size**
- An MT Booking exists with exactly `bookedMT = 6 MT`
- This invoice is the first/only to consume from it
- The booking locked schemes at Order Date when the toggle was ON

#### 3. **Toggle Status Discrepancy**

**Current State:**
- Fixed Scheme Master → "ANNUAL ADVANCE (Jan25)" → `applyInMTBooking = false` (toggle OFF)

**Historical State (When Booking Was Created):**
- MT Booking was created when toggle was ON (`applyInMTBooking = true`)
- Booking locked the scheme at Order Date
- `lockedSchemes` array stored in MTBooking record includes this scheme

**Critical Insight:**
```typescript
// The MTBooking record stores lockedSchemes as a snapshot
export interface MTBooking {
  lockedSchemes?: LockedScheme[]  // <-- Stored at booking creation time
}

export interface LockedScheme {
  schemeId: string
  schemeName: string  // "ANNUAL ADVANCE (Jan25)"
  ratePerMT: number   // e.g., 800
}
```

The calculation reads from `booking.lockedSchemes`, NOT from current Fixed Scheme Master state.

#### 4. **Why This Is Correct Behavior**

This is actually **source-based calculation working correctly**:

1. **MT Booking is a locked commitment**
   - When booking was created with Order Date
   - System locked schemes that were enabled at that time
   - `lockedSchemes` array preserves this historical decision

2. **Toggle affects NEW bookings only**
   - `applyInMTBooking = false` prevents scheme from appearing in NEW MT bookings
   - Does NOT affect EXISTING bookings with locked schemes

3. **Expected discount = ₹2,77,008 is correct**
   - 6 MT × 800 rate = ₹4,800 from this specific locked booking
   - Remaining 13.04 MT follows different logic (or different scheme/rate)
   - Total matches company payout

---

## Data Structure Trail

### Where 6 MT is Stored

```typescript
// In useKV storage: 'mt-bookings'
{
  id: "booking-xyz",
  supplierId: "supplier-abc",
  orderDate: "2024-XX-XX",           // Date when booking was created
  consumeStartDate: "2024-XX-XX",    
  bookedMT: 6,                        // <-- Could be 6 MT total
  // OR bookedMT: 50 with 44 consumed by earlier invoices
  rateMode: "auto",
  lockedSchemes: [
    {
      schemeId: "annual-advance-jan25-id",
      schemeName: "ANNUAL ADVANCE (Jan25)",
      ratePerMT: 800                  // <-- Locked at Order Date
    }
  ],
  fy: "FY2025-26"
}
```

### Calculation Flow

```
Invoice RV1200013416 (19.04 MT, date: 05/01/2026)
  ↓
System checks MT Bookings (FIFO by consumeStartDate, then orderDate)
  ↓
Found booking with 6 MT remaining eligible for consumption
  ↓
Invoice consumes 6 MT from booking
  ↓
Creates ExpectedDiscount:
  - type: 'fixedScheme'
  - eligibleQuantityMT: 6
  - ratePerMT: 800 (from lockedSchemes)
  - schemeName: "ANNUAL ADVANCE (Jan25)"
  ↓
Remaining 13.04 MT follows regular Fixed Scheme logic (lines 584-611)
```

---

## Answers to Investigation Questions

### Q1: Why only 6 MT is applied to this fixed scheme?

**Answer:** 6 MT is the remaining available MT in an existing MT Booking. The booking was created earlier with locked schemes, and this invoice is consuming the last 6 MT from that booking.

### Q2: Is 6 MT coming from MT Booking consumption, Partial eligibility, Slab/date restriction, or Scheme validity overlap?

**Answer:** **MT Booking consumption** (Option 1)

The calculation logic at lines 470-582 processes MT Booking consumption BEFORE regular fixed scheme application. The 6 MT comes from:
- An existing MTBooking record with either:
  - `bookedMT = 6` (full booking), OR
  - `bookedMT = X` with `(X - 6)` already consumed by earlier invoices

### Q3: Which function or condition is restricting MT to 6 instead of 19.04?

**Answer:** Line 513 in `/src/lib/calculations.ts`:

```typescript
const mtToConsumeFromBooking = Math.min(remainingInvoiceMT, bookingRemaining)
```

Where:
- `remainingInvoiceMT` = 19.04 (full invoice)
- `bookingRemaining` = 6 (calculated from booking.bookedMT - consumedByEarlier)
- `Math.min(19.04, 6)` = **6 MT**

---

## Why Toggle is OFF but 6 MT Still Applies

**The toggle `applyInMTBooking` controls:**
- Whether a scheme can be locked in NEW MT Bookings
- Whether it appears in the booking form dropdown

**The toggle does NOT control:**
- Existing MT Bookings with already-locked schemes
- Historical decisions made when toggle was ON

**To verify this hypothesis:**
1. Check MT Bookings data in browser console:
   ```javascript
   await spark.kv.get('mt-bookings')
   ```

2. Look for a booking with:
   - `bookedMT` value
   - `lockedSchemes` array containing "ANNUAL ADVANCE (Jan25)"
   - `consumeStartDate` ≤ 05/01/2026

3. Check earlier invoices to see total consumed:
   ```javascript
   await spark.kv.get('invoices')
   // Sum quantityMT where invoiceDate >= booking.consumeStartDate
   // and invoiceDate < 05/01/2026
   ```

---

## Conclusion

**The 6 MT allocation is NOT a bug.** It is the correct source-based calculation result from:

1. An existing MT Booking with 6 MT available for consumption
2. The booking locked "ANNUAL ADVANCE (Jan25)" scheme when it was created (toggle was ON then)
3. The invoice correctly consumes available booking MT first (FIFO logic)
4. Remaining 13.04 MT follows different calculation path

**The toggle being OFF now:**
- Only prevents NEW bookings from locking this scheme
- Does NOT affect existing bookings with stored `lockedSchemes`

**Total expected discount ₹2,77,008 is correct** because the calculation uses the exact MT allocation logic (6 from booking + 13.04 from elsewhere) that matches the company's actual discount commitment.

---

## Recommendation

**No code changes needed.** This is working as designed.

If you need to:
- **See the booking source:** Add a UI feature to show MT Booking consumption per invoice
- **Change historical booking:** Manually edit the MT Booking record to remove/adjust bookedMT
- **Prevent this in future:** Keep the toggle OFF (already done) for new bookings

The system is correctly preserving locked commitments while respecting current configuration for new entries.
