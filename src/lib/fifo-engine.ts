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

/**
 * Builds chronological Purchase Layers from Purchase Invoices.
 * Each purchase item row forms a layer with landed cost calculated in the item's alternate/active unit (GST-inclusive).
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

  // Sort purchase invoices chronologically
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

    // Total Base Weight in KG for this invoice
    const totalInvoiceWeightKG = (inv.items || []).reduce((sum, itemRow) => {
      const itemDef = itemMap.get(itemRow.itemId)
      const activeUnit = itemRow.entryUnit || itemDef?.alternativeUnit || itemDef?.unit || 'MT'
      const itemQty = itemRow.entryQuantity && itemRow.entryQuantity > 0 ? itemRow.entryQuantity : (itemRow.quantityMT || 0)
      const unitWeightKG = itemRow.weightKG && itemQty > 0
        ? itemRow.weightKG / itemQty
        : (itemDef?.conversionFactor || (activeUnit === 'MT' ? 1000 : 1))
      const itemWeight = itemRow.weightKG || (itemQty * unitWeightKG)
      return sum + itemWeight
    }, 0)

    const paymentCDRatePerKG = totalInvoiceWeightKG > 0 ? paymentCDTotal / totalInvoiceWeightKG : 0
    const closeCDRatePerKG = totalInvoiceWeightKG > 0 ? closeCDTotal / totalInvoiceWeightKG : 0
    const schemeCDRatePerKG = totalInvoiceWeightKG > 0 ? fixedSchemeTotal / totalInvoiceWeightKG : 0
    const expenseRatePerKG = totalInvoiceWeightKG > 0 ? totalExpenses / totalInvoiceWeightKG : 0;

    (inv.items || []).forEach((itemRow, idx) => {
      if (!itemRow.itemId) return
      const itemDef = itemMap.get(itemRow.itemId)
      const activeUnit = itemRow.entryUnit || itemDef?.alternativeUnit || itemDef?.unit || 'MT'
      const itemQty = itemRow.entryQuantity && itemRow.entryQuantity > 0 ? itemRow.entryQuantity : (itemRow.quantityMT || 0)
      if (itemQty <= 0) return

      const unitWeightKG = itemRow.weightKG && itemQty > 0
        ? itemRow.weightKG / itemQty
        : (itemDef?.conversionFactor || (activeUnit === 'MT' ? 1000 : 1))

      // Rate inclusive of GST per activeUnit
      const purchaseRate = itemRow.rate || 0

      // Per activeUnit CD & Expense calculations
      const itemPaymentCDPerUnit = paymentCDRatePerKG * unitWeightKG
      const itemCloseCDPerUnit = closeCDRatePerKG * unitWeightKG
      const itemSchemeCDPerUnit = schemeCDRatePerKG * unitWeightKG
      const itemExpensePerUnit = expenseRatePerKG * unitWeightKG

      const totalCDPerUnit = itemPaymentCDPerUnit + itemCloseCDPerUnit + itemSchemeCDPerUnit
      const landingCost = purchaseRate - totalCDPerUnit + itemExpensePerUnit

      layers.push({
        id: `layer-${inv.id}-${idx}`,
        purchaseInvoiceId: inv.id,
        invoiceNo: inv.invoiceNo,
        supplierId: inv.supplierId,
        supplierName,
        itemId: itemRow.itemId,
        itemName: itemDef?.name || 'Unknown Item',
        category: itemDef?.category || 'General',
        activeUnit,
        unitWeightKG,
        purchaseDate: inv.invoiceDate,
        qty: itemQty,
        remainingQty: itemQty,
        purchaseRate,
        landingCost,
        paymentCD: itemPaymentCDPerUnit,
        invoiceCloseCD: itemCloseCDPerUnit,
        schemeCD: itemSchemeCDPerUnit,
        expense: itemExpensePerUnit,
        batchNo: `LOT-${inv.invoiceNo}-${idx + 1}`
      })
    })
  })

  return layers
}

/**
 * Runs FIFO consumption logic on Sales Invoices against Purchase Layers.
 * Converts cost per unit seamlessly to the Sale Item's active/alternate unit.
 */
