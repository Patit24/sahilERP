/*
 * CALCULATION ENGINE
 * ==================
 * 
 * SOURCE-DRIVEN CALCULATION PRINCIPLE
 * 
 * All functions in this file calculate from source data in real-time.
 * These calculations NEVER modify source data - they only read and compute.
 * 
 * Source Data (Read-Only):
 *   - Invoices (invoiceDate, items, amounts, createdAt timestamp)
 *   - Payments (paymentDate, amounts, doNotApplyCD flag, createdAt timestamp)
 *   - Received Discounts (amount, date - IMMUTABLE once recorded)
 *   - Suppliers (CD rules, annual targets, advance CD percentage)
 *   - Fixed Schemes (discount rules - apply based on Invoice Date only)
 *   - MT Booking Master (with Order Date for scheme locking)
 * 
 * Computed Data (Live Calculation):
 *   - Payment allocations (FIFO, timestamp-aware)
 *   - Expected discounts (by type)
 *   - Pending discounts
 *   - Month-wise aggregations
 * 
 * RECEIVED DISCOUNT IMMUTABILITY (CRITICAL):
 *   - Received Discounts are treated as LOCKED, REALIZED events
 *   - Once recorded, received discount amounts NEVER change automatically
 *   - If expected discount changes (e.g., invoice date edit), the variance
 *     appears as Over-Received or Under-Received, NOT by modifying received amount
 *   - Allocation logic maps received to expected but preserves received amounts
 *   - Only user can manually edit/delete a received discount entry
 * 
 * TIMESTAMP-AWARE LOGIC:
 *   - Every Invoice and Payment has a createdAt timestamp (milliseconds)
 *   - FIFO sorting uses (date + timestamp), not date only
 *   - For same-day transactions, createdAt determines chronological order
 *   - Advance CD eligibility is determined at payment time using timestamp comparison
 *   - Once marked as Advance CD, never downgrades to regular CD
 * 
 * Date Usage Rules:
 *   - Fixed Scheme CD: Uses invoiceDate for eligibility (NOT order date)
 *   - MT Booking: Uses orderDate ONLY for locking schemes at booking time
 *   - Payment CD: Uses paymentDate (day-based, invoice must exist before payment)
 *   - Advance CD: Uses paymentDate (applies to advance portion only, not day-based)
 *   - Invoice Close CD: Uses date when invoice is fully paid (FIFO)
 *   - Annual Discount: Calculated on total MT (no date-based eligibility)
 * 
 * Advance Payment CD Rules (CRITICAL):
 *   - Advance is any payment amount not mapped to an invoice at payment time
 *   - Advance CD (3%) applies ONLY to the unallocated payment amount
 *   - When advance payment later gets allocated to invoice, it uses REGULAR CD slabs (not advance)
 *   - Advance CD is NOT day-based; Regular CD is day-based
 *   - Example: ₹10L payment with ₹3L outstanding:
 *     * ₹3L allocation → Regular CD based on days (e.g., 2.75%)
 *     * ₹7L unallocated → Advance CD (3%)
 *   - System respects transaction timestamps for FIFO allocation order
 *   - Outstanding balance is calculated from only earlier timestamps
 *   - Once allocated, ALL amounts use regular CD calculation
 * 
 * All calculations respect month filters by filtering source data first,
 * then calculating. No pre-computed values are stored.
 */

import {
  PurchaseInvoice,
  Payment,
  PaymentAllocation,
  PaymentAdvanceInfo,
  ReceivedDiscount,
  ExpectedDiscount,
  PendingDiscount,
  Supplier,
  ExpectedAnnualDiscount,
  PendingAnnualDiscount,
  DiscountAllocation,
  FixedScheme,
  MTBooking
} from './types'

