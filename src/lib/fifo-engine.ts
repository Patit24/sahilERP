import {
  PurchaseInvoice,
  SalesInvoice,
  Supplier,
  Customer,
  Item,
  ExpectedDiscount,
  ExpenseEntry,
  PurchaseLayer,
  SaleAllocation,
  PaymentCDReportRow,
  PaymentCDSummaryStats,
  ItemProfitAnalysisRow
} from './types'

export type PeriodFilter = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface DateFilterRange {
  startDate?: string
  endDate?: string
}

export interface ReportFilterOptions {
  supplierId?: string
  itemId?: string
  category?: string
  godown?: string
}

export interface ActiveUnitQtyResult {
  unit: string
  qty: number
  isAlt: boolean
  displayQtyUnit: string
}

/**
 * Returns active unit and converted quantity for an item row.
 * If alternativeUnit is configured on itemDef (and not 'NONE'), it converts the line item into alternativeUnit!
 */
export function getItemActiveUnitAndQty(
  itemDef?: Item | null,
  entryUnit?: string,
  entryQty?: number,
  quantityMT?: number,
  weightKG?: number
): ActiveUnitQtyResult {
  const baseUnit = entryUnit || itemDef?.unit || 'MT'
  const baseQty = (entryQty && entryQty > 0) ? entryQty : (quantityMT || 0)

  if (itemDef?.alternativeUnit && itemDef.alternativeUnit !== 'NONE' && itemDef.alternativeUnit.trim() !== '') {
    const altUnit = itemDef.alternativeUnit
    let altQty = 0

    if (itemDef.alternativeUnitRatio && itemDef.alternativeUnitRatio > 0) {
      if (baseUnit === itemDef.unit) {
        altQty = baseQty * itemDef.alternativeUnitRatio
      } else if (baseUnit === itemDef.alternativeUnit) {
        altQty = baseQty
      } else {
        altQty = baseQty * itemDef.alternativeUnitRatio
      }
    } else {
      const itemWeightKG = weightKG || (quantityMT ? quantityMT * 1000 : 0) || (baseQty * (itemDef.conversionFactor || 1000))
      if (altUnit === 'KG') {
        altQty = itemWeightKG
      } else if (altUnit === 'MT') {
        altQty = itemWeightKG / 1000
      } else if (itemDef.conversionFactor && itemDef.conversionFactor > 0) {
        altQty = itemWeightKG / itemDef.conversionFactor
      }
    }

    if (altQty > 0) {
      return {
        unit: altUnit,
        qty: altQty,
        isAlt: true,
        displayQtyUnit: `${altQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${altUnit} (${baseQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${baseUnit})`
      }
    }
  }

  return {
    unit: baseUnit,
    qty: baseQty,
    isAlt: false,
    displayQtyUnit: `${baseQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${baseUnit}`
  }
}

/**
 * Returns weight in KG per 1 unit of targetUnit.
 */
export function getUnitWeightKG(itemDef?: Item | null, targetUnit?: string, rowWeightKG?: number, rowQty?: number): number {
  if (rowWeightKG && rowQty && rowQty > 0) {
    return rowWeightKG / rowQty
  }
  const unit = targetUnit || itemDef?.unit || 'MT'
  if (unit === 'KG') return 1
  if (unit === 'MT') return 1000

  if (itemDef?.conversionFactor && itemDef.conversionFactor > 0) {
    return itemDef.conversionFactor
  }
  return 1
}

/**
 * Builds chronological Purchase Layers from Purchase Invoices.
 * Each purchase item row forms a layer calculated in the active/alternative unit (GST-inclusive).
 */