export function allocateSalesFIFO(
  salesInvoices: SalesInvoice[],
  purchaseLayers: PurchaseLayer[],
  items: Item[],
  customers: Customer[] = []
): { allocations: SaleAllocation[]; updatedLayers: PurchaseLayer[] } {
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  // Clone purchase layers so we can track remaining quantities
  const layers = purchaseLayers.map(l => ({ ...l }))

  // Sort sales invoices chronologically
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
      const saleActiveUnit = saleRow.entryUnit || itemDef?.alternativeUnit || itemDef?.unit || 'MT'
      let neededQty = saleRow.entryQuantity && saleRow.entryQuantity > 0 ? saleRow.entryQuantity : (saleRow.quantityMT || 0)
      if (neededQty <= 0) return

      const saleUnitWeightKG = saleRow.weightKG && neededQty > 0
        ? saleRow.weightKG / neededQty
        : (itemDef?.conversionFactor || (saleActiveUnit === 'MT' ? 1000 : 1))

      // Rate inclusive of GST per saleActiveUnit
      const sellingPrice = saleRow.rate || 0

      // Find available purchase layers for this item in FIFO order (oldest first)
      const itemLayers = layers.filter(l => l.itemId === saleRow.itemId && l.remainingQty > 0)

      if (itemLayers.length === 0) {
        // Fallback if no purchase layer available yet
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
          activeUnit: saleActiveUnit,
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

        // Convert layer landing cost to the sale row's active unit if different
        let fifoCostInSaleUnit = layer.landingCost
        if (layer.activeUnit !== saleActiveUnit) {
          const layerCostPerKG = layer.unitWeightKG > 0 ? layer.landingCost / layer.unitWeightKG : layer.landingCost / 1000
          fifoCostInSaleUnit = layerCostPerKG * saleUnitWeightKG
        }

        const profitPerUnit = sellingPrice - fifoCostInSaleUnit
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
          activeUnit: saleActiveUnit,
          allocatedQty: takeQty,
          fifoCostPerUnit: fifoCostInSaleUnit,
          sellingPricePerUnit: sellingPrice,
          profitPerUnit,
          totalProfit,
          saleDate: saleInv.invoiceDate
        })
      }

      // If still remaining unallocated qty after exhausting layers
      if (neededQty > 0) {
        const lastLayer = itemLayers[itemLayers.length - 1]
        let lastLayerCost = itemDef?.purchasePrice || sellingPrice
        if (lastLayer) {
          lastLayerCost = lastLayer.activeUnit === saleActiveUnit
            ? lastLayer.landingCost
            : (lastLayer.unitWeightKG > 0 ? (lastLayer.landingCost / lastLayer.unitWeightKG) * saleUnitWeightKG : lastLayer.landingCost)
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
          activeUnit: saleActiveUnit,
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
 * Filter items by date range (Daily, Weekly, Monthly, Custom)
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
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
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
      const activeUnit = itemRow.entryUnit || itemDef?.alternativeUnit || itemDef?.unit || 'MT'
      const itemQty = itemRow.entryQuantity && itemRow.entryQuantity > 0 ? itemRow.entryQuantity : (itemRow.quantityMT || 0)
      const unitWeightKG = itemRow.weightKG && itemQty > 0
        ? itemRow.weightKG / itemQty
        : (itemDef?.conversionFactor || (activeUnit === 'MT' ? 1000 : 1))
      const itemWeight = itemRow.weightKG || (itemQty * unitWeightKG)
      return sum + itemWeight
    }, 0)

    const paymentCDRatePerKG = totalInvoiceWeightKG > 0 ? paymentCDTotal / totalInvoiceWeightKG : 0
    const closeCDRatePerKG = totalInvoiceWeightKG > 0 ? closeCDTotal / totalInvoiceWeightKG : 0
    const schemeCDRatePerKG = totalInvoiceWeightKG > 0 ? fixedSchemeTotal / totalInvoiceWeightKG : 0;

    (inv.items || []).forEach((itemRow, idx) => {
      if (!itemRow.itemId) return
      if (filters?.itemId && filters.itemId !== 'all' && itemRow.itemId !== filters.itemId) return

      const itemDef = itemMap.get(itemRow.itemId)
      if (filters?.category && filters.category !== 'all' && itemDef?.category !== filters.category) return

      const activeUnit = itemRow.entryUnit || itemDef?.alternativeUnit || itemDef?.unit || 'MT'
      const itemQty = itemRow.entryQuantity && itemRow.entryQuantity > 0 ? itemRow.entryQuantity : (itemRow.quantityMT || 0)
      if (itemQty <= 0) return

      const unitWeightKG = itemRow.weightKG && itemQty > 0
        ? itemRow.weightKG / itemQty
        : (itemDef?.conversionFactor || (activeUnit === 'MT' ? 1000 : 1))

      const itemPaymentCD = paymentCDRatePerKG * unitWeightKG * itemQty
      const itemCloseCD = closeCDRatePerKG * unitWeightKG * itemQty
      const itemSchemeCD = schemeCDRatePerKG * unitWeightKG * itemQty
      const itemTotalCD = itemPaymentCD + itemCloseCD + itemSchemeCD

      // Rate inclusive of GST
      const purchaseAmount = (itemRow.rate || 0) * itemQty
      const avgCDPerUnit = itemQty > 0 ? itemTotalCD / itemQty : 0

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
        qty: itemQty,
        activeUnit,
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

  // Summary statistics calculation
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

  // Group allocations by Sales Invoice ID and Item ID
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

    // Weighted average FIFO cost per unit
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
