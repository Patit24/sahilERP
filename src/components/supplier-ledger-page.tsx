import { useState, useMemo } from 'react'
import { Supplier, PurchaseInvoice, Payment, LedgerEntry } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { BookOpen, TrendUp, TrendDown, FilePdf } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/calculations'
import { exportSupplierLedgerPDF, SupplierLedgerEntry } from '@/lib/pdf-export'
import { toast } from 'sonner'

interface SupplierLedgerPageProps {
  suppliers: Supplier[]
  invoices: PurchaseInvoice[]
  payments: Payment[]
  currentFY: string
  businessName?: string
}

export default function SupplierLedgerPage({ suppliers, invoices, payments, currentFY, businessName }: SupplierLedgerPageProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')

  const ledgerEntries = useMemo(() => {
    if (!selectedSupplierId) return []

    const entries: LedgerEntry[] = []
    
    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    const openingBalance = supplier?.openingBalance || 0

    if (openingBalance !== 0) {
      entries.push({
        date: '1900-01-01',
        description: 'Opening Balance',
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: 0,
        type: 'invoice',
        refId: 'opening-balance'
      })
    }

    const supplierInvoices = invoices.filter(
      inv => inv.supplierId === selectedSupplierId && inv.fy === currentFY
    )
    const supplierPayments = payments.filter(
      pay => pay.supplierId === selectedSupplierId && pay.fy === currentFY
    )

    const entriesWithTimestamp: Array<LedgerEntry & { timestamp: number }> = []

    supplierInvoices.forEach(invoice => {
      const timestamp = invoice.createdAt || new Date(invoice.invoiceDate).getTime()
      entriesWithTimestamp.push({
        date: invoice.invoiceDate,
        description: `Purchase Invoice`,
        invoiceNo: invoice.invoiceNo,
        debit: 0,
        credit: invoice.invoiceAmount,
        balance: 0,
        type: 'invoice',
        refId: invoice.id,
        timestamp
      })
    })

    supplierPayments.forEach(payment => {
      const timestamp = payment.createdAt || new Date(payment.paymentDate).getTime()
      entriesWithTimestamp.push({
        date: payment.paymentDate,
        description: 'Payment',
        debit: payment.amount,
        credit: 0,
        balance: 0,
        type: 'payment',
        refId: payment.id,
        timestamp
      })
    })

    entriesWithTimestamp.sort((a, b) => {
      const dateA = new Date(a.date).toISOString().split('T')[0]
      const dateB = new Date(b.date).toISOString().split('T')[0]
      
      if (dateA !== dateB) {
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      }
      
      return a.timestamp - b.timestamp
    })

    entries.push(...entriesWithTimestamp)

    let runningBalance = 0
    entries.forEach(entry => {
      runningBalance += entry.credit - entry.debit
      entry.balance = runningBalance
    })

    return entries
  }, [selectedSupplierId, invoices, payments, currentFY, suppliers])

  const summary = useMemo(() => {
    const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0)
    const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0)
    const closingBalance = totalCredit - totalDebit

    return { totalDebit, totalCredit, closingBalance }
  }, [ledgerEntries])

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)

  const handleExportPDF = () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier first')
      return
    }

    if (ledgerEntries.length === 0) {
      toast.error('No transactions to export')
      return
    }

    const exportEntries: SupplierLedgerEntry[] = ledgerEntries.map(entry => ({
      date: entry.date,
      description: entry.description,
      invoiceNo: entry.invoiceNo,
      debit: entry.debit,
      credit: entry.credit,
      balance: entry.balance,
      type: entry.type,
      refId: entry.refId
    }))

    exportSupplierLedgerPDF(exportEntries, {
      supplierName: selectedSupplier.name,
      fy: currentFY,
      businessName,
      totalDebit: summary.totalDebit,
      totalCredit: summary.totalCredit,
      closingBalance: summary.closingBalance,
      openingBalance: selectedSupplier.openingBalance || 0
    })

    toast.success('PDF exported successfully')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Supplier Ledger</h2>
          <p className="text-sm text-muted-foreground mt-1">
            View supplier transaction history and outstanding balances
          </p>
        </div>
        {selectedSupplierId && ledgerEntries.length > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportPDF}
          >
            <FilePdf className="mr-2" size={16} />
            Export PDF
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen size={24} weight="duotone" className="text-primary" />
            Supplier Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Supplier</label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a supplier to view ledger" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedSupplierId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Payments</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary.totalDebit)}</p>
                        </div>
                        <TrendUp size={32} weight="duotone" className="text-destructive" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Purchases</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary.totalCredit)}</p>
                        </div>
                        <TrendDown size={32} weight="duotone" className="text-success" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`bg-gradient-to-br ${
                    summary.closingBalance > 0 
                      ? 'from-success/10 to-success/5 border-success/20' 
                      : 'from-warning/10 to-warning/5 border-warning/20'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(Math.abs(summary.closingBalance))}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {summary.closingBalance > 0 ? 'To Pay' : summary.closingBalance < 0 ? 'Advance' : 'Cleared'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">
                    Ledger Entries for {selectedSupplier?.name} - FY {currentFY}
                  </h4>
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          <TableHead className="font-semibold">Invoice No</TableHead>
                          <TableHead className="font-semibold text-right">Debit (₹)</TableHead>
                          <TableHead className="font-semibold text-right">Credit (₹)</TableHead>
                          <TableHead className="font-semibold text-right">Balance (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No transactions found for this supplier in FY {currentFY}.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {ledgerEntries.map((entry, index) => (
                              <TableRow key={`${entry.refId}-${index}`}>
                                <TableCell>{new Date(entry.date).toLocaleDateString('en-IN')}</TableCell>
                                <TableCell className="font-medium">{entry.description}</TableCell>
                                <TableCell className="font-mono text-sm">{entry.invoiceNo || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-destructive">
                                  {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-success">
                                  {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-semibold ${
                                  entry.balance > 0 ? 'text-success' : entry.balance < 0 ? 'text-warning' : 'text-muted-foreground'
                                }`}>
                                  {formatCurrency(Math.abs(entry.balance))}
                                  {entry.balance > 0 && ' Cr'}
                                  {entry.balance < 0 && ' Dr'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={3} className="text-right">Total</TableCell>
                              <TableCell className="text-right font-mono text-destructive">
                                {formatCurrency(summary.totalDebit)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-success">
                                {formatCurrency(summary.totalCredit)}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${
                                summary.closingBalance > 0 ? 'text-success' : summary.closingBalance < 0 ? 'text-warning' : 'text-muted-foreground'
                              }`}>
                                {formatCurrency(Math.abs(summary.closingBalance))}
                                {summary.closingBalance > 0 && ' Cr'}
                                {summary.closingBalance < 0 && ' Dr'}
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {!selectedSupplierId && (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                <BookOpen size={48} weight="duotone" className="mx-auto mb-3 opacity-30" />
                <p>Select a supplier to view their ledger</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