export function buildPurchaseLayers(
  invoices: PurchaseInvoice[],
  suppliers: Supplier[],
  items: Item[],
  expectedDiscounts: ExpectedDiscount[] = [],
  expenseEntries: ExpenseEntry[] = []
): PurchaseLayer[] {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateDiff = new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
    if (dateDiff !== 0) return dateDiff
    return (a.invoiceNo || '').localeCompare(b.invoiceNo || '')
  })

  const layers: PurchaseLayer[] = []

  sortedInvoices.forEach(inv => {
    const supplier = supplierMap.get(inv.supplierId)
    const supplierName = supplier?.name || 'Unknown Supplier'

    const invoiceDiscounts = expectedDiscounts.filter(ed => ed.invoiceId === inv.id)
    const paymentCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'paymentCD' || ed.type === 'advanceCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const closeCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'invoiceCloseCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const fixedSchemeTotal = invoiceDiscounts
      .filter(ed => ed.type === 'fixedScheme')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)

    const linkedExpenses = expenseEntries
      .filter(exp => exp.linkedInvoiceId === inv.id)
      .reduce((sum, exp) => sum + exp.amount, 0)

    const additionalCost = inv.additionalCost || 0
    const totalExpenses = linkedExpenses + additionalCost

    const totalInvoiceWeightKG = (inv.items || []).reduce((sum, itemRow) => {
      const itemDef = itemMap.get(itemRow.itemId)
      const baseQty = itemRow.entryQuantity || itemRow.quantityMT || 0
      const unitWeight = itemRow.weightKG && baseQty > 0
        ? itemRow.weightKG / baseQty
        : (itemDef?.conversionFactor || (itemRow.entryUnit === 'MT' || itemDef?.unit === 'MT' ? 1000 : 1))
      const itemWeight = itemRow.weightKG || (baseQty * unitWeight)
      return sum + itemWeight
    }, 0);

    (inv.items || []).forEach((itemRow, idx) => {
      if (!itemRow.itemId) return
      const itemDef = itemMap.get(itemRow.itemId)
      const active = getItemActiveUnitAndQty(itemDef, itemRow.entryUnit, itemRow.entryQuantity, itemRow.quantityMT, itemRow.weightKG)

      if (active.qty <= 0) return

      const baseQty = itemRow.entryQuantity || itemRow.quantityMT || 1
      const totalItemAmount = itemRow.amount || ((itemRow.rate || 0) * baseQty)
      const purchaseRate = totalItemAmount / active.qty

      const itemWeightKG = itemRow.weightKG || (itemRow.quantityMT ? itemRow.quantityMT * 1000 : 0) || (active.qty * (itemDef?.conversionFactor || 1))
      const weightShare = totalInvoiceWeightKG > 0 ? itemWeightKG / totalInvoiceWeightKG : 0

      const itemPaymentCDTotal = paymentCDTotal * weightShare
      const itemCloseCDTotal = closeCDTotal * weightShare
      const itemSchemeCDTotal = fixedSchemeTotal * weightShare
      const itemExpenseTotal = totalExpenses * weightShare

      const itemPaymentCD = itemPaymentCDTotal / active.qty
      const itemInvoiceCloseCD = itemCloseCDTotal / active.qty
      const itemSchemeCD = itemSchemeCDTotal / active.qty
      const itemExpense = itemExpenseTotal / active.qty

      const totalCD = itemPaymentCD + itemInvoiceCloseCD + itemSchemeCD
      const landingCost = purchaseRate - totalCD + itemExpense

      const unitWeightKG = active.qty > 0 ? itemWeightKG / active.qty : 1

      layers.push({
        id: `layer-${inv.id}-${idx}`,
        purchaseInvoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        supplierId: inv.supplierId,
        supplierName,
        itemId: itemRow.itemId,
        itemName: itemDef?.name || 'Unknown Item',
        category: itemDef?.category || 'General',
        activeUnit: active.unit,
        unitWeightKG,
        purchaseDate: inv.invoiceDate,
        qty: active.qty,
        remainingQty: active.qty,
        purchaseRate,
        landingCost,
        paymentCD: itemPaymentCD,
        invoiceCloseCD: itemInvoiceCloseCD,
        schemeCD: itemSchemeCD,
        expense: itemExpense,
        batchNo: `LOT-${inv.invoiceNo}-${idx + 1}`
      })
    })
  })

  return layers
}

