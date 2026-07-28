/*
 * REPORT CALCULATIONS MODULE
 * ==========================
 * 
 * This module contains calculation functions for reports that must remain consistent
 * with the Dashboard and all other views.
 * 
 * CRITICAL: CD AT RISK CALCULATION (Single Source of Truth)
 * ==========================================================
 * 
 * The CD at Risk calculation uses SLAB-DIFFERENCE logic:
 * 
 * Risk = (Current Slab CD - Next Slab CD)
 * 
 * This represents the LOSS due to slab downgrade, NOT the full potential CD amount.
 * 
 * Example:
 *   - Invoice with pending ₹1,00,000
 *   - Current slab: 0-7 days = 2.75% → ₹2,750
 *   - Next slab: 8-10 days = 2.5% → ₹2,500
 *   - CD at Risk = ₹2,750 - ₹2,500 = ₹250 (NOT ₹2,750)
 * 
 * This logic is used by:
 *   - Dashboard → CD Expiry Alerts (cd-expiry-alert.tsx)
 *   - CD at Risk Report → Summary & Details (cd-at-risk-report-page.tsx)
 *   - All other views referencing CD risk
 * 
 * DO NOT create parallel/duplicate calculation logic elsewhere.
 * DO NOT calculate CD risk as full CD amount.
 * 
 * The calculateCDAtRisk() function below is the ONLY place where
 * total CD risk should be calculated.
 */

import {
  PurchaseInvoice,
  SalesInvoice,
  Payment,
  CustomerPayment,
  ExpenseEntry,
  ExpenseType,
  Supplier,
  Customer,
  Item,
  FixedScheme,
  ReceivedDiscount,
  PaymentAllocation,
  PurchaseReturn,
  SalesReturn
} from './types'
import {
  calculatePaymentAllocations,
  calculateExpectedDiscounts,
  calculateDiscountAllocations
} from './calculations'

export interface InventoryData {
  itemId: string
  itemName: string
  category?: string
  unit: string
  alternativeUnit?: string
  conversionFactor?: number
  openingStockMT: number
  openingStockValue: number
  totalPurchaseMT: number
  totalSalesMT: number
  balanceMT: number
  avgPurchaseRate: number
  avgSalesRate: number
  currentStockValue: number
  secondaryUnit?: string
  secondaryOpeningStock?: number
  secondaryTotalPurchase?: number
  secondaryTotalSales?: number
  secondaryBalance?: number
  primaryUnit?: string
}

export interface CDAtRisk {
  invoiceId: string
  invoiceNo: string
  invoiceDate: string
  supplierId: string
  supplierName: string
  quantityMT: number
  invoiceAmount: number
  paidAmount: number
  pendingAmount: number
  daysSinceInvoice: number
  currentSlabPaymentCDRate: number
  currentSlabInvoiceCloseCDRate: number
  nextSlabPaymentCDRate: number
  nextSlabInvoiceCloseCDRate: number
  paymentCDRisk: number
  invoiceCloseCDRisk: number
  totalCDAtRisk: number
  nextSlabDays: number
  daysUntilNextSlab: number
  totalPaymentCDAtCurrentSlab: number
}

export function getItemNormalizedQty(
  invItem: { entryQuantity?: number; quantityMT?: number; entryUnit?: string },
  item: Item,
  conversionFactor?: number
): { primaryQty: number; altQty: number; usedUnit: string } {
  const primaryUnit = item.unit || 'MT'
  const altUnit = item.alternativeUnit && item.alternativeUnit !== 'NONE' ? item.alternativeUnit : undefined

  let factor = conversionFactor || item.conversionFactor
  if (!factor || factor <= 0) {
    if (primaryUnit === 'MT' && altUnit === 'KG') factor = 1000
    else if (primaryUnit === 'KG' && altUnit === 'MT') factor = 0.001
    else factor = 1
  }

  const entryUnit = invItem.entryUnit || primaryUnit
  let primaryQty = 0
  let altQty = 0

  if (altUnit && entryUnit === altUnit) {
    const rawQty = (invItem.entryQuantity !== undefined && invItem.entryQuantity !== null && invItem.entryQuantity > 0)
      ? invItem.entryQuantity
      : (invItem.quantityMT ? invItem.quantityMT * factor : 0)
    altQty = rawQty
    primaryQty = factor >= 1 ? rawQty / factor : rawQty * factor
  } else {
    const rawQty = (invItem.quantityMT !== undefined && invItem.quantityMT !== null && invItem.quantityMT > 0)
      ? invItem.quantityMT
      : (invItem.entryQuantity || 0)
    primaryQty = rawQty
    altQty = factor >= 1 ? rawQty * factor : rawQty / factor
  }

  return { primaryQty, altQty, usedUnit: entryUnit }
}