export function calculatePaymentAllocations(
  payments: Payment[],
  invoices: PurchaseInvoice[]
): { allocations: PaymentAllocation[]; paymentAdvanceInfo: Map<string, PaymentAdvanceInfo> } {
  const allocations: PaymentAllocation[] = []
  const paymentAdvanceInfo = new Map<string, PaymentAdvanceInfo>()
  const allocationIsAdvanceGlobal = new Map<string, boolean>()
  
  type Entry = 
    | { type: 'invoice'; date: Date; timestamp: number; data: PurchaseInvoice }
    | { type: 'payment'; date: Date; timestamp: number; data: Payment }
  
  const entries: Entry[] = [
    ...invoices.map(inv => {
      const dateTimestamp = new Date(inv.invoiceDate).getTime()
      const timestamp = inv.createdAt || dateTimestamp
      return { 
        type: 'invoice' as const, 
        date: new Date(inv.invoiceDate),
        timestamp,
        data: inv 
      }
    }),
    ...payments.map(pay => {
      const dateTimestamp = new Date(pay.paymentDate).getTime()
      const timestamp = pay.createdAt || dateTimestamp
      return { 
        type: 'payment' as const, 
        date: new Date(pay.paymentDate),
        timestamp,
        data: pay 
      }
    })
  ]
  
  entries.sort((a, b) => {
    const dateA = a.date.toISOString().split('T')[0]
    const dateB = b.date.toISOString().split('T')[0]
    
    if (dateA !== dateB) {
      return a.date.getTime() - b.date.getTime()
    }
    
    const timeDiff = a.timestamp - b.timestamp
    if (timeDiff !== 0) return timeDiff
    
    if (a.type === 'invoice' && b.type === 'payment') return -1
    if (a.type === 'payment' && b.type === 'invoice') return 1
    return 0
  })
  
  const supplierState = new Map<string, {
    pendingInvoices: { invoice: PurchaseInvoice; balance: number }[]
    advancePayments: { payment: Payment; balance: number; wasAdvanceAtPaymentTime: boolean }[]
    totalOutstanding: number
  }>()
  
  for (const entry of entries) {
    if (entry.type === 'invoice') {
      const invoice = entry.data
      const supplierId = invoice.supplierId
      
      if (!supplierState.has(supplierId)) {
        supplierState.set(supplierId, { pendingInvoices: [], advancePayments: [], totalOutstanding: 0 })
      }
      
      const state = supplierState.get(supplierId)!
      let remainingInvoice = invoice.invoiceAmount
      let loopCounter = 0
      const maxLoops = 10000
      
      while (state.advancePayments.length > 0 && remainingInvoice > 0 && loopCounter < maxLoops) {
        loopCounter++
        const advancePayment = state.advancePayments[0]
        if (!advancePayment || advancePayment.balance <= 0) {
          state.advancePayments.shift()
          continue
        }
        const allocationAmount = Math.min(remainingInvoice, advancePayment.balance)
        
        if (allocationAmount <= 0) break
        
        const allocationId = `${advancePayment.payment.id}-${invoice.id}-${allocations.length}`
        
        allocations.push({
          id: allocationId,
          paymentId: advancePayment.payment.id,
          invoiceId: invoice.id,
          allocatedAmount: allocationAmount,
          fy: invoice.fy
        })
        
        allocationIsAdvanceGlobal.set(allocationId, advancePayment.wasAdvanceAtPaymentTime)
        
        remainingInvoice -= allocationAmount
        advancePayment.balance -= allocationAmount
        
        if (advancePayment.balance <= 0) {
          state.advancePayments.shift()
        }
      }
      
      if (remainingInvoice > 0) {
        state.pendingInvoices.push({
          invoice,
          balance: remainingInvoice
        })
        state.totalOutstanding += remainingInvoice
      }
      
    } else {
      const payment = entry.data
      const supplierId = payment.supplierId
      
      if (!supplierState.has(supplierId)) {
        supplierState.set(supplierId, { pendingInvoices: [], advancePayments: [], totalOutstanding: 0 })
      }
      
      const state = supplierState.get(supplierId)!
      const outstandingAtPaymentTime = state.totalOutstanding
      let remainingPayment = payment.amount
      let allocatedToExistingInvoices = 0
      let loopCounter = 0
      const maxLoops = 10000
      
      while (state.pendingInvoices.length > 0 && remainingPayment > 0 && loopCounter < maxLoops) {
        loopCounter++
        const pendingInvoice = state.pendingInvoices[0]
        if (!pendingInvoice || pendingInvoice.balance <= 0) {
          state.pendingInvoices.shift()
          continue
        }
        const allocationAmount = Math.min(remainingPayment, pendingInvoice.balance)
        
        if (allocationAmount <= 0) break
        
        const allocationId = `${payment.id}-${pendingInvoice.invoice.id}-${allocations.length}`
        
        allocations.push({
          id: allocationId,
          paymentId: payment.id,
          invoiceId: pendingInvoice.invoice.id,
          allocatedAmount: allocationAmount,
          fy: payment.fy
        })
        
        allocationIsAdvanceGlobal.set(allocationId, false)
        
        remainingPayment -= allocationAmount
        pendingInvoice.balance -= allocationAmount
        state.totalOutstanding -= allocationAmount
        allocatedToExistingInvoices += allocationAmount
        
        if (pendingInvoice.balance <= 0) {
          state.pendingInvoices.shift()
        }
      }
      
      const advanceAmount = remainingPayment
      const wasAdvance = advanceAmount > 0
      
      console.log(`Payment ${payment.id} (${payment.paymentDate}):`, {
        paymentAmount: payment.amount,
        outstandingAtPaymentTime,
        allocatedToExistingInvoices,
        advanceAmount,
        advancePercentage: (advanceAmount / payment.amount) * 100
      })
      
      paymentAdvanceInfo.set(payment.id, {
        paymentId: payment.id,
        advanceAmount: advanceAmount,
        allocatedAmount: allocatedToExistingInvoices,
        outstandingAtPaymentTime: outstandingAtPaymentTime,
        allocationIsAdvanceMap: allocationIsAdvanceGlobal
      })
      
      if (remainingPayment > 0) {
        state.advancePayments.push({
          payment,
          balance: remainingPayment,
          wasAdvanceAtPaymentTime: true
        })
      }
    }
  }
  
  return { allocations, paymentAdvanceInfo }
}

