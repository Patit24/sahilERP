import { useState, useMemo } from 'react'
import { SalesReturn, Customer, Item, InvoiceItem, CustomerCreditNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Plus, Trash, PencilSimple, CaretUpDown, Check, UserPlus, Package } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, isDateInFY } from '@/lib/calculations'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PartyEditorDialog } from '@/components/party-editor-dialog'
import { ItemEditorDialog } from '@/components/item-editor-dialog'

interface SalesReturnPageProps {
  salesReturns: SalesReturn[]
  setSalesReturns: (updater: (prev: SalesReturn[]) => SalesReturn[]) => void
  customers: Customer[]
  setCustomers?: (updater: (prev: Customer[]) => Customer[]) => void
  items: Item[]
  setItems?: (updater: (prev: Item[]) => Item[]) => void
  creditNotes?: CustomerCreditNote[]
  setCreditNotes?: (updater: (prev: CustomerCreditNote[]) => CustomerCreditNote[]) => void
  currentFY: string
  isLocked?: boolean
}

export default function SalesReturnPage({
  salesReturns,
  setSalesReturns,
  customers,
  setCustomers,
  items,
  setItems,
  creditNotes = [],
  setCreditNotes,
  currentFY,
  isLocked = false
}: SalesReturnPageProps) {
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SalesReturn | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<SalesReturn | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('all')
  
  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [returnNo, setReturnNo] = useState<string>('')
  const [returnDate, setReturnDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([])
  const [additionalCost, setAdditionalCost] = useState<number>(0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [remarks, setRemarks] = useState<string>('')

  // Quick dialogs
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [showQuickCustomer, setShowQuickCustomer] = useState(false)
  const [showQuickItem, setShowQuickItem] = useState(false)

  const fyItems = salesReturns.filter(p => p.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const filteredItems = useMemo(() => {
    let result = fyItems
    
    if (selectedMonth !== 'all') {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'))
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'))
      
      result = result.filter(p => {
        const pDate = parseISO(p.returnDate)
        return isWithinInterval(pDate, { start: monthStart, end: monthEnd })
      })
    }
    
    if (selectedCustomerFilter !== 'all') {
      result = result.filter(p => p.customerId === selectedCustomerFilter)
    }
    
    return result.sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())
  }, [fyItems, selectedMonth, selectedCustomerFilter])
  
  const totalAmount = filteredItems.reduce((sum, p) => sum + p.amount, 0)
  const totalQuantityMT = filteredItems.reduce((sum, p) => sum + (p.quantityMT || 0), 0)

  // Items calculation in form
  const itemsSubtotal = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [returnItems])

  const totalReturnMT = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (item.quantityMT || 0), 0)
  }, [returnItems])

  const calculatedTotalAmount = useMemo(() => {
    return Math.max(0, itemsSubtotal + (additionalCost || 0) + (roundOffAdjustment || 0))
  }, [itemsSubtotal, additionalCost, roundOffAdjustment])

  const handleOpenAddModal = () => {
    setEditingItem(null)
    setSelectedCustomerId('')
    setReturnNo('')
    setReturnDate(format(new Date(), 'yyyy-MM-dd'))
    setReturnItems([])
    setAdditionalCost(0)
    setRoundOffAdjustment(0)
    setRemarks('')
    setOpen(true)
  }

  const handleOpenEditModal = (item: SalesReturn) => {
    setEditingItem(item)
    setSelectedCustomerId(item.customerId)
    setReturnNo(item.returnNo || item.invoiceRef || '')
    setReturnDate(item.returnDate)
    setReturnItems(item.items || [])
    setAdditionalCost(item.additionalCost || 0)
    setRoundOffAdjustment(item.roundOffAdjustment || 0)
    setRemarks(item.remarks || '')
    setOpen(true)
  }

  const handleAddLineItem = () => {
    if (items.length === 0) {
      toast.error('No items available', { description: 'Please add items in Masters first.' })
      return
    }
    const firstItem = items[0]
    setReturnItems(prev => [
      ...prev,
      {
        itemId: firstItem.id,
        quantityMT: 1,
        rate: firstItem.salesPrice || 0,
        amount: firstItem.salesPrice || 0
      }
    ])
  }

  const handleUpdateLineItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'itemId') {
        const selected = items.find(i => i.id === value)
        if (selected && selected.salesPrice) {
          updated.rate = selected.salesPrice
        }
      }
      if (field === 'quantityMT' || field === 'rate' || field === 'itemId') {
        const qty = Number(updated.quantityMT) || 0
        const rate = Number(updated.rate) || 0
        updated.amount = parseFloat((qty * rate).toFixed(2))
      }
      return updated
    }))
  }

  const handleRemoveLineItem = (index: number) => {
    setReturnItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (isLocked) {
      toast.error('Cannot save in locked mode', { description: 'Unlock the data in Settings to make changes' })
      return
    }

    if (!selectedCustomerId) {
      toast.error('Please select a customer')
      return
    }

    if (returnItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    if (!isDateInFY(returnDate, currentFY)) {
      toast.error('Invalid date', { description: `Date must be within ${currentFY}` })
      return
    }

    const returnId = editingItem ? editingItem.id : `sr-${Date.now()}`
    const finalReturnNo = returnNo.trim() || `SR-${Date.now().toString().slice(-6)}`

    const salesReturnRecord: SalesReturn = {
      id: returnId,
      customerId: selectedCustomerId,
      returnNo: finalReturnNo,
      returnDate,
      amount: calculatedTotalAmount,
      items: returnItems,
      quantityMT: totalReturnMT,
      additionalCost,
      roundOffAdjustment,
      invoiceRef: finalReturnNo,
      remarks,
      fy: currentFY,
      createdAt: editingItem?.createdAt || Date.now()
    }

    // Automatically create or update Customer Credit Note
    const creditNoteId = `credit-note-sr-${returnId}`
    const creditNoteRecord: CustomerCreditNote = {
      id: creditNoteId,
      customerId: selectedCustomerId,
      date: returnDate,
      amount: calculatedTotalAmount,
      invoiceRef: finalReturnNo,
      remarks: `Sales Return #${finalReturnNo}${remarks ? ' - ' + remarks : ''}`,
      fy: currentFY,
      createdAt: Date.now()
    }

    // Save Sales Return
    setSalesReturns(prev => {
      const exists = prev.some(s => s.id === returnId)
      return exists ? prev.map(s => s.id === returnId ? salesReturnRecord : s) : [salesReturnRecord, ...prev]
    })

    // Save corresponding Credit Note automatically
    if (setCreditNotes) {
      setCreditNotes(prev => {
        const exists = prev.some(c => c.id === creditNoteId)
        return exists ? prev.map(c => c.id === creditNoteId ? creditNoteRecord : c) : [creditNoteRecord, ...prev]
      })
    }

    toast.success(editingItem ? 'Sales Return & Credit Note updated' : 'Sales Return & Credit Note created', {
      description: `Items added back to inventory. Credit Note of ${formatCurrency(calculatedTotalAmount)} auto-generated.`
    })

    setOpen(false)
    setEditingItem(null)
  }

  const handleDelete = () => {
    if (isLocked || !itemToDelete) return
    const returnId = itemToDelete.id
    const creditNoteId = `credit-note-sr-${returnId}`

    setSalesReturns(prev => prev.filter(s => s.id !== returnId))
    if (setCreditNotes) {
      setCreditNotes(prev => prev.filter(c => c.id !== creditNoteId))
    }

    setDeleteDialogOpen(false)
    setItemToDelete(null)
    toast.success('Sales Return & associated Credit Note deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Returns</h1>
          <p className="text-muted-foreground">Record item returns from customers (adds stock & auto-creates Credit Notes)</p>
        </div>
        
        <Button onClick={handleOpenAddModal} disabled={isLocked}>
          <Plus className="mr-2 h-4 w-4" /> Add Sales Return
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Return Records</p>
              <h3 className="text-2xl font-bold mt-1">{filteredItems.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Quantity Returned</p>
              <h3 className="text-2xl font-bold mt-1">{formatMT(totalQuantityMT)}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Return Value</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{formatCurrency(totalAmount)}</h3>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-[200px]">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {fyMonths.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[250px]">
          <Select value={selectedCustomerFilter} onValueChange={setSelectedCustomerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Return / Ref No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Return Items Summary</TableHead>
              <TableHead className="text-right">Quantity (MT)</TableHead>
              <TableHead className="text-right">Return Amount</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No sales returns recorded for this period.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map(item => {
                const customer = customers.find(c => c.id === item.customerId)
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.returnDate}</TableCell>
                    <TableCell className="font-medium">{item.returnNo || item.invoiceRef || '-'}</TableCell>
                    <TableCell className="font-semibold">{customer?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      {item.items && item.items.length > 0 ? (
                        <div className="text-xs space-y-1">
                          {item.items.map((line, i) => {
                            const itm = items.find(x => x.id === line.itemId)
                            return (
                              <div key={i}>
                                {itm?.name || 'Item'} ({line.quantityMT} {itm?.unit || 'MT'} @ {formatCurrency(line.rate)})
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Custom Return Amount</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatMT(item.quantityMT || 0)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{item.remarks || '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(item)} disabled={isLocked}>
                        <PencilSimple className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setItemToDelete(item); setDeleteDialogOpen(true) }} disabled={isLocked}>
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Main Dialog: Add / Edit Sales Return */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[92vw] max-w-5xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingItem ? 'Edit Sales Return' : 'New Sales Return'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-xl border">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between h-6">
                  <Label className="text-sm font-semibold">Customer *</Label>
                  {setCustomers && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-primary hover:text-primary gap-1"
                      onClick={() => setShowQuickCustomer(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" /> Quick Add
                    </Button>
                  )}
                </div>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                      <span className="truncate">
                        {selectedCustomerId
                          ? customers.find(c => c.id === selectedCustomerId)?.name
                          : 'Select customer...'}
                      </span>
                      <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search customer..." />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {customers.map(c => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setSelectedCustomerId(c.id)
                                setCustomerPickerOpen(false)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="returnNo" className="text-sm font-semibold">Return / Invoice Ref No</Label>
                <Input
                  id="returnNo"
                  placeholder="e.g. SR-001"
                  className="h-10"
                  value={returnNo}
                  onChange={e => setReturnNo(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="returnDate" className="text-sm font-semibold">Return Date *</Label>
                <Input
                  id="returnDate"
                  type="date"
                  className="h-10"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base">Return Items</h3>
                  <p className="text-xs text-muted-foreground">Items added here will be added back into your inventory stock</p>
                </div>
                <div className="flex items-center gap-2">
                  {setItems && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowQuickItem(true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Quick Add Item
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={handleAddLineItem}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Item Line
                  </Button>
                </div>
              </div>

              <div className="border rounded-xl overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/60">
                      <TableHead className="w-[38%]">Item Name</TableHead>
                      <TableHead className="w-[12%] text-center">Unit</TableHead>
                      <TableHead className="w-[20%] text-right">Quantity MT</TableHead>
                      <TableHead className="w-[20%] text-right">Return Rate (₹)</TableHead>
                      <TableHead className="w-[20%] text-right">Amount (₹)</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                          No items added. Click <span className="font-semibold text-foreground">"Add Item Line"</span> to specify return items.
                        </TableCell>
                      </TableRow>
                    ) : (
                      returnItems.map((line, idx) => {
                        const selectedItem = items.find(i => i.id === line.itemId)
                        return (
                          <TableRow key={idx}>
                            <TableCell>
                              <Select
                                value={line.itemId}
                                onValueChange={v => handleUpdateLineItem(idx, 'itemId', v)}
                              >
                                <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select item" />
                                </SelectTrigger>
                                <SelectContent>
                                  {items.map(itm => (
                                    <SelectItem key={itm.id} value={itm.id}>
                                      {itm.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            <TableCell className="text-center font-semibold text-sm">
                              {selectedItem?.unit || 'MT'}
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                className="h-10 text-right font-mono"
                                value={line.quantityMT || ''}
                                onChange={e => handleUpdateLineItem(idx, 'quantityMT', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-10 text-right font-mono"
                                value={line.rate || ''}
                                onChange={e => handleUpdateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>

                            <TableCell className="text-right font-bold text-sm font-mono">
                              {formatCurrency(line.amount || 0)}
                            </TableCell>

                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleRemoveLineItem(idx)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Bottom Section: Remarks & Summary Box */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t">
              <div className="md:col-span-6 space-y-2">
                <Label htmlFor="remarks" className="font-semibold text-sm">Remarks / Reason for Return</Label>
                <Textarea
                  id="remarks"
                  placeholder="Enter reason for customer return..."
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
              </div>

              <div className="md:col-span-6 bg-muted/30 p-5 rounded-xl border space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Total Items Quantity:</span>
                  <span className="font-semibold font-mono">{formatMT(totalReturnMT)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Items Subtotal:</span>
                  <span className="font-semibold font-mono">{formatCurrency(itemsSubtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Additional Costs:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-28 text-right font-mono text-sm"
                      value={additionalCost || ''}
                      onChange={e => setAdditionalCost(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Round-Off Adjustment:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 w-28 text-right font-mono text-sm"
                      value={roundOffAdjustment || ''}
                      onChange={e => setRoundOffAdjustment(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="border-t pt-3 mt-2 flex items-center justify-between">
                  <span className="font-bold text-base text-foreground">Total Return Amount:</span>
                  <span className="font-extrabold text-xl text-emerald-600 dark:text-emerald-400 font-mono tracking-tight shrink-0">
                    {formatCurrency(calculatedTotalAmount)}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground pt-1 border-t border-dashed">
                  Note: Saving this sales return will auto-create/update a Credit Note of <span className="font-semibold text-foreground">{formatCurrency(calculatedTotalAmount)}</span> for the selected customer.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-w-44">
                {editingItem ? 'Update Return & Credit Note' : 'Save Return & Credit Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Return?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this sales return record AND automatically delete its associated Credit Note. Inventory stock will be adjusted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Add Party Dialog */}
      {setCustomers && (
        <PartyEditorDialog
          open={showQuickCustomer}
          onOpenChange={setShowQuickCustomer}
          type="customer"
          onSave={newCustomer => {
            setCustomers(prev => [...prev, newCustomer as Customer])
            setSelectedCustomerId(newCustomer.id)
            toast.success(`Customer "${newCustomer.name}" added`)
          }}
        />
      )}

      {/* Quick Add Item Dialog */}
      {setItems && (
        <ItemEditorDialog
          open={showQuickItem}
          onOpenChange={setShowQuickItem}
          onSave={newItem => {
            setItems(prev => [...prev, newItem])
            setReturnItems(prev => [
              ...prev,
              {
                itemId: newItem.id,
                quantityMT: 1,
                rate: newItem.salesPrice || 0,
                amount: newItem.salesPrice || 0
              }
            ])
            toast.success(`Item "${newItem.name}" added`)
          }}
        />
      )}
    </div>
  )
}
