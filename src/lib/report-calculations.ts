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
  PaymentAllocation
} from './types'
import {
  calculatePaymentAllocations,
  calculateExpectedDiscounts,
  calculateDiscountAllocations
} from './calculations'

export interface InventoryData {
  itemId: string
  itemName: string
  unit: string
  openingStockMT: number
  openingStockValue: number
  totalPurchaseMT: number
  totalSalesMT: number
  balanceMT: number
  avgPurchaseRate: number
  avgSalesRate: number
  currentStockValue: number
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

export function calculateInventoryReport(
  items: Item[],
  purchaseInvoices: PurchaseInvoice[],
  salesInvoices: SalesInvoice[]
): InventoryData[] {
  const inventory: InventoryData[] = []

  items.forEach(item => {
    const openingStockMT = item.openingStock || 0
    const openingStockValue = item.openingValue || 0
    
    let totalPurchaseMT = 0
    let totalPurchaseAmount = 0
    let totalSalesMT = 0
    let totalSalesAmount = 0

    const purchaseBatches: { date: Date; quantityMT: number; rate: number; amount: number }[] = []

    if (openingStockMT > 0 && openingStockValue > 0) {
      purchaseBatches.push({
        date: new Date('1900-01-01'),
        quantityMT: openingStockMT,
        rate: openingStockValue / openingStockMT,
        amount: openingStockValue
      })
    }

    purchaseInvoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            totalPurchaseMT += invItem.quantityMT
            totalPurchaseAmount += invItem.amount
            purchaseBatches.push({
              date: new Date(invoice.invoiceDate),
              quantityMT: invItem.quantityMT,
              rate: invItem.rate,
              amount: invItem.amount
            })
          }
        })
      }
    })

    salesInvoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach(invItem => {
          if (invItem.itemId === item.id) {
            totalSalesMT += invItem.quantityMT
            totalSalesAmount += invItem.amount
          }
        })
      }
    })

    const totalAvailableMT = openingStockMT + totalPurchaseMT
    const balanceMT = totalAvailableMT - totalSalesMT
    const totalAvailableAmount = openingStockValue + totalPurchaseAmount
    const avgPurchaseRate = totalAvailableMT > 0 ? totalAvailableAmount / totalAvailableMT : 0
    const avgSalesRate = totalSalesMT > 0 ? totalSalesAmount / totalSalesMT : 0
    
    let currentStockValue = 0
    
    if (balanceMT > 0 && purchaseBatches.length > 0) {
      purchaseBatches.sort((a, b) => a.date.getTime() - b.date.getTime())
      
      let remainingSalesMT = totalSalesMT
      let calculatedBalance = 0
      
      for (const batch of purchaseBatches) {
        if (remainingSalesMT >= batch.quantityMT) {
          remainingSalesMT -= batch.quantityMT
        } else if (remainingSalesMT > 0) {
          const remainingQty = batch.quantityMT - remainingSalesMT
          currentStockValue += remainingQty * batch.rate
          calculatedBalance += remainingQty
          remainingSalesMT = 0
        } else {
          currentStockValue += batch.quantityMT * batch.rate
          calculatedBalance += batch.quantityMT
        }
      }
      
      if (calculatedBalance !== balanceMT && Math.abs(calculatedBalance - balanceMT) > 0.01) {
        currentStockValue = balanceMT * avgPurchaseRate
      }
    } else if (balanceMT <= 0) {
      currentStockValue = 0
    }

    inventory.push({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      openingStockMT,
      openingStockValue,
      totalPurchaseMT,
      totalSalesMT,
      balanceMT,
      avgPurchaseRate,
      avgSalesRate,
      currentStockValue: isNaN(currentStockValue) || !isFinite(currentStockValue) ? 0 : Math.max(0, currentStockValue)
    })
  })

  return inventory.filter(inv => inv.openingStockMT > 0 || inv.totalPurchaseMT > 0 || inv.totalSalesMT > 0)
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