export function isPaymentAdvance(
  payment: Payment,
  paymentAllocations: PaymentAllocation[]
): boolean {
  if (payment.isAdvance) return true

  const allocatedAmount = paymentAllocations
    .filter(a => a.paymentId === payment.id)
    .reduce((sum, a) => sum + a.allocatedAmount, 0)
  
  return allocatedAmount < payment.amount
}

export function calculateExpectedDiscounts(
  invoices: PurchaseInvoice[],
  payments: Payment[],
  paymentAllocations: PaymentAllocation[],
  paymentAdvanceInfo: Map<string, PaymentAdvanceInfo>,
  suppliers: Supplier[],
  fixedSchemes: FixedScheme[] = [],
  mtBookings: MTBooking[] = []
): ExpectedDiscount[] {
  const expectedDiscounts: ExpectedDiscount[] = []
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]))
  const paymentMap = new Map(payments.map(pay => [pay.id, pay]))
  
  type PaymentAllocationWithTracking = {
    allocation: PaymentAllocation
    advanceRemaining: number
    regularRemaining: number
  }
  
  const paymentAllocationTracking = new Map<string, PaymentAllocationWithTracking[]>()
  
  for (const payment of payments) {
    const supplier = supplierMap.get(payment.supplierId)
    if (!supplier || payment.doNotApplyCD) continue
    
    const advanceInfo = paymentAdvanceInfo.get(payment.id)
    if (!advanceInfo) continue
    
    const paymentAllocsForThisPayment = paymentAllocations.filter(a => a.paymentId === payment.id)
    
    const trackingList: PaymentAllocationWithTracking[] = []
    
    for (const allocation of paymentAllocsForThisPayment) {
      const invoice = invoiceMap.get(allocation.invoiceId)
      if (!invoice) continue
      
      const isAdvanceAllocation = advanceInfo.allocationIsAdvanceMap.get(allocation.id) === true
      
      trackingList.push({
        allocation,
        advanceRemaining: isAdvanceAllocation ? allocation.allocatedAmount : 0,
        regularRemaining: isAdvanceAllocation ? 0 : allocation.allocatedAmount
      })
    }
    
    paymentAllocationTracking.set(payment.id, trackingList)
  }
  
  for (const payment of payments) {
    const supplier = supplierMap.get(payment.supplierId)
    if (!supplier || payment.doNotApplyCD) continue
    
    const trackingList = paymentAllocationTracking.get(payment.id)
    if (!trackingList) continue
    
    for (const tracking of trackingList) {
      const allocation = tracking.allocation
      const invoice = invoiceMap.get(allocation.invoiceId)
      if (!invoice) continue
      
      const regularAmount = tracking.regularRemaining
      
      if (regularAmount > 0) {
        const invoiceDate = new Date(invoice.invoiceDate)
        const paymentDate = new Date(payment.paymentDate)
        invoiceDate.setHours(0, 0, 0, 0)
        paymentDate.setHours(0, 0, 0, 0)
        
        const calculatedDays = Math.floor(
          (paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        
        const paymentDays = Math.max(0, calculatedDays)
        
        const paymentCDRule = supplier.paymentCDRules?.find(
          rule => paymentDays >= rule.minDays && paymentDays <= rule.maxDays
        )
        
        if (paymentCDRule) {
          const discountAmount = (regularAmount * paymentCDRule.percentageRate) / 100
          
          expectedDiscounts.push({
            id: `paymentCD-${allocation.id}`,
            supplierId: supplier.id,
            invoiceId: invoice.id,
            paymentId: payment.id,
            type: 'paymentCD',
            earnedDate: payment.paymentDate,
            invoiceDate: invoice.invoiceDate,
            eligibleQuantityMT: 0,
            ratePerMT: 0,
            expectedAmount: discountAmount,
            invoiceNo: invoice.invoiceNo
          })
        }
      }
    }
  }
  
  for (const payment of payments) {
    const supplier = supplierMap.get(payment.supplierId)
    if (!supplier || payment.doNotApplyCD) continue
    
    const advanceInfo = paymentAdvanceInfo.get(payment.id)
    if (!advanceInfo || advanceInfo.advanceAmount <= 0) continue
    
    if (supplier.advanceCDPercentage && supplier.advanceCDPercentage > 0) {
      const advanceAmount = advanceInfo.advanceAmount
      const discountAmount = (advanceAmount * supplier.advanceCDPercentage) / 100
      
      expectedDiscounts.push({
        id: `advanceCD-unallocated-${payment.id}`,
        supplierId: supplier.id,
        paymentId: payment.id,
        type: 'advanceCD',
        earnedDate: payment.paymentDate,
        eligibleQuantityMT: 0,
        ratePerMT: 0,
        expectedAmount: discountAmount,
        schemeName: `Advance Payment (${supplier.advanceCDPercentage}%)`
      })
    }
  }
  
  const supplierInvoicesByDate = new Map<string, PurchaseInvoice[]>()
  for (const invoice of invoices) {
    const key = invoice.supplierId
    if (!supplierInvoicesByDate.has(key)) {
      supplierInvoicesByDate.set(key, [])
    }
    supplierInvoicesByDate.get(key)!.push(invoice)
  }
  
  for (const [supplierId, supplierInvoices] of supplierInvoicesByDate.entries()) {
    supplierInvoices.sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime())
  }
  
  const bookingTotalConsumed = new Map<string, number>()
  
  for (const invoice of invoices) {
    const supplier = supplierMap.get(invoice.supplierId)
    if (!supplier) continue
    
    const invoiceAllocations = paymentAllocations.filter(
      a => a.invoiceId === invoice.id
    )
    
    const totalAllocated = invoiceAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
    const isFullyPaid = totalAllocated >= invoice.invoiceAmount
    
    if (isFullyPaid && supplier.invoiceCloseCDRules && supplier.invoiceCloseCDRules.length > 0) {
      const lastPayment = payments
        .filter(p => invoiceAllocations.some(a => a.paymentId === p.id))
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())[0]
      
      if (lastPayment && !lastPayment.doNotApplyCD) {
        const calculatedDaysSinceInvoice = Math.floor(
          (new Date(lastPayment.paymentDate).getTime() - 
           new Date(invoice.invoiceDate).getTime()) / 
          (1000 * 60 * 60 * 24)
        )
        
        const daysSinceInvoice = Math.max(0, calculatedDaysSinceInvoice)
        
        const maxSlabDays = Math.max(...supplier.invoiceCloseCDRules.map(rule => rule.maxDays))
        
        if (daysSinceInvoice <= maxSlabDays) {
          const invoiceCloseCDRule = supplier.invoiceCloseCDRules.find(
            rule => daysSinceInvoice >= rule.minDays && daysSinceInvoice <= rule.maxDays
          )
          
          if (invoiceCloseCDRule) {
            expectedDiscounts.push({
              id: `invoiceCloseCD-${invoice.id}`,
              supplierId: supplier.id,
              invoiceId: invoice.id,
              type: 'invoiceCloseCD',
              earnedDate: lastPayment.paymentDate,
              invoiceDate: invoice.invoiceDate,
              eligibleQuantityMT: invoice.quantityMT,
              ratePerMT: invoiceCloseCDRule.ratePerMT,
              expectedAmount: invoice.quantityMT * invoiceCloseCDRule.ratePerMT,
              invoiceNo: invoice.invoiceNo
            })
          }
        }
      }
    }
    
    const sortedBookingsForSupplier = mtBookings
      .filter(b => b.supplierId === supplier.id)
      .sort((a, b) => {
        const dateA = new Date(a.consumeStartDate).getTime()
        const dateB = new Date(b.consumeStartDate).getTime()
        if (dateA !== dateB) return dateA - dateB
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
      })
    
    const invoiceDate = new Date(invoice.invoiceDate)
    let remainingInvoiceMT = invoice.quantityMT
    
    for (const booking of sortedBookingsForSupplier) {
      if (remainingInvoiceMT <= 0) break
      
      const consumeStartDate = new Date(booking.consumeStartDate)
      if (invoiceDate < consumeStartDate) continue
      
      const consumedByThisBooking = bookingTotalConsumed.get(booking.id) || 0
      const bookingRemaining = Math.max(0, (booking.bookedMT || 0) - consumedByThisBooking)
      
      if (bookingRemaining > 0) {
        const mtToConsumeFromBooking = Math.min(remainingInvoiceMT, bookingRemaining)
        
        if (booking.rateMode === 'manual' && booking.manualRate !== undefined) {
          expectedDiscounts.push({
            id: `fixedScheme-booking-manual-${invoice.id}-${booking.id}`,
            supplierId: supplier.id,
            invoiceId: invoice.id,
            schemeId: 'manual-mt-booking',
            type: 'fixedScheme',
            earnedDate: invoice.invoiceDate,
            invoiceDate: invoice.invoiceDate,
            eligibleQuantityMT: mtToConsumeFromBooking,
            ratePerMT: booking.manualRate,
            expectedAmount: mtToConsumeFromBooking * booking.manualRate,
            invoiceNo: invoice.invoiceNo,
            schemeName: 'Manual MT Booking'
          })
        } else if (booking.rateMode === 'auto' && booking.lockedSchemes && booking.lockedSchemes.length > 0) {
          for (const lockedScheme of booking.lockedSchemes) {
            expectedDiscounts.push({
              id: `fixedScheme-booking-${invoice.id}-${booking.id}-${lockedScheme.schemeId}`,
              supplierId: supplier.id,
              invoiceId: invoice.id,
              schemeId: lockedScheme.schemeId,
              type: 'fixedScheme',
              earnedDate: invoice.invoiceDate,
              invoiceDate: invoice.invoiceDate,
              eligibleQuantityMT: mtToConsumeFromBooking,
              ratePerMT: lockedScheme.ratePerMT,
              expectedAmount: mtToConsumeFromBooking * lockedScheme.ratePerMT,
              invoiceNo: invoice.invoiceNo,
              schemeName: lockedScheme.schemeName
            })
          }
        }
        
        remainingInvoiceMT -= mtToConsumeFromBooking
        bookingTotalConsumed.set(booking.id, consumedByThisBooking + mtToConsumeFromBooking)
      }
    }
    
    const excludedFromBookingSchemes = fixedSchemes.filter(scheme => {
      if (scheme.supplierId !== supplier.id) return false
      if (scheme.applyInMTBooking !== false) return false
      
      const checkDate = new Date(invoice.invoiceDate)
      const fromDate = new Date(scheme.fromDate)
      const toDate = new Date(scheme.toDate)
      
      return checkDate >= fromDate && checkDate <= toDate
    })
    
    for (const scheme of excludedFromBookingSchemes) {
      expectedDiscounts.push({
        id: `fixedScheme-${invoice.id}-${scheme.id}-booking-excluded`,
        supplierId: supplier.id,
        invoiceId: invoice.id,
        schemeId: scheme.id,
        type: 'fixedScheme',
        earnedDate: invoice.invoiceDate,
        invoiceDate: invoice.invoiceDate,
        eligibleQuantityMT: invoice.quantityMT,
        ratePerMT: scheme.ratePerMT,
        expectedAmount: invoice.quantityMT * scheme.ratePerMT,
        invoiceNo: invoice.invoiceNo,
        schemeName: scheme.schemeName
      })
    }
    
    if (remainingInvoiceMT > 0) {
      const applicableSchemes = fixedSchemes.filter(scheme => {
        if (scheme.supplierId !== supplier.id) return false
        if (scheme.applyInMTBooking === false) return false
        
        const checkDate = new Date(invoice.invoiceDate)
        const fromDate = new Date(scheme.fromDate)
        const toDate = new Date(scheme.toDate)
        
        return checkDate >= fromDate && checkDate <= toDate
      })
      
      for (const scheme of applicableSchemes) {
        expectedDiscounts.push({
          id: `fixedScheme-${invoice.id}-${scheme.id}`,
          supplierId: supplier.id,
          invoiceId: invoice.id,
          schemeId: scheme.id,
          type: 'fixedScheme',
          earnedDate: invoice.invoiceDate,
          invoiceDate: invoice.invoiceDate,
          eligibleQuantityMT: remainingInvoiceMT,
          ratePerMT: scheme.ratePerMT,
          expectedAmount: remainingInvoiceMT * scheme.ratePerMT,
          invoiceNo: invoice.invoiceNo,
          schemeName: scheme.schemeName
        })
      }
    }
  }
  
  return expectedDiscounts
}