/**
 * Runs FIFO consumption logic on Sales Invoices against Purchase Layers.
 * Always calculates allocations in the item's active/alternative unit.
 */
export function allocateSalesFIFO(
  salesInvoices: SalesInvoice[],
  purchaseLayers: PurchaseLayer[],
  items: Item[],
  customers: Customer[] = []
): { allocations: SaleAllocation[]; updatedLayers: PurchaseLayer[] } {
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  const layers = purchaseLayers.map(l => ({ ...l }))

  const sortedSales = [...salesInvoices].sort((a, b) => {
    const dateDiff = new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime()
    if (dateDiff !== 0) return dateDiff
    return (a.invoiceNo || '').localeCompare(b.invoiceNo || '')
  })

  const allocations: SaleAllocation[] = []

  sortedSales.forEach(saleInv => {
    const customer = customerMap.get(saleInv.customerId)
    const customerName = customer?.name || 'Walk-in Customer';

    (saleInv.items || []).forEach((saleRow, idx) => {
      if (!saleRow.itemId) return
      const itemDef = itemMap.get(saleRow.itemId)
      const active = getItemActiveUnitAndQty(itemDef, saleRow.entryUnit, saleRow.entryQuantity, saleRow.quantityMT, saleRow.weightKG)

      let neededQty = active.qty
      if (neededQty <= 0) return

      const baseQty = saleRow.entryQuantity || saleRow.quantityMT || 1
      const totalSaleAmount = saleRow.amount || ((saleRow.rate || 0) * baseQty)
      const sellingPrice = totalSaleAmount / active.qty

      const itemLayers = layers.filter(l => l.itemId === saleRow.itemId && l.remainingQty > 0)

      if (itemLayers.length === 0) {
        const defaultLandingCost = itemDef?.purchasePrice || sellingPrice
        allocations.push({
          id: `alloc-${saleInv.id}-${idx}-unallocated`,
          salesInvoiceId: saleInv.id,
          salesInvoiceNo: saleInv.invoiceNo,
          customerId: saleInv.customerId,
          customerName,
          purchaseLayerId: 'opening-stock',
          purchaseInvoiceId: 'N/A',
          purchaseInvoiceNo: 'Opening Stock',
          supplierName: 'Opening Stock',
          itemId: saleRow.itemId,
          itemName: itemDef?.name || 'Unknown Item',
          activeUnit: active.unit,
          allocatedQty: neededQty,
          fifoCostPerUnit: defaultLandingCost,
          sellingPricePerUnit: sellingPrice,
          profitPerUnit: sellingPrice - defaultLandingCost,
          totalProfit: (sellingPrice - defaultLandingCost) * neededQty,
          saleDate: saleInv.invoiceDate
        })
        return
      }

      for (const layer of itemLayers) {
        if (neededQty <= 0) break

        const takeQty = Math.min(neededQty, layer.remainingQty)
        layer.remainingQty -= takeQty
        neededQty -= takeQty

        let fifoCostInActiveUnit = layer.landingCost
        if (layer.activeUnit !== active.unit) {
          const saleUnitWeightKG = active.qty > 0 ? (saleRow.weightKG || (saleRow.quantityMT ? saleRow.quantityMT * 1000 : 0) || (active.qty * (itemDef?.conversionFactor || 1))) / active.qty : 1
          const layerCostPerKG = layer.unitWeightKG > 0 ? layer.landingCost / layer.unitWeightKG : layer.landingCost / 1000
          fifoCostInActiveUnit = layerCostPerKG * saleUnitWeightKG
        }

        const profitPerUnit = sellingPrice - fifoCostInActiveUnit
        const totalProfit = profitPerUnit * takeQty

        allocations.push({
          id: `alloc-${saleInv.id}-${idx}-${layer.id}`,
          salesInvoiceId: saleInv.id,
          salesInvoiceNo: saleInv.invoiceNo,
          customerId: saleInv.customerId,
          customerName,
          purchaseLayerId: layer.id,
          purchaseInvoiceId: layer.purchaseInvoiceId,
          purchaseInvoiceNo: layer.invoiceNo,
          supplierName: layer.supplierName,
          itemId: saleRow.itemId,
          itemName: itemDef?.name || 'Unknown Item',
          activeUnit: active.unit,
          allocatedQty: takeQty,
          fifoCostPerUnit: fifoCostInActiveUnit,
          sellingPricePerUnit: sellingPrice,
          profitPerUnit,
          totalProfit,
          saleDate: saleInv.invoiceDate
        })
      }

      if (neededQty > 0) {
        const lastLayer = itemLayers[itemLayers.length - 1]
        let lastLayerCost = itemDef?.purchasePrice || sellingPrice
        if (lastLayer) {
          if (lastLayer.activeUnit === active.unit) {
            lastLayerCost = lastLayer.landingCost
          } else {
            const saleUnitWeightKG = active.qty > 0 ? (saleRow.weightKG || (saleRow.quantityMT ? saleRow.quantityMT * 1000 : 0) || (active.qty * (itemDef?.conversionFactor || 1))) / active.qty : 1
            lastLayerCost = lastLayer.unitWeightKG > 0 ? (lastLayer.landingCost / lastLayer.unitWeightKG) * saleUnitWeightKG : lastLayer.landingCost
          }
        }

        allocations.push({
          id: `alloc-${saleInv.id}-${idx}-overdraw`,
          salesInvoiceId: saleInv.id,
          salesInvoiceNo: saleInv.invoiceNo,
          customerId: saleInv.customerId,
          customerName,
          purchaseLayerId: 'unallocated',
          purchaseInvoiceId: 'N/A',
          purchaseInvoiceNo: 'Unallocated Lot',
          supplierName: 'Unallocated Lot',
          itemId: saleRow.itemId,
          itemName: itemDef?.name || 'Unknown Item',
          activeUnit: active.unit,
          allocatedQty: neededQty,
          fifoCostPerUnit: lastLayerCost,
          sellingPricePerUnit: sellingPrice,
          profitPerUnit: sellingPrice - lastLayerCost,
          totalProfit: (sellingPrice - lastLayerCost) * neededQty,
          saleDate: saleInv.invoiceDate
        })
      }
    })
  })

  return { allocations, updatedLayers: layers }
}

