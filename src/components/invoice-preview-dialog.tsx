import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatMT } from '@/lib/calculations'
import { Item, InvoiceItem, SaleAllocation } from '@/lib/types'

interface InvoicePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'sales' | 'purchase'
  invoiceNo: string
  invoiceDate: string
  partyName: string
  partyAddress?: string
  partyPhone?: string
  items: InvoiceItem[]
  itemMap: Map<string, Item>
  totalAmount: number
  fifoAllocations?: SaleAllocation[]
}

function getActiveBusinessName() {
  try {
    const metadata = JSON.parse(localStorage.getItem('app_metadata') || '{}')
    const active = metadata.businesses?.find((business: { id: string }) => business.id === metadata.activeCompanyId)
    return active?.name || 'SK TRADERS'
  } catch {
    return 'SK TRADERS'
  }
}

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  mode,
  invoiceNo,
  invoiceDate,
  partyName,
  partyAddress,
  partyPhone,
  items,
  itemMap,
  totalAmount,
  fifoAllocations
}: InvoicePreviewDialogProps) {
  const businessName = getActiveBusinessName()
  const title = mode === 'sales' ? 'TAX INVOICE' : 'BILL OF SUPPLY'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="invoice-preview-dialog max-w-[980px] p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{title} {invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="invoice-preview-shell">
          <div className="invoice-preview-toolbar">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated Invoice</p>
              <h2 className="text-lg font-semibold">{invoiceNo}</h2>
            </div>
            <Button type="button" size="sm" onClick={() => window.print()}>
              Print
            </Button>
          </div>

          <div className="billbook-page">
            <div className="billbook-topline">
              <span>{title}</span>
              <span>ORIGINAL FOR RECIPIENT</span>
            </div>

            <div className="billbook-header">
              <h1>{businessName}</h1>
              <p>West Bengal</p>
              <p>Mobile: 9083876218</p>
            </div>

            <div className="billbook-party-row">
              <div>
                <p className="billbook-label">{mode === 'sales' ? 'BILL TO' : 'SUPPLIER'}</p>
                <h3>{partyName}</h3>
                <p>Address: {partyAddress || '-'}</p>
                <p>Mobile: {partyPhone || '-'}</p>
              </div>
              <div className="billbook-meta-grid">
                <div>
                  <p>Invoice No.</p>
                  <strong>{invoiceNo}</strong>
                </div>
                <div>
                  <p>Invoice Date</p>
                  <strong>{new Date(invoiceDate).toLocaleDateString('en-IN')}</strong>
                </div>
                <div>
                  <p>Due Date</p>
                  <strong>-</strong>
                </div>
              </div>
            </div>

            <table className="billbook-table">
              <thead>
                <tr>
                  <th>S.NO.</th>
                  <th>ITEMS</th>
                  <th>QTY.</th>
                  <th>RATE</th>
                  <th>DISC.</th>
                  <th>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No items</td>
                  </tr>
                ) : items.map((line, index) => {
                  const item = itemMap.get(line.itemId)
                  const unit = line.entryUnit || item?.unit || 'MT'
                  const qty = (line.entryQuantity !== undefined && line.entryQuantity !== null && line.entryQuantity > 0)
                    ? line.entryQuantity
                    : (line.quantityMT || 0)
                  const rate = line.rate || (qty > 0 ? line.amount / qty : 0)
                  return (
                    <tr key={`${line.itemId}-${index}`}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{item?.name || 'Unknown item'}</strong>
                        <span>{item?.description || unit}</span>
                      </td>
                      <td>{qty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} {unit}</td>
                      <td>{formatCurrency(rate)}</td>
                      <td>0</td>
                      <td>{formatCurrency(line.amount)}</td>
                    </tr>
                  )
                })}
                {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, index) => (
                  <tr key={`blank-${index}`} className="billbook-empty-row">
                    <td>&nbsp;</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Total</td>
                  <td>{formatCurrency(totalAmount)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Module 9: Invoice-Level Cost Details & FIFO Traceability */}
            {mode === 'sales' && fifoAllocations && fifoAllocations.length > 0 && (
              <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 print:break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    FIFO Cost Allocation & Profit Traceability
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-500 font-mono">
                    Batch-to-Lot Mapping
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="py-2 px-2">Item Name</th>
                        <th className="py-2 px-2 text-right">Allocated Qty</th>
                        <th className="py-2 px-2">From Purchase Lot</th>
                        <th className="py-2 px-2 text-right">Landed Cost</th>
                        <th className="py-2 px-2 text-right">Selling Rate</th>
                        <th className="py-2 px-2 text-right font-extrabold">Gross Profit / Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 font-mono">
                      {fifoAllocations.map((alloc, idx) => (
                        <tr key={idx} className="hover:bg-white/80">
                          <td className="py-2 px-2 font-sans font-semibold text-slate-800">{alloc.itemName}</td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900">{alloc.allocatedQty.toLocaleString()} {alloc.activeUnit}</td>
                          <td className="py-2 px-2 font-sans font-bold text-blue-700">{alloc.purchaseInvoiceNo} ({alloc.supplierName})</td>
                          <td className="py-2 px-2 text-right text-amber-900 font-bold">{formatCurrency(alloc.fifoCostPerUnit)}</td>
                          <td className="py-2 px-2 text-right font-bold">{formatCurrency(alloc.sellingPricePerUnit)}</td>
                          <td className={`py-2 px-2 text-right font-extrabold ${alloc.profitPerUnit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {alloc.profitPerUnit >= 0 ? '+' : ''}{formatCurrency(alloc.profitPerUnit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
