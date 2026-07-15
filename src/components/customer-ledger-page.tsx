import { useState, useMemo } from 'react'
import { Customer, SalesInvoice, CustomerPayment, LedgerEntry } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BookOpen, TrendUp, TrendDown } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/calculations'

interface CustomerLedgerPageProps {
  customers: Customer[]
  salesInvoices: SalesInvoice[]
  customerPayments: CustomerPayment[]
  currentFY: string
}

export default function CustomerLedgerPage({ customers, salesInvoices, customerPayments, currentFY }: CustomerLedgerPageProps) {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const ledgerEntries = useMemo(() => {
    if (!selectedCustomerId) return []

    const entries: LedgerEntry[] = []
    
    const customer = customers.find(c => c.id === selectedCustomerId)
    const openingBalance = customer?.openingBalance || 0

    if (openingBalance !== 0) {
      entries.push({
        date: '1900-01-01',
        description: 'Opening Balance',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: 0,
        type: 'invoice',
        refId: 'opening-balance'
      })
    }

    const customerInvoices = salesInvoices.filter(
      inv => inv.customerId === selectedCustomerId && inv.fy === currentFY
    )
    const customerPaymentsFiltered = customerPayments.filter(
      pay => pay.customerId === selectedCustomerId && pay.fy === currentFY
    )

    customerInvoices.forEach(invoice => {
      entries.push({
        date: invoice.invoiceDate,
        description: `Sales Invoice`,
        invoiceNo: invoice.invoiceNo,
        debit: invoice.invoiceAmount,
        credit: 0,
        balance: 0,
        type: 'invoice',
        refId: invoice.id
      })
    })

    customerPaymentsFiltered.forEach(payment => {
      entries.push({
        date: payment.paymentDate,
        description: 'Payment Received',
        debit: 0,
        credit: payment.amount,
        balance: 0,
        type: 'payment',
        refId: payment.id
      })
    })

    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let runningBalance = 0
    entries.forEach(entry => {
      runningBalance += entry.debit - entry.credit
      entry.balance = runningBalance
    })

    return entries
  }, [selectedCustomerId, salesInvoices, customerPayments, currentFY, customers])

  const summary = useMemo(() => {
    const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0)
    const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0)
    const closingBalance = totalDebit - totalCredit

    return { totalDebit, totalCredit, closingBalance }
  }, [ledgerEntries])

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen size={24} weight="duotone" className="text-primary" />
            Customer Ledger
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Select Customer</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a customer to view ledger" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCustomerId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Sales</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary.totalDebit)}</p>
                        </div>
                        <TrendUp size={32} weight="duotone" className="text-success" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Received</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(summary.totalCredit)}</p>
                        </div>
                        <TrendDown size={32} weight="duotone" className="text-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`bg-gradient-to-br ${
                    summary.closingBalance > 0 
                      ? 'from-warning/10 to-warning/5 border-warning/20' 
                      : 'from-success/10 to-success/5 border-success/20'
                  }`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Outstanding Balance</p>
                          <p className="text-2xl font-semibold text-foreground">{formatCurrency(Math.abs(summary.closingBalance))}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {summary.closingBalance > 0 ? 'To Receive' : summary.closingBalance < 0 ? 'Advance Received' : 'Cleared'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold mb-3 text-foreground">
                    Ledger Entries for {selectedCustomer?.name} - FY {currentFY}
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
                              No transactions found for this customer in FY {currentFY}.
                            </TableCell>
                          </TableRow>
                        ) : (
                          <>
                            {ledgerEntries.map((entry, index) => (
                              <TableRow key={`${entry.refId}-${index}`}>
                                <TableCell>{new Date(entry.date).toLocaleDateString('en-IN')}</TableCell>
                                <TableCell className="font-medium">{entry.description}</TableCell>
                                <TableCell className="font-mono text-sm">{entry.invoiceNo || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-success">
                                  {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-primary">
                                  {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-semibold ${
                                  entry.balance > 0 ? 'text-warning' : entry.balance < 0 ? 'text-success' : 'text-muted-foreground'
                                }`}>
                                  {formatCurrency(Math.abs(entry.balance))}
                                  {entry.balance > 0 && ' Dr'}
                                  {entry.balance < 0 && ' Cr'}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={3} className="text-right">Total</TableCell>
                              <TableCell className="text-right font-mono text-success">
                                {formatCurrency(summary.totalDebit)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-primary">
                                {formatCurrency(summary.totalCredit)}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${
                                summary.closingBalance > 0 ? 'text-warning' : summary.closingBalance < 0 ? 'text-success' : 'text-muted-foreground'
                              }`}>
                                {formatCurrency(Math.abs(summary.closingBalance))}
                                {summary.closingBalance > 0 && ' Dr'}
                                {summary.closingBalance < 0 && ' Cr'}
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

            {!selectedCustomerId && (
              <div className="border border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                <BookOpen size={48} weight="duotone" className="mx-auto mb-3 opacity-30" />
                <p>Select a customer to view their ledger</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