/**
 * Filter items by date range
 */
export function isDateInPeriod(
  dateStr: string,
  period: PeriodFilter,
  customRange?: DateFilterRange,
  referenceDate: Date = new Date()
): boolean {
  if (!dateStr) return false
  const targetDate = new Date(dateStr)
  if (isNaN(targetDate.getTime())) return false

  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  if (period === 'daily') {
    const target = new Date(targetDate)
    target.setHours(0, 0, 0, 0)
    return target.getTime() === today.getTime()
  }

  if (period === 'weekly') {
    const startOfWeek = new Date(today)
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    return targetDate >= startOfWeek && targetDate <= endOfWeek
  }

  if (period === 'monthly') {
    return (
      targetDate.getMonth() === today.getMonth() &&
      targetDate.getFullYear() === today.getFullYear()
    )
  }

  if (period === 'custom') {
    if (customRange?.startDate) {
      const start = new Date(customRange.startDate)
      start.setHours(0, 0, 0, 0)
      if (targetDate < start) return false
    }
    if (customRange?.endDate) {
      const end = new Date(customRange.endDate)
      end.setHours(23, 59, 59, 999)
      if (targetDate > end) return false
    }
    return true
  }

  return true
}

/**
 * Computes Payment CD Report Rows & Summary Statistics
 */
