# FIFO Allocation System Guide

## Overview

The Steel Trading ERP implements a chronological FIFO (First-In-First-Out) allocation system that automatically allocates payments to invoices based on date order. The system processes all payments and invoices together, sorted by date, and allocates them in real-time regardless of the order they were entered.

## Key Principles

### 1. Chronological Processing
All payments and invoices are processed in strict date order, regardless of when they were entered into the system.

### 2. Complete Recalculation
Every time you add a new payment or invoice, the system recalculates all allocations from scratch, ensuring perfect accuracy based on the current data.

### 3. Advance Payment Detection
The system automatically detects advance payments (payments with no matching invoices or exceeding invoice amounts) without any manual input.

### 4. Source-Driven
All allocations are calculated live from source data. No allocation data is stored - it's always computed on-demand.

## How It Works

### Chronological Processing
The system combines all payments and invoices into a single timeline, processes them in date order, and automatically allocates payments to invoices using FIFO logic.

### Per-Supplier FIFO
FIFO allocation is maintained separately for each supplier. Payments from one supplier only allocate to invoices from that same supplier.

## Impact on Discount Calculations

### Payment CD (Cash Discount)
- **Advance Payments:** Always treated as 0 days for CD calculation
- **Regular Payments:** Days calculated from payment date to invoice date
- **Rate:** Applied as percentage on payment amount

### Invoice Close CD
- Applied when invoice is fully paid
- Days calculated from invoice date to last payment date
- Rate applied per unit on quantity

### Fixed Schemes
- Applied to invoices within scheme date range
- Rate applied per unit on quantity
- Not affected by payment allocation

## User Interface Indicators

### Payment Status Badges
- **Regular:** Payment fully allocated to invoices
- **Advance:** Payment partially or fully unallocated

### Invoice Status
Shows which invoices each payment is allocated to with amounts.

## Best Practices

### 1. Enter Transactions in Any Order
Don't worry about entering payments and invoices in chronological order - the system handles the allocation automatically.

### 2. Use Correct Dates
Always use the actual transaction dates. The FIFO system relies on accurate dates for proper allocation.

### 3. Review After Adding
After adding a payment or invoice with an earlier date, review the allocations to see how the system redistributed them.

### 4. Delete with Caution
Deleting a payment or invoice triggers complete recalculation. All dependent allocations and discount calculations will update immediately.

## Technical Implementation

### Algorithm
1. Combine all payments and invoices into a single list
2. Sort by date (invoices before payments on same date)
3. Process each entry chronologically:
   - For invoices: Try to allocate from existing advance payments, if any remains, add to pending invoices queue
   - For payments: Try to allocate to pending invoices in queue, if any remains, add to advance payments queue
4. Maintain separate queues per supplier
5. Generate allocation records from all successful matches

### Data Flow
```
Source Data (Payments + Invoices)
    ↓
calculatePaymentAllocations() - FIFO Engine
    ↓
Payment Allocations (calculated)
    ↓
calculateExpectedDiscounts() - Uses allocations
    ↓
Expected Discounts (calculated)
```

### Key Functions
- `calculatePaymentAllocations()` - Main FIFO engine in `/src/lib/calculations.ts`
- `isPaymentAdvance()` - Checks if payment has unallocated amount
- All functions are pure and stateless - always calculate from source data

## Common Questions

**Q: What happens if I delete an invoice that has payments allocated to it?**
A: The payment amounts become advance payments and will automatically allocate to the next available invoice(s) in FIFO order.

**Q: Can I manually adjust allocations?**
A: No. All allocations are automatic and calculated from source data to ensure accuracy and consistency.

**Q: Do advances expire?**
A: No. Advances remain until there are invoices available to allocate them to.

**Q: How do I see which payments allocated to which invoices?**
A: In the Payments page, each payment row shows all allocations with invoice numbers and amounts.

**Q: What if I have payments and invoices on the same date?**
A: The system processes invoices before payments on the same date, ensuring payments can allocate to same-day invoices.

## Support

For issues or questions about the FIFO allocation system, refer to the PRD.md file or check the source code in `/src/lib/calculations.ts`.