export function calculateInventoryReport(
  items: Item[],
  purchaseInvoices: PurchaseInvoice[],
  salesInvoices: SalesInvoice[],
  purchaseReturns: PurchaseReturn[] = [],
  salesReturns: SalesReturn[] = []
): InventoryData[] {
  const inventory: InventoryData[] = []

  items.forEach(item => {
    const primaryUnit = item.unit || 'MT'
    const altUnit = item.alternativeUnit && item.alternativeUnit !== 'NONE' ? item.alternativeUnit : undefined

    let factor = item.conversionFactor
    if (!factor || factor <= 0) {
      if (primaryUnit === 'MT' && altUnit === 'KG') factor = 1000
      else if (primaryUnit === 'KG' && altUnit === 'MT') factor = 0.001
      else factor = 1
    }

    const openingPrimary = item.openingStock || 0
    const openingStockValue = item.openingValue || 0
    const openingAlt = factor >= 1 ? openingPrimary * factor : openingPrimary / factor

    let totalPurchasePrimary = 0
    let totalPurchaseAlt = 0
    let totalPurchaseAmount = 0

    let totalSalesPrimary = 0
    let totalSalesAlt = 0
    let totalSalesAmount = 0

    let usedAltUnitCount = 0
    let usedPrimaryUnitCount = 0

    const purchaseBatches: { date: Date; quantityPrimary: number; rate: number; amount: number }[] = []

    if (openingPrimary > 0 && openingStockValue > 0) {
      purchaseBatches.push({
        date: new Date('1900-01-01'),
        quantityPrimary: openingPrimary,
        rate: openingStockValue / openingPrimary,
        amount: openingStockValue
      })
    }

    purchaseInvoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            const { primaryQty, altQty, usedUnit } = getItemNormalizedQty(invItem, item, factor)
            totalPurchasePrimary += primaryQty
            totalPurchaseAlt += altQty
            totalPurchaseAmount += invItem.amount || 0

            if (altUnit && usedUnit === altUnit) usedAltUnitCount++
            else usedPrimaryUnitCount++

            purchaseBatches.push({
              date: new Date(invoice.invoiceDate),
              quantityPrimary: primaryQty,
              rate: primaryQty > 0 ? (invItem.amount || 0) / primaryQty : 0,
              amount: invItem.amount || 0
            })
          }
        })
      }
    })

    purchaseReturns.forEach(ret => {
      if (ret.items && Array.isArray(ret.items)) {
        ret.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            const { primaryQty, altQty } = getItemNormalizedQty(invItem, item, factor)
            totalPurchasePrimary -= primaryQty
            totalPurchaseAlt -= altQty
            totalPurchaseAmount -= invItem.amount || 0
          }
        })
      }
    })

    salesInvoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            const { primaryQty, altQty, usedUnit } = getItemNormalizedQty(invItem, item, factor)
            totalSalesPrimary += primaryQty
            totalSalesAlt += altQty
            totalSalesAmount += invItem.amount || 0

            if (altUnit && usedUnit === altUnit) usedAltUnitCount++
            else usedPrimaryUnitCount++
          }
        })
      }
    })

    salesReturns.forEach(ret => {
      if (ret.items && Array.isArray(ret.items)) {
        ret.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            const { primaryQty, altQty } = getItemNormalizedQty(invItem, item, factor)
            totalSalesPrimary -= primaryQty
            totalSalesAlt -= altQty
            totalSalesAmount -= invItem.amount || 0
          }
        })
      }
    })

    const balancePrimary = (openingPrimary + totalPurchasePrimary) - totalSalesPrimary
    const balanceAlt = (openingAlt + totalPurchaseAlt) - totalSalesAlt

    // Prefer Alt unit display if altUnit is defined AND user has transacted in altUnit
    const preferAlt = Boolean(altUnit && usedAltUnitCount > 0 && usedAltUnitCount >= usedPrimaryUnitCount)

    const mainUnit = preferAlt ? (altUnit!) : primaryUnit
    const secUnit = preferAlt ? primaryUnit : altUnit

    const openingStockMT = preferAlt ? openingAlt : openingPrimary
    const totalPurchaseMT = preferAlt ? totalPurchaseAlt : totalPurchasePrimary
    const totalSalesMT = preferAlt ? totalSalesAlt : totalSalesPrimary
    const balanceMT = preferAlt ? balanceAlt : balancePrimary

    const secOpeningStock = preferAlt ? openingPrimary : openingAlt
    const secTotalPurchase = preferAlt ? totalPurchasePrimary : totalPurchaseAlt
    const secTotalSales = preferAlt ? totalSalesPrimary : totalSalesAlt
    const secBalance = preferAlt ? balancePrimary : balanceAlt

    const totalAvailablePrimary = openingPrimary + totalPurchasePrimary
    const totalAvailableAmount = openingStockValue + totalPurchaseAmount
    const avgPurchaseRatePrimary = totalAvailablePrimary > 0 ? totalAvailableAmount / totalAvailablePrimary : 0
    const avgSalesRatePrimary = totalSalesPrimary > 0 ? totalSalesAmount / totalSalesPrimary : 0

    const avgPurchaseRate = preferAlt ? (factor >= 1 ? avgPurchaseRatePrimary / factor : avgPurchaseRatePrimary * factor) : avgPurchaseRatePrimary
    const avgSalesRate = preferAlt ? (factor >= 1 ? avgSalesRatePrimary / factor : avgSalesRatePrimary * factor) : avgSalesRatePrimary

    let currentStockValue = 0
    if (balancePrimary > 0 && purchaseBatches.length > 0) {
      purchaseBatches.sort((a, b) => a.date.getTime() - b.date.getTime())
      let remainingSales = totalSalesPrimary
      let calculatedBalance = 0

      for (const batch of purchaseBatches) {
        if (remainingSales >= batch.quantityPrimary) {
          remainingSales -= batch.quantityPrimary
        } else if (remainingSales > 0) {
          const remainingQty = batch.quantityPrimary - remainingSales
          currentStockValue += remainingQty * batch.rate
          calculatedBalance += remainingQty
          remainingSales = 0
        } else {
          currentStockValue += batch.quantityPrimary * batch.rate
          calculatedBalance += batch.quantityPrimary
        }
      }

      if (calculatedBalance !== balancePrimary && Math.abs(calculatedBalance - balancePrimary) > 0.01) {
        currentStockValue = balancePrimary * avgPurchaseRatePrimary
      }
    } else if (balancePrimary <= 0) {
      currentStockValue = 0
    }

    inventory.push({
      itemId: item.id,
      itemName: item.name,
      category: item.category || 'Uncategorized',
      unit: mainUnit,
      alternativeUnit: secUnit,
      conversionFactor: factor,
      openingStockMT,
      openingStockValue,
      totalPurchaseMT,
      totalSalesMT,
      balanceMT,
      avgPurchaseRate,
      avgSalesRate,
      currentStockValue: isNaN(currentStockValue) || !isFinite(currentStockValue) ? 0 : Math.max(0, currentStockValue),
      secondaryUnit: secUnit,
      secondaryOpeningStock: secOpeningStock,
      secondaryTotalPurchase: secTotalPurchase,
      secondaryTotalSales: secTotalSales,
      secondaryBalance: secBalance,
      primaryUnit
    })
  })

  return inventory
}