export function calculatePaymentCDReport(
  invoices: PurchaseInvoice[],
  suppliers: Supplier[],
  items: Item[],
  expectedDiscounts: ExpectedDiscount[] = [],
  expenseEntries: ExpenseEntry[] = [],
  period: PeriodFilter = 'monthly',
  customRange?: DateFilterRange,
  filters?: ReportFilterOptions
): { rows: PaymentCDReportRow[]; summary: PaymentCDSummaryStats } {
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  const rows: PaymentCDReportRow[] = []

  invoices.forEach(inv => {
    if (!isDateInPeriod(inv.invoiceDate, period, customRange)) return
    if (filters?.supplierId && filters.supplierId !== 'all' && inv.supplierId !== filters.supplierId) return

    const supplier = supplierMap.get(inv.supplierId)
    const supplierName = supplier?.name || 'Unknown Supplier'

    const invoiceDiscounts = expectedDiscounts.filter(ed => ed.invoiceId === inv.id)
    const paymentCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'paymentCD' || ed.type === 'advanceCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const closeCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'invoiceCloseCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const fixedSchemeTotal = invoiceDiscounts
      .filter(ed => ed.type === 'fixedScheme')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)

    const totalInvoiceWeightKG = (inv.items || []).reduce((sum, itemRow) => {
      const itemDef = itemMap.get(itemRow.itemId)
      const baseQty = itemRow.entryQuantity || itemRow.quantityMT || 0
      const unitWeight = itemRow.weightKG && baseQty > 0
        ? itemRow.weightKG / baseQty
        : (itemDef?.conversionFactor || (itemRow.entryUnit === 'MT' || itemDef?.unit === 'MT' ? 1000 : 1))
      const itemWeight = itemRow.weightKG || (baseQty * unitWeight)
      return sum + itemWeight
    }, 0);

    (inv.items || []).forEach((itemRow, idx) => {
      if (!itemRow.itemId) return
      if (filters?.itemId && filters.itemId !== 'all' && itemRow.itemId !== filters.itemId) return

      const itemDef = itemMap.get(itemRow.itemId)
      if (filters?.category && filters.category !== 'all' && itemDef?.category !== filters.category) return

      const active = getItemActiveUnitAndQty(itemDef, itemRow.entryUnit, itemRow.entryQuantity, itemRow.quantityMT, itemRow.weightKG)

      if (active.qty <= 0) return

      const itemWeightKG = itemRow.weightKG || (itemRow.quantityMT ? itemRow.quantityMT * 1000 : 0) || (active.qty * (itemDef?.conversionFactor || 1))
      const weightShare = totalInvoiceWeightKG > 0 ? itemWeightKG / totalInvoiceWeightKG : 0

      const itemPaymentCD = paymentCDTotal * weightShare
      const itemCloseCD = closeCDTotal * weightShare
      const itemSchemeCD = fixedSchemeTotal * weightShare
      const itemTotalCD = itemPaymentCD + itemCloseCD + itemSchemeCD

      const baseQty = itemRow.entryQuantity || itemRow.quantityMT || 1
      const purchaseAmount = itemRow.amount || ((itemRow.rate || 0) * baseQty)
      const avgCDPerUnit = active.qty > 0 ? itemTotalCD / active.qty : 0

      rows.push({
        id: `cd-row-${inv.id}-${idx}`,
        date: inv.invoiceDate,
        supplierId: inv.supplierId,
        supplierName,
        invoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        itemId: itemRow.itemId,
        itemName: itemDef?.name || 'Unknown Item',
        category: itemDef?.category,
        qty: active.qty,
        activeUnit: active.unit,
        purchaseAmount,
        paymentCD: itemPaymentCD,
        closeCD: itemCloseCD,
        schemeCD: itemSchemeCD,
        totalCD: itemTotalCD,
        netLandingCostSaved: itemTotalCD,
        avgCDPerUnit
      })
    })
  })

  const summary: PaymentCDSummaryStats = rows.reduce(
    (acc, row) => {
      acc.purchaseAmount += row.purchaseAmount
      acc.paymentCDEarned += row.paymentCD
      acc.invoiceCloseCD += row.closeCD
      acc.schemeCD += row.schemeCD
      acc.totalCDEarned += row.totalCD
      acc.netLandingCostSaved += row.netLandingCostSaved
      acc.totalQty += row.qty
      return acc
    },
    {
      purchaseAmount: 0,
      paymentCDEarned: 0,
      invoiceCloseCD: 0,
      schemeCD: 0,
      totalCDEarned: 0,
      avgCDPerUnit: 0,
      netLandingCostSaved: 0,
      totalQty: 0
    }
  )

  summary.avgCDPerUnit = summary.totalQty > 0 ? summary.totalCDEarned / summary.totalQty : 0

  return { rows, summary }
}

