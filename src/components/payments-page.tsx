import { useEffect, useState, useMemo } from 'react'
import { FixedScheme, Item, MTBooking, Payment, PurchaseInvoice, Supplier } from '@/lib/types'
import { Counter, CashBankTransaction } from '@/lib/cash-bank-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, CurrencyDollar, Trash, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple } from '@phosphor-icons/react'
import { formatCurrency, calculatePaymentAllocations, isPaymentAdvance, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { exportPurchaseInvoicePDF } from '@/lib/pdf-export'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'

interface PaymentsPageProps {
  payments: Payment[]
  setPayments: (updater: (prev: Payment[]) => Payment[]) => void
  setMTBookings: (updater: (prev: MTBooking[]) => MTBooking[]) => void
  invoices: PurchaseInvoice[]
  items: Item[]
  suppliers: Supplier[]
  fixedSchemes: FixedScheme[]
  currentFY: string
  isLocked?: boolean
  counters: Counter[]
  transactions: CashBankTransaction[]
  onUpdateCashBank: (counters: Counter[], transactions: CashBankTransaction[]) => void
}

export default function PaymentsPage({ payments, setPayments, setMTBookings, invoices, items, suppliers, fixedSchemes, currentFY, isLocked = false, counters, transactions, onUpdateCashBank }: PaymentsPageProps) {
  const [open, setOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [doNotApplyCD, setDoNotApplyCD] = useState(false)
  const [advanceBookingEnabled, setAdvanceBookingEnabled] = useState(false)
  const [formSupplierId, setFormSupplierId] = useState('')
  const [selectedCounterId, setSelectedCounterId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [bookingMTInput, setBookingMTInput] = useState('')
  const [bookingMarketRateInput, setBookingMarketRateInput] = useState('')
  
  const fyPayments = payments.filter(p => p.fy === currentFY)
  const fyInvoices = invoices.filter(inv => inv.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const { allocations, paymentAdvanceInfo } = useMemo(() => 
    calculatePaymentAllocations(fyPayments, fyInvoices),
    [fyPayments, fyInvoices]
  )
  
  const filteredPayments = useMemo(() => {
    let result = fyPayments
    
    if (selectedMonth !== 'all') {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'))
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'))
      
      result = result.filter(p => {
        const pDate = parseISO(p.paymentDate)
        return isWithinInterval(pDate, { start: monthStart, end: monthEnd })
      })
    }
    
    if (selectedSupplier !== 'all') {
      result = result.filter(p => p.supplierId === selectedSupplier)
    }
    
    return result
  }, [fyPayments, selectedMonth, selectedSupplier])
  
  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  const paymentAmountNumber = parseFloat(paymentAmount) || 0

  const bookingMonthSupplierRate = useMemo(() => {
    if (!formSupplierId) return null

    const latestInvoice = fyInvoices
      .filter((invoice) => invoice.supplierId === formSupplierId && invoice.quantityMT > 0)
      .sort((a, b) => {
        const dateDiff = new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
        if (dateDiff !== 0) return dateDiff
        return (b.createdAt || 0) - (a.createdAt || 0)
      })[0]

    if (!latestInvoice) return null

    const lineRate = latestInvoice.items?.length
      ? latestInvoice.items.reduce((sum, item) => {
          const quantity = item.quantityMT || 0
          const rate = item.basicRate && item.basicRate > 0 ? item.basicRate : item.rate
          return sum + (quantity * rate)
        }, 0) /
        Math.max(latestInvoice.items.reduce((sum, item) => sum + (item.quantityMT || 0), 0), 1)
      : 0
    const invoiceRate = latestInvoice.invoiceAmount / latestInvoice.quantityMT
    const rate = lineRate > 0 ? lineRate : invoiceRate

    if (!Number.isFinite(rate) || rate <= 0) return null

    return {
      rate,
      invoiceNo: latestInvoice.invoiceNo,
      invoiceDate: latestInvoice.invoiceDate,
    }
  }, [formSupplierId, fyInvoices])

  const bookingMarketRateNumber = parseFloat(bookingMarketRateInput) || 0
  const effectiveBookingMarketRate = bookingMarketRateNumber > 0
    ? bookingMarketRateNumber
    : (bookingMonthSupplierRate?.rate || 0)
  const calculatedBookingMT = effectiveBookingMarketRate > 0 && paymentAmountNumber > 0
    ? paymentAmountNumber / effectiveBookingMarketRate
    : 0

  useEffect(() => {
    if (!advanceBookingEnabled || editingPayment) return
    if (!bookingMonthSupplierRate || paymentAmountNumber <= 0) return
    setBookingMarketRateInput((prev) => prev || bookingMonthSupplierRate.rate.toFixed(2))
  }, [advanceBookingEnabled, bookingMonthSupplierRate, editingPayment, paymentAmountNumber])

  useEffect(() => {
    if (!advanceBookingEnabled || editingPayment) return
    if (effectiveBookingMarketRate <= 0 || paymentAmountNumber <= 0) return
    setBookingMTInput(calculatedBookingMT.toFixed(3))
  }, [advanceBookingEnabled, calculatedBookingMT, effectiveBookingMarketRate, editingPayment, paymentAmountNumber])

  const getNextDay = (dateStr: string): string => {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + 1)
    return date.toISOString().split('T')[0]
  }

  const getActiveSchemesForDate = (supplierId: string, date: string) => {
    const checkDate = new Date(date)
    const lockedSchemes = fixedSchemes
      .filter((scheme) => {
        if (scheme.supplierId !== supplierId) return false
        if (scheme.applyInMTBooking === false) return false
        return checkDate >= new Date(scheme.fromDate) && checkDate <= new Date(scheme.toDate)
      })
      .map((scheme) => ({
        schemeId: scheme.id,
        schemeName: scheme.schemeName,
        ratePerMT: scheme.ratePerMT,
        ruleVersionId: scheme.id,
        ruleVersion: scheme.version || 1,
        effectiveFrom: scheme.fromDate,
        effectiveTo: scheme.toDate
      }))

    return {
      lockedSchemes,
      totalLockedRate: lockedSchemes.reduce((sum, scheme) => sum + scheme.ratePerMT, 0)
    }
  }

  const upsertPaymentMTBooking = (payment: Payment) => {
    if (!payment.isAdvance || !payment.bookingMT || payment.bookingMT <= 0) {
      if (payment.mtBookingId) {
        setMTBookings((prev) => prev.filter((booking) => booking.id !== payment.mtBookingId))
      }
      return
    }

    const bookingId = payment.mtBookingId || `payment-mt-booking-${payment.id}`
    const { lockedSchemes, totalLockedRate } = getActiveSchemesForDate(payment.supplierId, payment.paymentDate)

    const booking: MTBooking = {
      id: bookingId,
      supplierId: payment.supplierId,
      orderDate: payment.paymentDate,
      consumeStartDate: getNextDay(payment.paymentDate),
      bookedMT: payment.bookingMT,
      bookedMarketRate: payment.bookingMarketRate,
      tieBreakPreference: 'current',
      notes: `Auto-created from advance payment ${formatCurrency(payment.amount)}. Uses lower market-price benefit between booking month and invoice month.`,
      fy: payment.fy,
      rateMode: 'auto',
      lockedSchemes,
      totalLockedRate
    }

    setMTBookings((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === bookingId)
      if (existingIndex >= 0) {
        return prev.map((item) => item.id === bookingId ? { ...item, ...booking } : item)
      }
      return [...prev, booking]
    })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (isLocked) {
      toast.error('Cannot save in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    
    const formData = new FormData(e.currentTarget)
    const paymentDate = formData.get('paymentDate') as string
    const supplierId = formSupplierId || (formData.get('supplierId') as string)
    const amount = parseFloat(paymentAmount || (formData.get('amount') as string))
    const counterId = formData.get('counterId') as string
    const bookingMT = Math.max(0, parseFloat(bookingMTInput || (formData.get('bookingMT') as string)) || 0)
    const bookingMarketRate = Math.max(0, parseFloat(bookingMarketRateInput || (formData.get('bookingMarketRate') as string)) || 0)

    if (!supplierId) {
      toast.error('Select a supplier')
      return
    }
    
    if (!counterId) {
      toast.error('Select a payment account (Counter)')
      return
    }
    
    const selectedCounter = counters.find(c => c.id === counterId)
    if (!selectedCounter) {
      toast.error('Invalid counter selected')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    if (advanceBookingEnabled && bookingMT <= 0) {
      toast.error('Enter booking quantity for advance payment', {
        description: 'Advance MT Booking needs quantity to track pending pickup.'
      })
      return
    }

    if (advanceBookingEnabled && bookingMarketRate <= 0) {
      toast.error('Enter booking month market rate', {
        description: 'This rate is required for previous vs current month benefit comparison.'
      })
      return
    }

    if (!isDateInFY(paymentDate, currentFY)) {
      toast.error('Invalid payment date', {
        description: `Date must be within ${currentFY} (April to March)`
      })
      return
    }

    if (editingPayment) {
      const updatedPayment: Payment = {
        ...editingPayment,
        supplierId,
        paymentDate: formData.get('paymentDate') as string,
        amount,
        isAdvance: advanceBookingEnabled,
        bookingMT: advanceBookingEnabled ? bookingMT : undefined,
        bookingMarketRate: advanceBookingEnabled ? bookingMarketRate : undefined,
        mtBookingId: advanceBookingEnabled ? (editingPayment.mtBookingId || `payment-mt-booking-${editingPayment.id}`) : undefined,
        doNotApplyCD: doNotApplyCD,
        counterId: counterId,
        counterName: selectedCounter.name
      }
      setPayments((prev) => prev.map(p => p.id === editingPayment.id ? updatedPayment : p))
      if (!advanceBookingEnabled && editingPayment.mtBookingId) {
        setMTBookings((prev) => prev.filter((booking) => booking.id !== editingPayment.mtBookingId))
      } else {
        upsertPaymentMTBooking(updatedPayment)
      }
      
      let newCounters = [...counters]
      let newTransactions = [...transactions]
      
      const oldCounterId = editingPayment.counterId
      if (oldCounterId) {
        newCounters = newCounters.map(c => 
          c.id === oldCounterId ? { ...c, currentBalance: c.currentBalance + editingPayment.amount } : c
        )
      }
      newCounters = newCounters.map(c => 
        c.id === counterId ? { ...c, currentBalance: c.currentBalance - amount } : c
      )
      
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Unknown'
      const txnId = `txn-sp-${editingPayment.id}`
      const existingTxn = newTransactions.find(t => t.id === txnId)
      if (existingTxn) {
        newTransactions = newTransactions.map(t => 
          t.id === txnId ? {
            ...t,
            date: paymentDate,
            counterId,
            counterName: selectedCounter.name,
            amount: amount,
            narration: `Supplier Payment Edited: ${supplierName}`.trim()
          } : t
        )
      } else {
        newTransactions.push({
          id: txnId,
          date: paymentDate,
          counterId,
          counterName: selectedCounter.name,
          type: 'Out',
          amount: amount,
          narration: `Supplier Payment: ${supplierName}`.trim()
        })
      }
      onUpdateCashBank(newCounters, newTransactions)

    } else {
      const paymentId = `payment-${Date.now()}`
      const payment: Payment = {
        id: paymentId,
        supplierId,
        paymentDate: formData.get('paymentDate') as string,
        amount,
        isAdvance: advanceBookingEnabled,
        bookingMT: advanceBookingEnabled ? bookingMT : undefined,
        bookingMarketRate: advanceBookingEnabled ? bookingMarketRate : undefined,
        mtBookingId: advanceBookingEnabled ? `payment-mt-booking-${paymentId}` : undefined,
        doNotApplyCD: doNotApplyCD,
        counterId: counterId,
        counterName: selectedCounter.name,
        fy: currentFY,
        createdAt: Date.now()
      }
      setPayments((prev) => [...prev, payment])
      upsertPaymentMTBooking(payment)
      
      const newCounters = counters.map(c => 
        c.id === counterId ? { ...c, currentBalance: c.currentBalance - amount } : c
      )
      
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Unknown'
      const newTransactions = [...transactions, {
        id: `txn-sp-${paymentId}`,
        date: paymentDate,
        counterId,
        counterName: selectedCounter.name,
        type: 'Out',
        amount: amount,
        narration: `Supplier Payment: ${supplierName}`.trim()
      } as CashBankTransaction]
      
      onUpdateCashBank(newCounters, newTransactions)
    }

    setOpen(false)
    setEditingPayment(null)
    setAdvanceBookingEnabled(false)
    setFormSupplierId('')
    setPaymentAmount('')
    setBookingMTInput('')
    setBookingMarketRateInput('')
  }

  const handleEdit = (payment: Payment) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingPayment(payment)
    setDoNotApplyCD(payment.doNotApplyCD || false)
    setAdvanceBookingEnabled(payment.isAdvance || Boolean(payment.bookingMT))
    setFormSupplierId(payment.supplierId)
    setSelectedCounterId(payment.counterId || '')
    setPaymentAmount(String(payment.amount || ''))
    setBookingMTInput(payment.bookingMT ? String(payment.bookingMT) : '')
    setBookingMarketRateInput(payment.bookingMarketRate ? String(payment.bookingMarketRate) : '')
    setOpen(true)
  }

  const handleDeleteClick = (payment: Payment) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setPaymentToDelete(payment)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (paymentToDelete) {
      setPayments((prev) => prev.filter(p => p.id !== paymentToDelete.id))
      if (paymentToDelete.mtBookingId) {
        setMTBookings((prev) => prev.filter((booking) => booking.id !== paymentToDelete.mtBookingId))
      }
      
      let newCounters = counters
      if (paymentToDelete.counterId) {
        newCounters = newCounters.map(c => 
          c.id === paymentToDelete.counterId ? { ...c, currentBalance: c.currentBalance + paymentToDelete.amount } : c
        )
      }
      const newTransactions = transactions.filter(t => t.id !== `txn-sp-${paymentToDelete.id}`)
      onUpdateCashBank(newCounters, newTransactions)
      
      toast.success('Payment deleted successfully')
      setDeleteDialogOpen(false)
      setPaymentToDelete(null)
    }
  }

  const handleAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingPayment(null)
    setDoNotApplyCD(false)
    setAdvanceBookingEnabled(false)
    setFormSupplierId('')
    setSelectedCounterId('')
    setPaymentAmount('')
    setBookingMTInput('')
    setBookingMarketRateInput('')
    setOpen(true)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEditingPayment(null)
      setAdvanceBookingEnabled(false)
      setFormSupplierId('')
      setSelectedCounterId('')
      setPaymentAmount('')
      setBookingMTInput('')
      setBookingMarketRateInput('')
    }
  }

  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const invoiceMap = new Map(fyInvoices.map(inv => [inv.id, inv]))
  const itemMap = new Map(items.map(item => [item.id, item]))

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  const handleDownloadInvoicePDF = (
    invoice: PurchaseInvoice | undefined,
    payment?: Payment,
    allocatedAmount = 0,
    totalAllocatedForPayment = 0
  ) => {
    if (!invoice) {
      toast.error('Invoice not found')
      return
    }

    exportPurchaseInvoicePDF(invoice, supplierMap.get(invoice.supplierId), itemMap, {
      businessName: 'SK TRADERS',
      state: 'West Bengal',
      phone: '9083876218',
      advancePayment: payment ? {
        paymentDate: payment.paymentDate,
        paymentAmount: payment.amount,
        bookingMT: payment.bookingMT,
        allocatedAmount,
        remainingAdvanceAmount: Math.max(0, payment.amount - totalAllocatedForPayment),
        sourceLabel: payment.isAdvance || payment.bookingMT ? 'Advance Supplier Payment' : 'Supplier Payment Allocation'
      } : undefined
    })
    toast.success(`Downloaded invoice ${invoice.invoiceNo}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Payments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chronological FIFO allocation - advances auto-allocate to future invoices
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} disabled={suppliers.length === 0}>
              <Plus className="mr-2" size={18} />
              Add Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPayment ? 'Edit Payment' : 'Add New Payment'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier</Label>
                <Select name="supplierId" value={formSupplierId} onValueChange={setFormSupplierId}>
                  <SelectTrigger id="supplierId">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input 
                  id="paymentDate" 
                  name="paymentDate" 
                  type="date"
                  defaultValue={editingPayment?.paymentDate}
                  min={minDate}
                  max={maxDate}
                  required 
                />
                <p className="text-xs text-muted-foreground">Must be within {currentFY}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="counterId">Payment Account</Label>
                <Select name="counterId" value={selectedCounterId} onValueChange={setSelectedCounterId} required>
                  <SelectTrigger id="counterId">
                    <SelectValue placeholder="Select Cash/Bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {counters.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.type}) - Bal: ₹{c.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input 
                  id="amount" 
                  name="amount" 
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  required 
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="advance-booking" className="font-semibold">Advance Payment / MT Booking</Label>
                    <p className="text-xs text-muted-foreground">
                      Turn this on when the payment should create an advance booking.
                    </p>
                  </div>
                  <Switch
                    id="advance-booking"
                    checked={advanceBookingEnabled}
                    onCheckedChange={setAdvanceBookingEnabled}
                  />
                </div>

                {advanceBookingEnabled && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                      <p className="font-semibold">Note:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>Advance MT Booking helps company lock better rates.</li>
                        <li>Cashback applies as per rule: current or previous month depending on market price condition.</li>
                      </ul>
                    </div>

                    <div className="grid gap-3 rounded-lg border border-border/80 bg-background/70 p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking month price</p>
                        <p className="mt-1 font-mono text-lg font-bold">
                          {effectiveBookingMarketRate > 0 ? `${formatCurrency(effectiveBookingMarketRate)} / MT` : 'Not available'}
                        </p>
                        {bookingMonthSupplierRate && (
                          <p className="text-xs text-muted-foreground">
                            Suggested from invoice {bookingMonthSupplierRate.invoiceNo} on {new Date(bookingMonthSupplierRate.invoiceDate).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MT from advance amount</p>
                        <p className="mt-1 font-mono text-lg font-bold text-primary">
                          {calculatedBookingMT > 0 ? `${calculatedBookingMT.toFixed(3)} MT` : '-'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Amount divided by booking month price.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bookingMarketRate">Booking Month Market Rate (₹/MT)</Label>
                      <Input
                        id="bookingMarketRate"
                        name="bookingMarketRate"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={bookingMarketRateInput}
                        onChange={(event) => setBookingMarketRateInput(event.target.value)}
                        placeholder={bookingMonthSupplierRate ? bookingMonthSupplierRate.rate.toFixed(2) : 'Enter market rate'}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        If next month market rate is higher, this rate and booking-month schemes are used. If next month is lower, current month benefit is used.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bookingMT">Booking Quantity (MT)</Label>
                      <Input
                        id="bookingMT"
                        name="bookingMT"
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={bookingMTInput}
                        onChange={(event) => setBookingMTInput(event.target.value)}
                        placeholder={effectiveBookingMarketRate > 0 ? calculatedBookingMT.toFixed(3) : 'Enter MT manually'}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Auto-filled from payment amount and booking month rate. You can adjust it before saving.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="do-not-apply-cd" className="font-semibold">Do Not Apply CD</Label>
                    <p className="text-xs text-muted-foreground">
                      Skip Cash Discount calculation for this payment
                    </p>
                  </div>
                  <Switch 
                    id="do-not-apply-cd"
                    checked={doNotApplyCD}
                    onCheckedChange={setDoNotApplyCD}
                  />
                </div>
                {doNotApplyCD && (
                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <p className="text-xs text-warning-foreground">
                      <strong>Note:</strong> No Payment-based CD or Invoice-closed CD will be calculated for this payment. Payment will still allocate via FIFO to invoices.
                    </p>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full">
                {editingPayment ? 'Update Payment' : 'Add Payment'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CurrencyDollar size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Please add suppliers first before creating payments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info size={20} className="text-accent mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-foreground">Complete FIFO Allocation System</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Payment on Jan 1 (₹5L) + Invoice on Jan 3 (₹10L) = ₹5L auto-allocated to invoice</li>
                    <li>• Payment on Jan 1 (₹15L) + Invoice on Jan 3 (₹10L) = ₹10L to invoice, ₹5L advance</li>
                    <li>• Adding invoice on Jan 2 recalculates everything chronologically</li>
                    <li>• All allocations always calculated from source data in date order</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <FunnelSimple size={18} className="text-muted-foreground" />
                  <Label htmlFor="supplier-filter" className="text-sm font-medium">Supplier:</Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger id="supplier-filter" className="w-48 h-9">
                      <SelectValue placeholder="All Suppliers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Label htmlFor="month-filter" className="text-sm font-medium">Month:</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month-filter" className="w-48 h-9">
                      <SelectValue placeholder="Select Month" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Months</SelectItem>
                      {fyMonths.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Badge variant="secondary" className="gap-1.5 ml-auto">
                  {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">Total Payments</div>
              <div className="text-2xl font-mono font-semibold">{formatCurrency(totalAmount)}</div>
            </CardContent>
          </Card>

          {fyPayments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CurrencyDollar size={48} className="text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No payments yet. Add your first payment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Booking MT</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Allocated To</TableHead>
                      <TableHead className="w-[120px] text-center">Invoice PDF</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments
                      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                      .map(payment => {
                        const supplier = supplierMap.get(payment.supplierId)
                        const paymentAllocations = allocations.filter(a => a.paymentId === payment.id)
                        const sortedPaymentAllocations = paymentAllocations
                          .slice()
                          .sort((a, b) => {
                            const invA = invoiceMap.get(a.invoiceId)
                            const invB = invoiceMap.get(b.invoiceId)
                            if (!invA || !invB) return 0
                            return new Date(invA.invoiceDate).getTime() - new Date(invB.invoiceDate).getTime()
                          })
                        const totalAllocated = paymentAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
                        const unallocated = payment.amount - totalAllocated
                        const isAdvance = isPaymentAdvance(payment, allocations)
                        
                        return (
                          <TableRow key={payment.id}>
                            <TableCell>{supplier?.name || 'Unknown'}</TableCell>
                            <TableCell>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</TableCell>
                            <TableCell className="text-right">
                              <div className="space-y-1">
                                <div className="font-mono">{formatCurrency(payment.amount)}</div>
                                {isAdvance && unallocated > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="text-xs text-muted-foreground">
                                        Allocated: {formatCurrency(totalAllocated)} | 
                                        <span className="text-accent font-medium"> Advance: {formatCurrency(unallocated)}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Unallocated amount will auto-allocate to future invoices</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {payment.bookingMT ? (
                                <div className="space-y-1">
                                  <div className="font-mono">{payment.bookingMT.toFixed(3)} MT</div>
                                  {payment.bookingMarketRate && (
                                    <div className="text-xs text-muted-foreground">
                                      {formatCurrency(payment.bookingMarketRate)} / MT
                                    </div>
                                  )}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {isAdvance ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-accent text-accent-foreground cursor-help">Advance</Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Payment has unallocated amount (treated as 0-day CD)</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Badge variant="secondary">Regular</Badge>
                              )}
                              {payment.doNotApplyCD && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="ml-2 border-warning text-warning-foreground cursor-help">
                                      No CD
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Cash Discount calculation disabled for this payment</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm space-y-2 min-w-[280px] max-w-md">
                                {paymentAllocations.length === 0 ? (
                                  <span className="text-muted-foreground text-xs">No allocation yet</span>
                                ) : (
                                  sortedPaymentAllocations
                                    .map((alloc, idx) => {
                                      const invoice = invoiceMap.get(alloc.invoiceId)
                                      return (
                                        <div key={alloc.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-background/70 p-1.5 shadow-[var(--neo-shadow-xs)]">
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="grid min-w-0 flex-1 cursor-help grid-cols-[auto_minmax(58px,1fr)_auto] items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted/50">
                                                <Badge variant="outline" className="text-xs font-mono">#{idx + 1}</Badge>
                                                <span className="truncate text-xs text-muted-foreground">{invoice?.invoiceNo || 'Invoice'}</span>
                                                <span className="whitespace-nowrap text-right font-mono text-xs font-semibold">{formatCurrency(alloc.allocatedAmount)}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <div className="space-y-1">
                                                <p className="font-medium">FIFO Allocation #{idx + 1}</p>
                                                <p className="text-xs">Invoice Date: {invoice?.invoiceDate && new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
                                                <p className="text-xs">Amount: {formatCurrency(alloc.allocatedAmount)}</p>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                      )
                                    })
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col items-center gap-1.5">
                                {sortedPaymentAllocations.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">-</span>
                                ) : (
                                  sortedPaymentAllocations.map((alloc, idx) => {
                                    const invoice = invoiceMap.get(alloc.invoiceId)
                                    return (
                                      <Button
                                        key={alloc.id}
                                        type="button"
                                        variant="default"
                                        size="sm"
                                        className="h-8 rounded-lg px-3 text-xs font-bold shadow-[var(--neo-shadow-xs)]"
                                        onClick={() => handleDownloadInvoicePDF(invoice, payment, alloc.allocatedAmount, totalAllocated)}
                                        title={`Download invoice ${invoice?.invoiceNo || ''}`}
                                        aria-label={`Download invoice ${invoice?.invoiceNo || ''}`}
                                      >
                                        <DownloadSimple className="mr-1 h-3.5 w-3.5" weight="bold" />
                                        PDF {sortedPaymentAllocations.length > 1 ? idx + 1 : ''}
                                      </Button>
                                    )
                                  })
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleEdit(payment)}
                                  className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                  <PencilSimple size={16} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteClick(payment)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash size={16} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of <strong>{formatCurrency(paymentToDelete?.amount || 0)}</strong> to <strong>{supplierMap.get(paymentToDelete?.supplierId || '')?.name}</strong>? 
              <br /><br />
              This action cannot be undone and will affect all FIFO allocations and cash discount calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