export function calculateItemStockMap(
  items: Item[],
  purchaseInvoices: PurchaseInvoice[],
  salesInvoices: SalesInvoice[],
  purchaseReturns: PurchaseReturn[] = [],
  salesReturns: SalesReturn[] = []
): Map<string, { currentStock: number; unit: string }> {
  const stockMap = new Map<string, { currentStock: number; unit: string }>()
  const inventory = calculateInventoryReport(items, purchaseInvoices, salesInvoices, purchaseReturns, salesReturns)

  inventory.forEach(inv => {
    stockMap.set(inv.itemId, {
      currentStock: inv.balanceMT,
      unit: inv.unit
    })
  })

  return stockMap
}

/**
 * Calculate CD at Risk using slab-difference logic
 * 
 * IMPORTANT: This function calculates the LOSS due to slab downgrade,
 * not the full potential CD amount.
 * 
 * For each invoice with pending amount:
 * - Payment CD Risk = (Current Slab % × Pending) - (Next Slab % × Pending)
 * - Invoice Close CD Risk = (Current Slab Rate/MT × Qty) - (Next Slab Rate/MT × Qty)
 * - Total Risk = Payment CD Risk + Invoice Close CD Risk
 * 
 * This is the SINGLE SOURCE OF TRUTH for CD risk calculations.
 * Used by Dashboard alerts and CD at Risk reports.
 */
