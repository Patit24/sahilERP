import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ExpenseEntry, ExpenseType, Supplier, PurchaseInvoice } from '@/lib/types'
import { Counter, CashBankTransaction } from '@/lib/cash-bank-types'
import { Plus, Trash, CurrencyInr, LinkSimple, TrendDown, PencilSimple, FunnelSimple, CaretUpDown, Check, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ExpenseEntriesPageProps {
  expenseEntries: ExpenseEntry[]
  setExpenseEntries: (updater: (prev: ExpenseEntry[]) => ExpenseEntry[]) => void
  expenseTypes: ExpenseType[]
  suppliers: Supplier[]
  invoices: PurchaseInvoice[]
  currentFY: string
  isLocked?: boolean
  counters: Counter[]
  transactions: CashBankTransaction[]
  onUpdateCashBank: (counters: Counter[], transactions: CashBankTransaction[]) => void
}

export default function ExpenseEntriesPage({
  expenseEntries,
  setExpenseEntries,
  expenseTypes,
  suppliers,
  invoices,
  currentFY,
  isLocked = false,
  counters,
  transactions,
  onUpdateCashBank
}: ExpenseEntriesPageProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseEntry | null>(null)
  const [supplierId, setSupplierId] = useState('')
  const [expenseTypeId, setExpenseTypeId] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [amount, setAmount] = useState('')
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [originalInvoiceNumber, setOriginalInvoiceNumber] = useState('')
  const [selectedCounterId, setSelectedCounterId] = useState('')
  const [expenseWithGst, setExpenseWithGst] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [invoiceSearchOpen, setInvoiceSearchOpen] = useState(false)

  const fyExpenses = expenseEntries.filter(e => e.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  const selectedExpenseType = expenseTypes.find(et => et.id === expenseTypeId)
  const linkType = selectedExpenseType?.linkType || 'netprofit'

  const resetForm = () => {
    setSupplierId('')
    setExpenseTypeId('')
    setExpenseDate('')
    setAmount('')
    setLinkedInvoiceId('')
    setNotes('')
    setOriginalInvoiceNumber('')
    setSelectedCounterId('')
    setExpenseWithGst(false)
    setEditingExpense(null)
  }

  const handleEdit = (expense: ExpenseEntry) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingExpense(expense)
    setSupplierId(expense.supplierId || '')
    setExpenseTypeId(expense.expenseTypeId)
    setExpenseDate(expense.expenseDate)
    setAmount(expense.amount.toString())
    setLinkedInvoiceId(expense.linkedInvoiceId || '')
    setNotes(expense.notes || '')
    setOriginalInvoiceNumber(expense.originalInvoiceNumber || '')
    setSelectedCounterId(expense.counterId || '')
    setExpenseWithGst(Boolean(expense.expenseWithGst))
    setIsAddDialogOpen(true)
  }

  const handleAddExpense = () => {
    if (isLocked) {
      toast.error('Cannot save in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    
    if (!expenseTypeId) {
      toast.error('Please select an expense type')
      return
    }
    if (!expenseDate) {
      toast.error('Please select expense date')
      return
    }
    if (!isDateInFY(expenseDate, currentFY)) {
      toast.error('Invalid expense date', {
        description: `Date must be within ${currentFY} (April to March)`
      })
      return
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (linkType === 'invoice' && !linkedInvoiceId) {
      toast.error('Please select an invoice')
      return
    }
    
    if (!selectedCounterId) {
      toast.error('Please select a payment account (Counter)')
      return
    }
    const selectedCounter = counters.find(c => c.id === selectedCounterId)
    if (!selectedCounter) {
      toast.error('Invalid counter selected')
      return
    }

    const selectedInvoice = linkedInvoiceId ? invoices.find(inv => inv.id === linkedInvoiceId) : null
    const finalSupplierId = selectedInvoice ? selectedInvoice.supplierId : (supplierId || undefined)

    if (editingExpense) {
      const updatedExpense: ExpenseEntry = {
        ...editingExpense,
        supplierId: finalSupplierId,
        expenseTypeId,
        expenseDate,
        amount: parseFloat(amount),
        linkedInvoiceId: linkType === 'invoice' && linkedInvoiceId ? linkedInvoiceId : undefined,
        originalInvoiceNumber: originalInvoiceNumber.trim() || undefined,
        counterId: selectedCounterId,
        counterName: selectedCounter.name,
        expenseWithGst,
        notes: notes.trim() || undefined,
      }
      setExpenseEntries((prev) => prev.map(e => e.id === editingExpense.id ? updatedExpense : e))
      
      let newCounters = [...counters]
      let newTransactions = [...transactions]
      
      if (editingExpense.counterId) {
        newCounters = newCounters.map(c => 
          c.id === editingExpense.counterId ? { ...c, currentBalance: c.currentBalance + editingExpense.amount } : c
        )
      }
      newCounters = newCounters.map(c => 
        c.id === selectedCounterId ? { ...c, currentBalance: c.currentBalance - parseFloat(amount) } : c
      )
      
      const txnId = `txn-exp-${editingExpense.id}`
      const existingTxn = newTransactions.find(t => t.id === txnId)
      if (existingTxn) {
        newTransactions = newTransactions.map(t => 
          t.id === txnId ? {
            ...t,
            date: expenseDate,
            counterId: selectedCounterId,
            counterName: selectedCounter.name,
            amount: parseFloat(amount),
            narration: `Expense Edited: ${selectedExpenseType?.name || 'Unknown'}`.trim()
          } : t
        )
      } else {
        newTransactions.push({
          id: txnId,
          date: expenseDate,
          counterId: selectedCounterId,
          counterName: selectedCounter.name,
          type: 'Out',
          amount: parseFloat(amount),
          narration: `Expense: ${selectedExpenseType?.name || 'Unknown'}`.trim()
        })
      }
      
      onUpdateCashBank(newCounters, newTransactions)
      
      toast.success('Expense entry updated successfully')
    } else {
      const expId = `exp-${Date.now()}`
      const newExpense: ExpenseEntry = {
        id: expId,
        supplierId: finalSupplierId,
        expenseTypeId,
        expenseDate,
        amount: parseFloat(amount),
        linkedInvoiceId: linkType === 'invoice' && linkedInvoiceId ? linkedInvoiceId : undefined,
        originalInvoiceNumber: originalInvoiceNumber.trim() || undefined,
        counterId: selectedCounterId,
        counterName: selectedCounter.name,
        expenseWithGst,
        notes: notes.trim() || undefined,
        fy: currentFY
      }
      setExpenseEntries((prev) => [...prev, newExpense])
      
      const newCounters = counters.map(c => 
        c.id === selectedCounterId ? { ...c, currentBalance: c.currentBalance - parseFloat(amount) } : c
      )
      
      const newTransactions = [...transactions, {
        id: `txn-exp-${expId}`,
        date: expenseDate,
        counterId: selectedCounterId,
        counterName: selectedCounter.name,
        type: 'Out',
        amount: parseFloat(amount),
        narration: `Expense: ${selectedExpenseType?.name || 'Unknown'}`.trim()
      } as CashBankTransaction]
      
      onUpdateCashBank(newCounters, newTransactions)
      
      toast.success('Expense entry added successfully')
    }
    
    resetForm()
    setIsAddDialogOpen(false)
  }

  const handleDeleteClick = (expense: ExpenseEntry) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setExpenseToDelete(expense)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (expenseToDelete) {
      setExpenseEntries((prev) => prev.filter(e => e.id !== expenseToDelete.id))
      
      let newCounters = counters
      if (expenseToDelete.counterId) {
        newCounters = newCounters.map(c => 
          c.id === expenseToDelete.counterId ? { ...c, currentBalance: c.currentBalance + expenseToDelete.amount } : c
        )
      }
      const newTransactions = transactions.filter(t => t.id !== `txn-exp-${expenseToDelete.id}`)
      onUpdateCashBank(newCounters, newTransactions)
      
      toast.success('Expense entry deleted successfully')
      setDeleteDialogOpen(false)
      setExpenseToDelete(null)
    }
  }

  const sortedInvoices = useMemo(() => {
    return invoices
      .filter(inv => inv.fy === currentFY)
      .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
  }, [invoices, currentFY])
  
  const filteredExpenses = useMemo(() => {
    let result = fyExpenses
    
    if (selectedMonth !== 'all') {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'))
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'))
      
      result = result.filter(e => {
        const eDate = parseISO(e.expenseDate)
        return isWithinInterval(eDate, { start: monthStart, end: monthEnd })
      })
    }
    
    if (selectedSupplier !== 'all') {
      result = result.filter(e => e.supplierId === selectedSupplier || (!e.supplierId && selectedSupplier === 'none'))
    }
    
    return result.sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
  }, [fyExpenses, selectedMonth, selectedSupplier])

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  const invoiceLinkedExpenses = filteredExpenses.filter(e => e.linkedInvoiceId)
  const netProfitExpenses = filteredExpenses.filter(e => !e.linkedInvoiceId)

  const totalInvoiceLinked = invoiceLinkedExpenses.reduce((sum, e) => sum + e.amount, 0)
  const totalNetProfit = netProfitExpenses.reduce((sum, e) => sum + e.amount, 0)

  const renderExpenseTable = (expenses: ExpenseEntry[]) => {
    if (expenses.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <CurrencyInr size={48} className="mx-auto mb-4 opacity-50" />
          <p>No expense entries found</p>
        </div>
      )
    }

    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Expense Type</TableHead>
              <TableHead className="text-right">Amount (₹)</TableHead>
              <TableHead>Linked To</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => {
              const supplier = expense.supplierId ? suppliers.find(s => s.id === expense.supplierId) : null
              const expenseType = expenseTypes.find(et => et.id === expense.expenseTypeId)
              const invoice = expense.linkedInvoiceId 
                ? invoices.find(inv => inv.id === expense.linkedInvoiceId)
                : null

              return (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm">
                    {new Date(expense.expenseDate).toLocaleDateString('en-IN')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{expenseType?.name || 'Unknown'}</span>
                      {expenseType && (
                        <Badge variant={expenseType.linkType === 'invoice' ? 'outline' : 'secondary'} className="w-fit text-xs gap-1">
                          {expenseType.linkType === 'invoice' ? (
                            <>
                              <LinkSimple size={12} />
                              Invoice Linked
                            </>
                          ) : (
                            <>
                              <TrendDown size={12} />
                              Net Profit
                            </>
                          )}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ₹{expense.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell>
                    {invoice ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <LinkSimple size={16} className="text-accent" />
                          <span className="text-sm font-mono">{invoice.invoiceNo}</span>
                        </div>
                        {supplier && (
                          <span className="text-xs text-muted-foreground">{supplier.name}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Net Profit</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {expense.notes || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(expense)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <PencilSimple size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(expense)}
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
            <CurrencyInr className="text-accent" weight="duotone" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Expense Entries</h2>
            <p className="text-sm text-muted-foreground">Track expenses linked to invoices or net profit</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              if (isLocked) {
                toast.error('Cannot add in locked mode', {
                  description: 'Unlock the data in Settings to make changes'
                })
                return
              }
              setIsAddDialogOpen(true)
            }} disabled={expenseTypes.length === 0}>
              <Plus className="mr-2" size={18} weight="bold" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="expense-entry-dialog max-w-[1040px]">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Edit Expense' : 'Create Expense'}</DialogTitle>
              <DialogDescription>Record category, payment mode, invoice reference, date, amount, and notes</DialogDescription>
            </DialogHeader>
            <div className="expense-create-grid py-4">
              <div className="expense-create-card">
                <div className="flex items-center justify-between rounded-lg border bg-background px-4 py-3">
                  <Label htmlFor="expenseWithGst">Expense With GST</Label>
                  <Switch id="expenseWithGst" checked={expenseWithGst} onCheckedChange={setExpenseWithGst} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expenseType">Expense Category *</Label>
                  <Select value={expenseTypeId} onValueChange={setExpenseTypeId}>
                    <SelectTrigger id="expenseType">
                      <SelectValue placeholder="Select expense type" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseTypes.map(type => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Total Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="expense-dashed-action">Add/Manage Category</div>
              </div>

              <div className="expense-create-card">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="originalInvoiceNumber">Original Invoice Number</Label>
                    <Input
                      id="originalInvoiceNumber"
                      value={originalInvoiceNumber}
                      onChange={(e) => setOriginalInvoiceNumber(e.target.value)}
                      placeholder="Enter invoice number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expenseDate">Date *</Label>
                  <Input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    min={minDate}
                    max={maxDate}
                  />
                  <p className="text-xs text-muted-foreground">Must be within {currentFY}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="counterId">Payment Account</Label>
                  <Select value={selectedCounterId} onValueChange={setSelectedCounterId} required>
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
                  <Label htmlFor="paymentMode">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger id="paymentMode">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank / Online</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Note</Label>
                  <Textarea
                    id="notes"
                    placeholder="Enter Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Link To</Label>
                <div className="p-4 border rounded-lg bg-muted/30">
                  {expenseTypeId ? (
                    linkType === 'invoice' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <LinkSimple size={16} className="text-accent" />
                          <span>Link to Invoice (configured in Expense Type)</span>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="linkedInvoice">Select Invoice *</Label>
                          <Popover open={invoiceSearchOpen} onOpenChange={setInvoiceSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={invoiceSearchOpen}
                                className="w-full justify-between font-normal h-auto min-h-[40px] py-2"
                              >
                                {linkedInvoiceId ? (
                                  (() => {
                                    const invoice = sortedInvoices.find(inv => inv.id === linkedInvoiceId)
                                    const supplier = invoice ? suppliers.find(s => s.id === invoice.supplierId) : null
                                    return invoice ? (
                                      <div className="flex items-center gap-2 w-full overflow-hidden">
                                        <span className="font-mono font-bold text-primary">{invoice.invoiceNo}</span>
                                        <span className="text-muted-foreground">•</span>
                                        <span className="text-sm truncate flex-1 text-left">{supplier?.name || 'Unknown'}</span>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
                                        <span className="text-sm font-mono whitespace-nowrap">₹{invoice.invoiceAmount.toLocaleString('en-IN')}</span>
                                      </div>
                                    ) : 'Select invoice'
                                  })()
                                ) : (
                                  <span className="text-muted-foreground">Search and select invoice...</span>
                                )}
                                <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[700px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search by invoice number, supplier name, or amount..." className="h-10" />
                                <CommandList>
                                  <CommandEmpty>No invoice found.</CommandEmpty>
                                  <CommandGroup>
                                    {sortedInvoices.map(invoice => {
                                      const supplier = suppliers.find(s => s.id === invoice.supplierId)
                                      return (
                                        <CommandItem
                                          key={invoice.id}
                                          value={`${invoice.invoiceNo} ${supplier?.name || ''} ${invoice.invoiceDate} ${invoice.invoiceAmount}`}
                                          onSelect={() => {
                                            setLinkedInvoiceId(invoice.id)
                                            setInvoiceSearchOpen(false)
                                          }}
                                          className="px-3 py-3"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4 flex-shrink-0",
                                              linkedInvoiceId === invoice.id ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex items-center gap-4 w-full overflow-hidden">
                                            <span className="font-mono font-bold text-sm min-w-[100px]">{invoice.invoiceNo}</span>
                                            <span className="text-sm text-muted-foreground flex-1 truncate">{supplier?.name || 'Unknown'}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
                                            <span className="text-sm font-mono font-semibold whitespace-nowrap">₹{invoice.invoiceAmount.toLocaleString('en-IN')}</span>
                                          </div>
                                        </CommandItem>
                                      )
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <TrendDown size={16} className="text-muted-foreground" />
                        <span className="text-muted-foreground">
                          This expense will be deducted from net profit calculations (configured in Expense Type)
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select an expense type to see link configuration
                    </p>
                  )}
                </div>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddExpense}>
                {editingExpense ? 'Update Expense' : 'Add Expense'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {expenseTypes.length === 0 && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="pt-6">
            <p className="text-sm text-warning-foreground">
              No expense types available. Please create expense types first before adding expense entries.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invoice Linked Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono">
                ₹{totalInvoiceLinked.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <Badge variant="outline" className="ml-2">{invoiceLinkedExpenses.length} entries</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Net Profit Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold font-mono">
                ₹{totalNetProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <Badge variant="outline" className="ml-2">{netProfitExpenses.length} entries</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="invoice">Invoice Linked</TabsTrigger>
          <TabsTrigger value="netprofit">Net Profit</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>All Expense Entries</CardTitle>
              <CardDescription>Complete list of all expenses for FY {currentFY}</CardDescription>
            </CardHeader>
            <CardContent>
              {renderExpenseTable(filteredExpenses)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Linked Expenses</CardTitle>
              <CardDescription>Expenses directly linked to purchase invoices</CardDescription>
            </CardHeader>
            <CardContent>
              {renderExpenseTable(invoiceLinkedExpenses)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="netprofit">
          <Card>
            <CardHeader>
              <CardTitle>Net Profit Expenses</CardTitle>
              <CardDescription>Expenses reducing from net profit</CardDescription>
            </CardHeader>
            <CardContent>
              {renderExpenseTable(netProfitExpenses)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Expense Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense entry of <strong>₹{expenseToDelete?.amount.toFixed(2)}</strong>? 
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