export function calculateDiscountAllocations(
  receivedDiscounts: ReceivedDiscount[],
  expectedDiscounts: ExpectedDiscount[]
): { allocations: DiscountAllocation[]; receivedStatus: Map<string, { allocated: number; advance: number }> } {
  const allocations: DiscountAllocation[] = []
  const receivedStatus = new Map<string, { allocated: number; advance: number }>()
  
  const sortedReceived = [...receivedDiscounts]
    .filter(rd => rd.type === 'wallet')
    .sort((a, b) => 
      new Date(a.discountReceivedDate).getTime() - new Date(b.discountReceivedDate).getTime()
    )
  
  type SchemeWallet = {
    supplierId: string
    schemeKey: string
    expectedEntries: Array<{
      expected: ExpectedDiscount
      remainingBalance: number
    }>
    totalExpected: number
  }
  
  const schemeWallets = new Map<string, SchemeWallet>()
  
  for (const expected of expectedDiscounts) {
    let schemeKey: string
    
    if (expected.type === 'paymentCD' || expected.type === 'advanceCD') {
      schemeKey = 'paymentCD'
    } else if (expected.type === 'fixedScheme') {
      schemeKey = `fixedScheme:${expected.schemeName || 'unknown'}`
    } else if (expected.type === 'invoiceCloseCD') {
      schemeKey = 'invoiceCloseCD'
    } else {
      continue
    }
    
    const walletKey = `${expected.supplierId}|${schemeKey}`
    
    if (!schemeWallets.has(walletKey)) {
      schemeWallets.set(walletKey, {
        supplierId: expected.supplierId,
        schemeKey,
        expectedEntries: [],
        totalExpected: 0
      })
    }
    
    const wallet = schemeWallets.get(walletKey)!
    wallet.expectedEntries.push({
      expected,
      remainingBalance: expected.expectedAmount
    })
    wallet.totalExpected += expected.expectedAmount
  }
  
  for (const wallet of schemeWallets.values()) {
    wallet.expectedEntries.sort((a, b) => 
      new Date(a.expected.earnedDate).getTime() - new Date(b.expected.earnedDate).getTime()
    )
  }
  
  const expectedAllocatedTracker = new Map<string, number>()
  
  for (const received of sortedReceived) {
    const receivedAmount = received.amount
    let allocatedAmount = 0
    
    let targetSchemeKey: string | null = null
    if (received.allocateToDiscountType) {
      const allocateType = received.allocateToDiscountType
      
      if (allocateType === 'paymentCD' || allocateType === 'advanceCD') {
        targetSchemeKey = 'paymentCD'
      } else if (allocateType === 'fixedScheme') {
        if (received.allocateToSchemeName) {
          targetSchemeKey = `fixedScheme:${received.allocateToSchemeName}`
        } else {
          targetSchemeKey = 'fixedScheme:'
        }
      } else if (allocateType === 'invoiceCloseCD') {
        targetSchemeKey = 'invoiceCloseCD'
      }
    }
    
    const eligibleWallets: SchemeWallet[] = []
    for (const wallet of schemeWallets.values()) {
      if (wallet.supplierId !== received.supplierId) continue
      
      if (targetSchemeKey !== null) {
        if (targetSchemeKey.startsWith('fixedScheme:') && wallet.schemeKey.startsWith('fixedScheme:')) {
          if (received.allocateToSchemeName) {
            if (wallet.schemeKey !== targetSchemeKey) continue
          }
        } else if (wallet.schemeKey !== targetSchemeKey) {
          continue
        }
      }
      
      eligibleWallets.push(wallet)
    }
    
    eligibleWallets.sort((a, b) => {
      const aFirstDate = a.expectedEntries[0]?.expected.earnedDate || ''
      const bFirstDate = b.expectedEntries[0]?.expected.earnedDate || ''
      return new Date(aFirstDate).getTime() - new Date(bFirstDate).getTime()
    })
    
    for (const wallet of eligibleWallets) {
      if (allocatedAmount >= receivedAmount) break
      
      for (const entry of wallet.expectedEntries) {
        if (allocatedAmount >= receivedAmount) break
        
        const alreadyAllocatedToExpected = expectedAllocatedTracker.get(entry.expected.id) || 0
        const availableBalance = entry.expected.expectedAmount - alreadyAllocatedToExpected
        
        if (availableBalance <= 0) continue
        
        const remainingToAllocate = receivedAmount - allocatedAmount
        const allocationAmount = Math.min(remainingToAllocate, availableBalance)
        
        if (allocationAmount > 0) {
          allocations.push({
            id: `${received.id}-${entry.expected.id}-${allocations.length}`,
            receivedDiscountId: received.id,
            expectedDiscountId: entry.expected.id,
            allocatedAmount: allocationAmount
          })
          
          expectedAllocatedTracker.set(
            entry.expected.id,
            alreadyAllocatedToExpected + allocationAmount
          )
          allocatedAmount += allocationAmount
        }
      }
    }
    
    const advance = receivedAmount - allocatedAmount
    
    receivedStatus.set(received.id, {
      allocated: allocatedAmount,
      advance: advance
    })
  }
  
  return { allocations, receivedStatus }
}