export function calculateCDAtRisk(
  purchaseInvoices: PurchaseInvoice[],
  payments: Payment[],
  paymentAllocations: PaymentAllocation[],
  suppliers: Supplier[]
): CDAtRisk[] {
  const cdAtRisk: CDAtRisk[] = []
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const today = new Date()

  purchaseInvoices.forEach(invoice => {
    const supplier = supplierMap.get(invoice.supplierId)
    if (!supplier) return

    const allocatedAmount = paymentAllocations
      .filter(a => a.invoiceId === invoice.id)
      .reduce((sum, a) => sum + a.allocatedAmount, 0)

    const pendingAmount = invoice.invoiceAmount - allocatedAmount

    if (pendingAmount > 0) {
      const invoiceDate = new Date(invoice.invoiceDate)
      const daysSinceInvoice = Math.floor(
        (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const currentPaymentCDRule = supplier.paymentCDRules?.find(
        rule => daysSinceInvoice >= rule.minDays && daysSinceInvoice <= rule.maxDays
      )
      const currentInvoiceCloseCDRule = supplier.invoiceCloseCDRules?.find(
        rule => daysSinceInvoice >= rule.minDays && daysSinceInvoice <= rule.maxDays
      )

      const currentSlabPaymentCDRate = currentPaymentCDRule?.percentageRate || 0
      const currentSlabInvoiceCloseCDRate = currentInvoiceCloseCDRule?.ratePerMT || 0

      const nextPaymentCDSlab = supplier.paymentCDRules
        ?.filter(rule => rule.minDays > daysSinceInvoice)
        .sort((a, b) => a.minDays - b.minDays)[0]

      const nextInvoiceCloseCDSlab = supplier.invoiceCloseCDRules
        ?.filter(rule => rule.minDays > daysSinceInvoice)
        .sort((a, b) => a.minDays - b.minDays)[0]

      const nextSlabPaymentCDRate = nextPaymentCDSlab?.percentageRate || 0
      const nextSlabInvoiceCloseCDRate = nextInvoiceCloseCDSlab?.ratePerMT || 0

      const nextSlabDays = nextPaymentCDSlab?.minDays || nextInvoiceCloseCDSlab?.minDays || 0
      const daysUntilNextSlab = nextSlabDays > 0 ? nextSlabDays - daysSinceInvoice : 0

      // Calculate total Payment CD at current slab (full amount)
      const totalPaymentCDAtCurrentSlab = (pendingAmount * currentSlabPaymentCDRate) / 100
      
      // Calculate Payment CD risk (slab difference, not full amount)
      const currentPaymentCD = (pendingAmount * currentSlabPaymentCDRate) / 100
      const nextPaymentCD = (pendingAmount * nextSlabPaymentCDRate) / 100
      const paymentCDRisk = currentPaymentCD - nextPaymentCD  // LOSS due to downgrade

      // Calculate Invoice Close CD risk (slab difference, not full amount)
      const currentInvoiceCloseCD = invoice.quantityMT * currentSlabInvoiceCloseCDRate
      const nextInvoiceCloseCD = invoice.quantityMT * nextSlabInvoiceCloseCDRate
      const invoiceCloseCDRisk = currentInvoiceCloseCD - nextInvoiceCloseCD  // LOSS due to downgrade

      // Total risk is sum of both losses
      const totalCDAtRisk = paymentCDRisk + invoiceCloseCDRisk

      cdAtRisk.push({
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        invoiceDate: invoice.invoiceDate,
        supplierId: supplier.id,
        supplierName: supplier.name,
        quantityMT: invoice.quantityMT,
        invoiceAmount: invoice.invoiceAmount,
        paidAmount: allocatedAmount,
        pendingAmount,
        daysSinceInvoice,
        currentSlabPaymentCDRate,
        currentSlabInvoiceCloseCDRate,
        nextSlabPaymentCDRate,
        nextSlabInvoiceCloseCDRate,
        paymentCDRisk,
        invoiceCloseCDRisk,
        totalCDAtRisk,
        nextSlabDays,
        daysUntilNextSlab,
        totalPaymentCDAtCurrentSlab
      })
    }
  })

  return cdAtRisk.sort((a, b) => {
    const dateA = new Date(a.invoiceDate)
    const dateB = new Date(b.invoiceDate)
    return dateA.getTime() - dateB.getTime()
  })
}
