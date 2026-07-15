import { useState, useMemo, useEffect } from 'react'
import { CustomerPayment, Customer, SalesInvoice } from '@/lib/types'
import { Counter } from '@/lib/cash-bank-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Plus, CurrencyInr, Trash, Info, PencilSimple, FunnelSimple, Warning, CaretUpDown, Check } from '@phosphor-icons/react'
import { formatCurrency, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CustomerPaymentsPageProps {
  customerPayments: CustomerPayment[]
  setCustomerPayments: (updater: (prev: CustomerPayment[]) => CustomerPayment[]) => void
  customers: Customer[]
  salesInvoices: SalesInvoice[]
  currentFY: string
  isLocked?: boolean
  activeCompanyId: string
  activeFY: string
}

export default function CustomerPaymentsPage({ customerPayments, setCustomerPayments, customers, salesInvoices, currentFY, isLocked = false, activeCompanyId, activeFY }: CustomerPaymentsPageProps) {
  const [open, setOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<CustomerPayment | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [selectedCustomerInForm, setSelectedCustomerInForm] = useState<string>('')
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false)
  const [counters, setCounters] = useState<Counter[]>([])
  const [selectedCounterId, setSelectedCounterId] = useState<string>('')
  
  useEffect(() => {
    const storageKey = `cashbank_${activeCompanyId}_${activeFY}`
    const storedData = localStorage.getItem(storageKey)
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData)
        setCounters(parsedData.counters || [])
      } catch (error) {
        console.error('Failed to load cash & bank counters:', error)
      }
    }
  }, [activeCompanyId, activeFY])

  const fyPayments = customerPayments.filter(p => p.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const calculateCustomerOutstanding = (customerId: string): number => {
    const fySalesInvoices = salesInvoices.filter(inv => inv.fy === currentFY && inv.customerId === customerId)
    const fyCustomerPayments = customerPayments.filter(p => p.fy === currentFY && p.customerId === customerId)
    
    const totalReceivables = fySalesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    const totalPaymentsReceived = fyCustomerPayments.reduce((sum, p) => sum + p.amount, 0)
    
    return totalReceivables - totalPaymentsReceived
  }
  
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
    
    if (selectedCustomer !== 'all') {
      result = result.filter(p => p.customerId === selectedCustomer)
    }
    
    return result
  }, [fyPayments, selectedMonth, selectedCustomer])
  
  const totalReceived = filteredPayments.reduce((sum, p) => sum + p.amount, 0)

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
    const counterId = formData.get('counterId') as string

    if (!counterId) {
      toast.error('Please select an Account/Counter', {
        description: 'Account/Counter is required for tracking'
      })
      return
    }

    if (!isDateInFY(paymentDate, currentFY)) {
      toast.error('Invalid payment date', {
        description: `Date must be within ${currentFY} (April to March)`
      })
      return
    }

    const selectedCounter = counters.find(c => c.id === counterId)
    if (!selectedCounter) {
      toast.error('Invalid counter selected')
      return
    }

    const paymentAmount = parseFloat(formData.get('amount') as string)

    if (editingPayment) {
      const updatedPayment: CustomerPayment = {
        ...editingPayment,
        customerId: formData.get('customerId') as string,
        paymentDate: formData.get('paymentDate') as string,
        amount: paymentAmount,
        notes: formData.get('notes') as string || undefined,
        counterId: counterId,
        counterName: selectedCounter.name
      }
      setCustomerPayments((prev) => prev.map(p => p.id === editingPayment.id ? updatedPayment : p))
      
      const oldCounter = counters.find(c => c.id === editingPayment.counterId)
      if (oldCounter && oldCounter.id !== counterId) {
        const storageKey = `cashbank_${activeCompanyId}_${activeFY}`
        const storedData = localStorage.getItem(storageKey)
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          const updatedCounters = (parsedData.counters || []).map((c: Counter) => {
            if (c.id === oldCounter.id) {
              return { ...c, currentBalance: c.currentBalance - editingPayment.amount }
            }
            if (c.id === counterId) {
              return { ...c, currentBalance: c.currentBalance + paymentAmount }
            }
            return c
          })
          localStorage.setItem(storageKey, JSON.stringify({ ...parsedData, counters: updatedCounters }))
        }
      } else if (oldCounter && oldCounter.id === counterId && editingPayment.amount !== paymentAmount) {
        const storageKey = `cashbank_${activeCompanyId}_${activeFY}`
        const storedData = localStorage.getItem(storageKey)
        if (storedData) {
          const parsedData = JSON.parse(storedData)
          const updatedCounters = (parsedData.counters || []).map((c: Counter) => {
            if (c.id === counterId) {
              return { ...c, currentBalance: c.currentBalance - editingPayment.amount + paymentAmount }
            }
            return c
          })
          localStorage.setItem(storageKey, JSON.stringify({ ...parsedData, counters: updatedCounters }))
        }
      }
    } else {
      const payment: CustomerPayment = {
        id: `customer-payment-${Date.now()}`,
        customerId: formData.get('customerId') as string,
        paymentDate: formData.get('paymentDate') as string,
        amount: paymentAmount,
        notes: formData.get('notes') as string || undefined,
        counterId: counterId,
        counterName: selectedCounter.name,
        fy: currentFY
      }
      setCustomerPayments((prev) => [...prev, payment])
      
      const storageKey = `cashbank_${activeCompanyId}_${activeFY}`
      const storedData = localStorage.getItem(storageKey)
      if (storedData) {
        const parsedData = JSON.parse(storedData)
        const updatedCounters = (parsedData.counters || []).map((c: Counter) => {
          if (c.id === counterId) {
            return { ...c, currentBalance: c.currentBalance + paymentAmount }
          }
          return c
        })
        localStorage.setItem(storageKey, JSON.stringify({ ...parsedData, counters: updatedCounters }))
        setCounters(updatedCounters)
      }
    }

    setOpen(false)
    setEditingPayment(null)
  }

  const handleEdit = (payment: CustomerPayment) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingPayment(payment)
    setSelectedCustomerInForm(payment.customerId)
    setSelectedCounterId(payment.counterId || '')
    setCustomerComboboxOpen(false)
    setOpen(true)
  }

  const handleDeleteClick = (payment: CustomerPayment) => {
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
      setCustomerPayments((prev) => prev.filter((p) => p.id !== paymentToDelete.id))
      toast.success('Customer payment deleted successfully')
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
    setOpen(true)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setEditingPayment(null)
      setSelectedCustomerInForm('')
      setSelectedCounterId('')
      setCustomerComboboxOpen(false)
    }
  }

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown'
  }

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Payments Received</p>
                <p className="text-3xl font-semibold text-foreground">{fyPayments.length}</p>
              </div>
              <CurrencyInr size={40} weight="duotone" className="text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Amount Received</p>
                <p className="text-3xl font-semibold text-foreground">{formatCurrency(totalReceived)}</p>
              </div>
              <div className="text-primary text-xl font-mono">₹</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CurrencyInr size={22} weight="duotone" className="text-primary" />
              Customer Payments Received
            </h3>
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
                <Button onClick={handleAdd} disabled={customers.length === 0}>
                  <Plus size={18} weight="bold" />
                  Add Payment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPayment ? 'Edit Customer Payment' : 'Record Customer Payment'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerId">Customer *</Label>
                    <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={customerComboboxOpen}
                          className="w-full justify-between"
                        >
                          {selectedCustomerInForm
                            ? customers.find((customer) => customer.id === selectedCustomerInForm)?.name
                            : "Select customer..."}
                          <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search customer..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No customer found.</CommandEmpty>
                            <CommandGroup>
                              {customers.map((customer) => (
                                <CommandItem
                                  key={customer.id}
                                  value={customer.name}
                                  onSelect={() => {
                                    setSelectedCustomerInForm(customer.id)
                                    setCustomerComboboxOpen(false)
                                  }}
                                >
                                  {customer.name}
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      selectedCustomerInForm === customer.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input
                      type="hidden"
                      name="customerId"
                      value={selectedCustomerInForm}
                      required
                    />
                  </div>

                    {selectedCustomerInForm && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Current Outstanding:</span>
                          <span className="text-base font-bold text-primary">
                            {formatCurrency(calculateCustomerOutstanding(selectedCustomerInForm))}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="counterId">Account/Counter *</Label>
                      <Select 
                        value={selectedCounterId} 
                        onValueChange={setSelectedCounterId}
                        required
                      >
                        <SelectTrigger id="counterId" className={cn(!selectedCounterId && "text-muted-foreground")}>
                          <SelectValue placeholder="Select payment account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {counters.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              No counters available. Please add a counter in Cash & Bank Master.
                            </div>
                          ) : (
                            counters.map((counter) => (
                              <SelectItem key={counter.id} value={counter.id}>
                                <div className="flex items-center gap-2">
                                  <Badge variant={counter.type === 'Cash' ? 'default' : 'secondary'} className="text-xs">
                                    {counter.type}
                                  </Badge>
                                  <span>{counter.name}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {formatCurrency(counter.currentBalance)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="counterId" value={selectedCounterId} required />
                      <p className="text-xs text-muted-foreground">Select where the payment is being received</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="paymentDate">Payment Date *</Label>
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
                        <Label htmlFor="amount">Amount (₹) *</Label>
                        <Input
                          id="amount"
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          defaultValue={editingPayment?.amount}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        placeholder="Add any payment notes or reference"
                        rows={3}
                        defaultValue={editingPayment?.notes}
                      />
                    </div>

                    <div className="flex gap-3 justify-end pt-4">
                      <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">{editingPayment ? 'Update Payment' : 'Record Payment'}</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-2">
              <FunnelSimple size={18} className="text-muted-foreground" />
              <Label htmlFor="customer-filter" className="text-sm font-medium">Customer:</Label>
              <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                <SelectTrigger id="customer-filter" className="w-48 h-9">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
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

          {customers.length === 0 ? (
            <div className="border border-dashed border-warning rounded-lg p-8 text-center bg-warning/5">
              <Info size={32} weight="duotone" className="mx-auto mb-2 text-warning" />
              <p className="text-muted-foreground">Please add customers first to record payments.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Account/Counter</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold">Notes</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fyPayments.length === 0 ? (
                    <TableRow>
                        No customer payments recorded for FY {currentFY}.
                        No customer payments recorded for FY {currentFY}.
                    </TableRow>
                  ) : (
                    filteredPayments
                      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                      .map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.paymentDate).toLocaleDateString('en-IN')}</TableCell>
                          <TableCell className="font-medium">
                            {getCustomerName(payment.customerId)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {payment.counterName || 'Not Set'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-success">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                            {payment.notes || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(payment)}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                              >
                                <PencilSimple size={16} weight="bold" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Customer Payment
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of <strong>{formatCurrency(paymentToDelete?.amount || 0)}</strong> from <strong>{getCustomerName(paymentToDelete?.customerId || '')}</strong>? 
              <br /><br />
              This action cannot be undone and will affect all related calculations and reports.
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