export function calculatePendingDiscounts(
  expectedDiscounts: ExpectedDiscount[],
  discountAllocations: DiscountAllocation[],
  suppliers: Supplier[]
): PendingDiscount[] {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  
  return expectedDiscounts.map(expected => {
    const allocations = discountAllocations.filter(
      a => a.expectedDiscountId === expected.id
    )
    
    const receivedAmount = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
    const pendingAmount = expected.expectedAmount - receivedAmount
    
    let status: 'Pending' | 'Partially Received' | 'Received' = 'Pending'
    if (receivedAmount >= expected.expectedAmount) {
      status = 'Received'
    } else if (receivedAmount > 0) {
      status = 'Partially Received'
    }
    
    const supplier = supplierMap.get(expected.supplierId)
    
    return {
      ...expected,
      receivedAmount,
      pendingAmount,
      status
    }
  })
}

export function calculateExpectedAnnualDiscounts(
  invoices: PurchaseInvoice[],
  suppliers: Supplier[]
): ExpectedAnnualDiscount[] {
  const expectedAnnual: ExpectedAnnualDiscount[] = []
  
  const supplierAchievedMT = new Map<string, number>()
  
  for (const invoice of invoices) {
    const current = supplierAchievedMT.get(invoice.supplierId) || 0
    supplierAchievedMT.set(invoice.supplierId, current + invoice.quantityMT)
  }
  
  for (const supplier of suppliers) {
    if (!supplier.annualTarget) continue
    
    const achievedMT = supplierAchievedMT.get(supplier.id) || 0
    const expectedAmount = achievedMT * supplier.annualTarget.ratePerMT
    
    expectedAnnual.push({
      id: `annual-${supplier.id}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      targetMT: supplier.annualTarget.targetMT,
      achievedMT,
      ratePerMT: supplier.annualTarget.ratePerMT,
      expectedAmount
    })
  }
  
  return expectedAnnual
}

export function calculateAnnualDiscountAllocations(
  receivedDiscounts: ReceivedDiscount[],
  expectedAnnual: ExpectedAnnualDiscount[]
): { allocations: DiscountAllocation[]; receivedStatus: Map<string, { allocated: number; advance: number }> } {
  const allocations: DiscountAllocation[] = []
  const receivedStatus = new Map<string, { allocated: number; advance: number }>()
  
  const sortedReceived = [...receivedDiscounts]
    .filter(rd => rd.type === 'annual')
    .sort((a, b) => 
      new Date(a.discountReceivedDate).getTime() - new Date(b.discountReceivedDate).getTime()
    )
  
  const expectedBalances = new Map(
    expectedAnnual.map(exp => [exp.id, exp.expectedAmount])
  )
  
  for (const received of sortedReceived) {
    const receivedAmount = received.amount
    let allocatedAmount = 0
    
    for (const expected of expectedAnnual) {
      if (expected.supplierId !== received.supplierId) continue
      
      const expectedBalance = expectedBalances.get(expected.id) || 0
      if (expectedBalance <= 0) continue
      
      const remainingToAllocate = receivedAmount - allocatedAmount
      if (remainingToAllocate <= 0) break
      
      const allocationAmount = Math.min(remainingToAllocate, expectedBalance)
      
      allocations.push({
        id: `annual-${received.id}-${expected.id}-${allocations.length}`,
        receivedDiscountId: received.id,
        expectedDiscountId: expected.id,
        allocatedAmount: allocationAmount
      })
      
      expectedBalances.set(expected.id, expectedBalance - allocationAmount)
      allocatedAmount += allocationAmount
    }
    
    const advance = receivedAmount - allocatedAmount
    
    receivedStatus.set(received.id, {
      allocated: allocatedAmount,
      advance: advance
    })
  }
  
  return { allocations, receivedStatus }
}

export function calculatePendingAnnualDiscounts(
  expectedAnnual: ExpectedAnnualDiscount[],
  annualAllocations: DiscountAllocation[]
): PendingAnnualDiscount[] {
  return expectedAnnual.map(expected => {
    const allocations = annualAllocations.filter(
      a => a.expectedDiscountId === expected.id
    )
    
    const receivedAmount = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
    const pendingAmount = expected.expectedAmount - receivedAmount
    
    let status: 'Pending' | 'Partially Received' | 'Received' = 'Pending'
    if (receivedAmount >= expected.expectedAmount) {
      status = 'Received'
    } else if (receivedAmount > 0) {
      status = 'Partially Received'
    }
    
    return {
      ...expected,
      receivedAmount,
      pendingAmount,
      status
    }
  })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatMT(mt: number): string {
  return `${mt.toFixed(2)} MT`
}

export function getCurrentFY(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  
  if (month >= 4) {
    return `FY${year}-${(year + 1).toString().slice(2)}`
  } else {
    return `FY${year - 1}-${year.toString().slice(2)}`
  }
}

export function getFYMonths(fy: string): { value: string; label: string }[] {
  const yearMatch = fy.match(/FY(\d{4})-(\d{2})/)
  if (!yearMatch) return []
  
  const startYear = parseInt(yearMatch[1])
  const endYear = parseInt('20' + yearMatch[2])
  
  const months: { value: string; label: string }[] = []
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  for (let m = 3; m < 15; m++) {
    const monthIndex = m % 12
    const year = m < 12 ? startYear : endYear
    const monthValue = `${year}-${String(monthIndex + 1).padStart(2, '0')}`
    const shortYear = year.toString().slice(2)
    const monthLabel = `${monthNames[monthIndex]} ${shortYear}`
    months.push({ value: monthValue, label: monthLabel })
  }
  
  return months
}

export function getFYDateRange(fy: string): { startDate: Date; endDate: Date } | null {
  const yearMatch = fy.match(/FY(\d{4})-(\d{2})/)
  if (!yearMatch) return null
  
  const startYear = parseInt(yearMatch[1])
  const endYear = parseInt('20' + yearMatch[2])
  
  const startDate = new Date(startYear, 3, 1)
  const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999)
  
  return { startDate, endDate }
}

export function isDateInFY(date: string | Date, fy: string): boolean {
  const range = getFYDateRange(fy)
  if (!range) return false
  
  const checkDate = new Date(date)
  return checkDate >= range.startDate && checkDate <= range.endDate
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
