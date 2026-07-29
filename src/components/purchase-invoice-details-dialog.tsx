import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatMT, calculatePaymentAllocations, calculateExpectedDiscounts } from '@/lib/calculations'
import { getItemActiveUnitAndQty } from '@/lib/fifo-engine'
import { PurchaseInvoice, Payment, Supplier, Item, FixedScheme, ReceivedDiscount, ExpenseEntry } from '@/lib/types'
import { FileText, Package, Receipt, Calculator } from '@phosphor-icons/react'

interface PurchaseInvoiceDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: PurchaseInvoice | null
  payments: Payment[]
  suppliers: Supplier[]
  items: Item[]
  fixedSchemes: FixedScheme[]
  receivedDiscounts?: ReceivedDiscount[]
  expenseEntries?: ExpenseEntry[]
}

export function PurchaseInvoiceDetailsDialog({
  open,
  onOpenChange,
  invoice,
  payments,
  suppliers,
  items,
  fixedSchemes,
  expenseEntries = []
}: PurchaseInvoiceDetailsDialogProps) {
  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers])
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  const supplier = invoice ? supplierMap.get(invoice.supplierId) : null

  // Allocations & CD calculations
  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(
    () => calculatePaymentAllocations(payments, invoice ? [invoice] : []),
    [payments, invoice]
  )

  const expectedDiscounts = useMemo(
    () => calculateExpectedDiscounts(invoice ? [invoice] : [], payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes),
    [invoice, payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes]
  )

  const details = useMemo(() => {
    if (!invoice) return null

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

    return {
      paidAmount,
      pendingAmount,
      status,
      paymentCDTotal,
      closeCDTotal,
      fixedSchemeTotal,
      totalCDEarned,
      totalLinkedExpense,
      totalAdditionalCost,
      itemCostBreakdowns
    }
  }, [invoice, paymentAllocations, expectedDiscounts, expenseEntries, itemMap])

  if (!invoice || !details) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Purchase Invoice Details — {invoice.invoiceNo}</span>
            </div>
            <Badge variant={details.status === 'Closed' ? 'default' : details.status === 'Partially Paid' ? 'secondary' : 'outline'}>
              {details.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Supplier:</span>
            <p className="font-bold text-slate-900 text-sm mt-0.5">{supplier?.name || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Invoice Date:</span>
            <p className="font-semibold text-slate-800 mt-0.5">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Total Amount:</span>
            <p className="font-bold text-slate-900 font-mono text-sm mt-0.5">{formatCurrency(invoice.invoiceAmount)}</p>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Total Quantity:</span>
            <p className="font-semibold text-slate-800 font-mono mt-0.5">{formatMT(invoice.quantityMT)}</p>
          </div>
        </div>

        {/* Financial Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-slate-200/80 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Invoice Amount</span>
              <p className="text-base font-bold text-slate-900 font-mono mt-1">{formatCurrency(invoice.invoiceAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Paid Amount</span>
              <p className="text-base font-bold text-emerald-800 font-mono mt-1">{formatCurrency(details.paidAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-200/80 bg-amber-50/40 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">CD Earned</span>
              <p className="text-base font-bold text-amber-800 font-mono mt-1">{formatCurrency(details.totalCDEarned)}</p>
            </CardContent>
          </Card>
          <Card className="border-purple-200/80 bg-purple-50/40 shadow-2xs">
            <CardContent className="p-3">
              <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Linked Expense</span>
              <p className="text-base font-bold text-purple-800 font-mono mt-1">{formatCurrency(details.totalLinkedExpense + details.totalAdditionalCost)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Invoice Items Summary */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Package className="h-4 w-4 text-blue-600" />
            Invoice Items Summary
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 text-xs">
                  <TableHead className="font-bold">Item</TableHead>
                  <TableHead className="text-right font-bold">Quantity (Base & Alt)</TableHead>
                  <TableHead className="text-right font-bold">Rate (Incl. GST)</TableHead>
                  <TableHead className="text-right font-bold">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoice.items || []).map((item, idx) => {
                  const itemData = itemMap.get(item.itemId)
                  const active = getItemActiveUnitAndQty(itemData, item.entryUnit, item.entryQuantity, item.quantityMT, item.weightKG)
                  return (
                    <TableRow key={idx} className="text-xs">
                      <TableCell className="font-semibold text-slate-900">{itemData?.name || 'Unknown Item'}</TableCell>
                      <TableCell className="text-right font-mono font-medium text-slate-800">{active.displayQtyUnit}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Item-wise Cost Breakdown Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Calculator className="h-4 w-4 text-emerald-600" />
            Item-wise Cost & CD Breakdown (Calculated in Alternative Unit)
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 text-[11px]">
                  <TableHead className="font-bold">ITEM</TableHead>
                  <TableHead className="text-right font-bold">QTY / UNIT</TableHead>
                  <TableHead className="text-right font-bold">PRICE / UNIT (INCL. GST)</TableHead>
                  <TableHead className="text-right font-bold">FIXED DISC / UNIT</TableHead>
                  <TableHead className="text-right font-bold">PAYMENT CD / UNIT</TableHead>
                  <TableHead className="text-right font-bold">CLOSE CD / UNIT</TableHead>
                  <TableHead className="text-right font-bold">TOTAL CD / UNIT</TableHead>
                  <TableHead className="text-right font-bold">EXPENSE / UNIT</TableHead>
                  <TableHead className="text-right font-bold">ADD. COST / UNIT</TableHead>
                  <TableHead className="text-right font-bold text-emerald-700">LANDED COST / UNIT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {details.itemCostBreakdowns.map((b, idx) => (
                  <TableRow key={idx} className="text-xs font-medium">
                    <TableCell className="font-bold text-slate-900">{b.itemName}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-slate-800">{b.displayQtyUnit}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-slate-900">{formatCurrency(b.pricePerUnit)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{b.fixedDiscPerUnit > 0 ? `-${formatCurrency(b.fixedDiscPerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{b.paymentCDPerUnit > 0 ? `-${formatCurrency(b.paymentCDPerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{b.invoiceCloseCDPerUnit > 0 ? `-${formatCurrency(b.invoiceCloseCDPerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-700">{b.totalCDPerUnit > 0 ? `-${formatCurrency(b.totalCDPerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{b.expensePerUnit > 0 ? `+${formatCurrency(b.expensePerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{b.additionalCostPerUnit > 0 ? `+${formatCurrency(b.additionalCostPerUnit)}` : formatCurrency(0)}</TableCell>
                    <TableCell className="text-right font-mono font-extrabold text-blue-700">{formatCurrency(b.costPerUnit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