/**
 * Calculates Item Sales Profit Analysis (FIFO Margins)
 */
export function calculateItemProfitAnalysis(
  salesInvoices: SalesInvoice[],
  allocations: SaleAllocation[],
  items: Item[],
  customers: Customer[],
  period: PeriodFilter = 'monthly',
  customRange?: DateFilterRange,
  filters?: ReportFilterOptions
): ItemProfitAnalysisRow[] {
  const itemMap = new Map(items.map(i => [i.id, i]))

  const groupedMap = new Map<string, SaleAllocation[]>()
  allocations.forEach(alloc => {
    if (!isDateInPeriod(alloc.saleDate, period, customRange)) return
    if (filters?.itemId && filters.itemId !== 'all' && alloc.itemId !== filters.itemId) return
    if (filters?.supplierId && filters.supplierId !== 'all' && alloc.purchaseLayerId !== 'opening-stock' && alloc.purchaseLayerId !== 'unallocated') {
      if (!alloc.supplierName.toLowerCase().includes(filters.supplierId.toLowerCase())) return
    }

    const itemDef = itemMap.get(alloc.itemId)
    if (filters?.category && filters.category !== 'all' && itemDef?.category !== filters.category) return

    const groupKey = `${alloc.salesInvoiceId}-${alloc.itemId}`
    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, [])
    }
    groupedMap.get(groupKey)!.push(alloc)
  })

  const rows: ItemProfitAnalysisRow[] = []

  groupedMap.forEach((allocs, groupKey) => {
    if (allocs.length === 0) return
    const first = allocs[0]

    const totalSoldQty = allocs.reduce((sum, a) => sum + a.allocatedQty, 0)
    const totalProfit = allocs.reduce((sum, a) => sum + a.totalProfit, 0)

    const totalFifoCostSum = allocs.reduce((sum, a) => sum + a.fifoCostPerUnit * a.allocatedQty, 0)
    const weightedFifoCost = totalSoldQty > 0 ? totalFifoCostSum / totalSoldQty : first.fifoCostPerUnit

    const sellingRate = first.sellingPricePerUnit
    const profitPerUnit = totalSoldQty > 0 ? totalProfit / totalSoldQty : sellingRate - weightedFifoCost

    rows.push({
      id: `profit-row-${groupKey}`,
      saleDate: first.saleDate,
      salesInvoiceId: first.salesInvoiceId,
      salesInvoiceNo: first.salesInvoiceNo,
      customerId: first.customerId,
      customerName: first.customerName,
      itemId: first.itemId,
      itemName: first.itemName,
      category: itemMap.get(first.itemId)?.category,
      soldQty: totalSoldQty,
      activeUnit: first.activeUnit,
      sellingRate,
      fifoCost: weightedFifoCost,
      profitPerUnit,
      totalProfit,
      allocations: allocs
    })
  })

  return rows.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
}
