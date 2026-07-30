import { useMemo } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatMT, calculatePaymentAllocations, calculateExpectedDiscounts } from '@/lib/calculations'
import { getItemActiveUnitAndQty } from '@/lib/fifo-engine'
import { PurchaseInvoice, Payment, Supplier, Item, FixedScheme, ReceivedDiscount, ExpenseEntry } from '@/lib/types'
import { FileText, Package, Calculator, ArrowLeft, DownloadSimple } from '@phosphor-icons/react'

interface PurchaseInvoiceDetailsViewProps {
  invoice: PurchaseInvoice
  payments: Payment[]
  suppliers: Supplier[]
  items: Item[]
  fixedSchemes?: FixedScheme[]
  receivedDiscounts?: ReceivedDiscount[]
  expenseEntries?: ExpenseEntry[]
  onBack?: () => void
}

export function PurchaseInvoiceDetailsView({
  invoice,
  payments,
  suppliers,
  items,
  fixedSchemes = [],
  expenseEntries = [],
  onBack
}: PurchaseInvoiceDetailsViewProps) {
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers])
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  const supplier = supplierMap.get(invoice.supplierId)

  // Allocations & CD calculations
  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(
    () => calculatePaymentAllocations(payments, [invoice]),
    [payments, invoice]
  )

  const expectedDiscounts = useMemo(
    () => calculateExpectedDiscounts([invoice], payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes),
    [invoice, payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes]
  )

  const details = useMemo(() => {
    const invAllocations = paymentAllocations.filter(a => a.invoiceId === invoice.id)
    const paidAmount = invAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
    const pendingAmount = Math.max(0, invoice.invoiceAmount - paidAmount)

    const status = pendingAmount === 0 ? 'Closed' : paidAmount > 0 ? 'Partially Paid' : 'Open'

    const invoiceDiscounts = expectedDiscounts.filter(ed => ed.invoiceId === invoice.id)
    const paymentCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'paymentCD' || ed.type === 'advanceCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const closeCDTotal = invoiceDiscounts
      .filter(ed => ed.type === 'invoiceCloseCD')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)
    const fixedSchemeTotal = invoiceDiscounts
      .filter(ed => ed.type === 'fixedScheme')
      .reduce((sum, ed) => sum + ed.expectedAmount, 0)

    const totalCDEarned = paymentCDTotal + closeCDTotal + fixedSchemeTotal

    const linkedExpenses = expenseEntries.filter(exp => exp.linkedInvoiceId === invoice.id)
    const totalLinkedExpense = linkedExpenses.reduce((sum, exp) => sum + exp.amount, 0)
    const totalAdditionalCost = invoice.additionalCost || 0

    // Base Weight in KG
    const totalInvoiceWeightKG = (invoice.items || []).reduce((sum, item) => {
      const itemData = itemMap.get(item.itemId)
      const baseQty = item.entryQuantity || item.quantityMT || 0
      const unitWeight = item.weightKG && baseQty > 0
        ? item.weightKG / baseQty
        : (itemData?.conversionFactor || (item.entryUnit === 'MT' || itemData?.unit === 'MT' ? 1000 : 1))
      const itemWeight = item.weightKG || (baseQty * unitWeight)
      return sum + itemWeight
    }, 0)

    // Per item cost breakdowns
    const itemCostBreakdowns = (invoice.items || []).map(item => {
      const itemData = itemMap.get(item.itemId)
      const active = getItemActiveUnitAndQty(itemData, item.entryUnit, item.entryQuantity, item.quantityMT, item.weightKG)

      const activeUnit = active.unit
      const activeQuantity = active.qty
      const displayQtyUnit = active.displayQtyUnit

      const baseQty = item.entryQuantity || item.quantityMT || 1
      const totalItemAmount = item.amount || ((item.rate || 0) * baseQty)
      const pricePerUnit = activeQuantity > 0 ? totalItemAmount / activeQuantity : (item.rate || 0)

      const itemWeightKG = item.weightKG || (item.quantityMT ? item.quantityMT * 1000 : 0) || (activeQuantity * (itemData?.conversionFactor || 1))
      const weightShare = totalInvoiceWeightKG > 0 ? itemWeightKG / totalInvoiceWeightKG : 0

      const itemFixedDiscTotal = fixedSchemeTotal * weightShare
      const itemPaymentCDTotal = paymentCDTotal * weightShare
      const itemCloseCDTotal = closeCDTotal * weightShare
      const itemTotalCDTotal = totalCDEarned * weightShare

      const itemExpenseTotal = totalLinkedExpense * weightShare
      const itemAddCostTotal = totalAdditionalCost * weightShare

      const fixedDiscPerUnit = activeQuantity > 0 ? itemFixedDiscTotal / activeQuantity : 0
      const paymentCDPerUnit = activeQuantity > 0 ? itemPaymentCDTotal / activeQuantity : 0
      const invoiceCloseCDPerUnit = activeQuantity > 0 ? itemCloseCDTotal / activeQuantity : 0
      const totalCDPerUnit = activeQuantity > 0 ? itemTotalCDTotal / activeQuantity : 0

      const expensePerUnit = activeQuantity > 0 ? itemExpenseTotal / activeQuantity : 0
      const additionalCostPerUnit = activeQuantity > 0 ? itemAddCostTotal / activeQuantity : 0

      const costPerUnit = pricePerUnit - totalCDPerUnit + expensePerUnit + additionalCostPerUnit

      return {
        itemId: item.itemId,
        itemName: itemData?.name || 'Unknown Item',
        activeUnit,
        activeQuantity,
        displayQtyUnit,
        pricePerUnit,
        fixedDiscPerUnit,
        paymentCDPerUnit,
        invoiceCloseCDPerUnit,
        totalCDPerUnit,
        expensePerUnit,
        additionalCostPerUnit,
        costPerUnit
      }
    })

    const fixedSchemeDiscounts = invoiceDiscounts.filter(ed => ed.type === 'fixedScheme')

    return {
      paidAmount,
      pendingAmount,
      status,
      paymentCDTotal,
      closeCDTotal,
      fixedSchemeTotal,
      fixedSchemeDiscounts,
      totalCDEarned,
      totalLinkedExpense,
      totalAdditionalCost,
      itemCostBreakdowns
    }
  }, [invoice, paymentAllocations, expectedDiscounts, expenseEntries, itemMap])

  return (
    <div className="space-y-6 pb-12">
      {/* Full Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="gap-2 font-bold text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Purchase Invoices
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 font-mono">Invoice #{invoice.invoiceNo}</h1>
              <Badge variant={details.status === 'Closed' ? 'default' : details.status === 'Partially Paid' ? 'secondary' : 'outline'}>
                {details.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Full Invoice Details Report & Item-wise Alternative Unit Landed Cost Analysis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 font-medium">
            <DownloadSimple size={15} />
            Print / Export
          </Button>
        </div>
      </div>

      {/* Invoice Meta Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-200/60 text-xs">
        <div>
          <span className="text-slate-500 font-medium uppercase tracking-wider text-[11px]">Supplier Name</span>
          <p className="font-bold text-slate-900 text-sm mt-1">{supplier?.name || 'Unknown Supplier'}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase tracking-wider text-[11px]">Invoice Date</span>
          <p className="font-bold text-slate-800 text-sm mt-1">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase tracking-wider text-[11px]">Total Invoice Amount</span>
          <p className="font-bold text-slate-900 font-mono text-base mt-1">{formatCurrency(invoice.invoiceAmount)}</p>
        </div>
        <div>
          <span className="text-slate-500 font-medium uppercase tracking-wider text-[11px]">Total Quantity</span>
          <p className="font-bold text-slate-800 font-mono text-sm mt-1">{formatMT(invoice.quantityMT)}</p>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Invoice Amount</span>
            <p className="text-lg font-bold text-slate-900 font-mono mt-1">{formatCurrency(invoice.invoiceAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Paid Amount</span>
            <p className="text-lg font-bold text-emerald-800 font-mono mt-1">{formatCurrency(details.paidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200/80 bg-amber-50/40 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">CD Earned</span>
            <p className="text-lg font-bold text-amber-800 font-mono mt-1">{formatCurrency(details.totalCDEarned)}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200/80 bg-purple-50/40 shadow-2xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Linked Expense</span>
            <p className="text-lg font-bold text-purple-800 font-mono mt-1">{formatCurrency(details.totalLinkedExpense + details.totalAdditionalCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* MT Booking Locked Schemes Cost Breakdown */}
      {details.fixedSchemeDiscounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Calculator className="h-5 w-5 text-indigo-600" />
            MT Booking Locked Scheme Cost Breakdown
          </h3>
          <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-50/50 to-blue-50/50 p-4 shadow-2xs">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {details.fixedSchemeDiscounts.map((fs, idx) => (
                <div key={idx} className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-indigo-100/80">
                  <div className="text-xs font-bold text-indigo-900 flex items-center justify-between">
                    <span>{fs.schemeName || fs.ruleName || 'MT Scheme'}</span>
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                      Locked
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500 font-medium">Rate / MT:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(fs.ratePerMT)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-xs">
                    <span className="text-slate-500 font-medium">Consumed Qty:</span>
                    <span className="font-mono font-semibold text-slate-700">{formatMT(fs.eligibleQuantityMT)}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-indigo-50 flex items-baseline justify-between">
                    <span className="text-[11px] font-bold text-indigo-900 uppercase">Total Discount:</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">{formatCurrency(fs.expectedAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Items Summary */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-600" />
          Invoice Items Summary
        </h3>
        <div className="border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/90 text-xs">
                <TableHead className="font-bold py-3">Item Name</TableHead>
                <TableHead className="text-right font-bold py-3">Quantity (Entry & Converted Alt Unit)</TableHead>
                <TableHead className="text-right font-bold py-3">Rate (Incl. GST)</TableHead>
                <TableHead className="text-right font-bold py-3">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.items || []).map((item, idx) => {
                const itemData = itemMap.get(item.itemId)
                const active = getItemActiveUnitAndQty(itemData, item.entryUnit, item.entryQuantity, item.quantityMT, item.weightKG)
                return (
                  <TableRow key={idx} className="text-xs hover:bg-slate-50/60">
                    <TableCell className="font-bold text-slate-900 py-3">{itemData?.name || 'Unknown Item'}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-slate-800 py-3">{active.displayQtyUnit}</TableCell>
                    <TableCell className="text-right font-mono py-3">{formatCurrency(item.rate)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-slate-900 py-3">{formatCurrency(item.amount)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Item-wise Cost Breakdown Table */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-emerald-600" />
          Item-wise Cost & CD Breakdown (Calculated in Alternative Unit)
        </h3>
        <div className="border border-slate-200/80 rounded-2xl overflow-x-auto bg-white shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/90 text-[11px]">
                <TableHead className="font-bold py-3">ITEM</TableHead>
                <TableHead className="text-right font-bold py-3">QTY / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">PRICE / UNIT (INCL. GST)</TableHead>
                <TableHead className="text-right font-bold py-3">FIXED DISC / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">PAYMENT CD / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">CLOSE CD / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">TOTAL CD / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">EXPENSE / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3">ADD. COST / UNIT</TableHead>
                <TableHead className="text-right font-bold py-3 text-emerald-700">LANDED COST / UNIT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.itemCostBreakdowns.map((b, idx) => (
                <TableRow key={idx} className="text-xs font-medium hover:bg-slate-50/60">
                  <TableCell className="font-bold text-slate-900 py-3">{b.itemName}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-800 py-3">{b.displayQtyUnit}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900 py-3">{formatCurrency(b.pricePerUnit)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 py-3">{b.fixedDiscPerUnit > 0 ? `-${formatCurrency(b.fixedDiscPerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 py-3">{b.paymentCDPerUnit > 0 ? `-${formatCurrency(b.paymentCDPerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600 py-3">{b.invoiceCloseCDPerUnit > 0 ? `-${formatCurrency(b.invoiceCloseCDPerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono font-bold text-emerald-700 py-3">{b.totalCDPerUnit > 0 ? `-${formatCurrency(b.totalCDPerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600 py-3">{b.expensePerUnit > 0 ? `+${formatCurrency(b.expensePerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600 py-3">{b.additionalCostPerUnit > 0 ? `+${formatCurrency(b.additionalCostPerUnit)}` : formatCurrency(0)}</TableCell>
                  <TableCell className="text-right font-mono font-extrabold text-blue-700 py-3">{formatCurrency(b.costPerUnit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
