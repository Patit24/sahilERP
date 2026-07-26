import { useState, useMemo } from 'react'
import { PurchaseReturn, Supplier, Item, InvoiceItem, SupplierDebitNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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

interface PurchaseReturnPageProps {
  purchaseReturns: PurchaseReturn[]
  setPurchaseReturns: (updater: (prev: PurchaseReturn[]) => PurchaseReturn[]) => void
  suppliers: Supplier[]
  setSuppliers?: (updater: (prev: Supplier[]) => Supplier[]) => void
  items: Item[]
  setItems?: (updater: (prev: Item[]) => Item[]) => void
  debitNotes?: SupplierDebitNote[]
  setDebitNotes?: (updater: (prev: SupplierDebitNote[]) => SupplierDebitNote[]) => void
  currentFY: string
  isLocked?: boolean
}

export default function PurchaseReturnPage({
  purchaseReturns,
  setPurchaseReturns,
  suppliers,
  setSuppliers,
  items,
  setItems,
  debitNotes = [],
  setDebitNotes,
  currentFY,
  isLocked = false
}: PurchaseReturnPageProps) {
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseReturn | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<PurchaseReturn | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all')
  
  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [returnNo, setReturnNo] = useState<string>('')
  const [returnDate, setReturnDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([])
  const [additionalCost, setAdditionalCost] = useState<number>(0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [remarks, setRemarks] = useState<string>('')

  // Quick dialogs
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [showQuickItem, setShowQuickItem] = useState(false)

  const fyItems = purchaseReturns.filter(p => p.fy === currentFY)
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
    
    if (selectedSupplierFilter !== 'all') {
      result = result.filter(p => p.supplierId === selectedSupplierFilter)
    }
    
    return result.sort((a, b) => new Date(b.returnDate).getTime() - new Date(a.returnDate).getTime())
  }, [fyItems, selectedMonth, selectedSupplierFilter])
  
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
    setSelectedSupplierId('')
    setReturnNo('')
    setReturnDate(format(new Date(), 'yyyy-MM-dd'))
    setReturnItems([])
    setAdditionalCost(0)
    setRoundOffAdjustment(0)
    setRemarks('')
    setOpen(true)
  }

  const handleOpenEditModal = (item: PurchaseReturn) => {
    setEditingItem(item)
    setSelectedSupplierId(item.supplierId)
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
        rate: firstItem.purchasePrice || 0,
        amount: firstItem.purchasePrice || 0
      }
    ])
  }

  const handleUpdateLineItem = (index: number, field: keyof InvoiceItem, value: any) => {
    setReturnItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item
      const updated = { ...item, [field]: value }
      if (field === 'itemId') {
        const selected = items.find(i => i.id === value)
        if (selected && selected.purchasePrice) {
          updated.rate = selected.purchasePrice
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

    if (!selectedSupplierId) {
      toast.error('Please select a supplier')
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

    const returnId = editingItem ? editingItem.id : `pr-${Date.now()}`
    const finalReturnNo = returnNo.trim() || `PR-${Date.now().toString().slice(-6)}`

    const purchaseReturnRecord: PurchaseReturn = {
      id: returnId,
      supplierId: selectedSupplierId,
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

    // Automatically create or update Supplier Debit Note
    const debitNoteId = `debit-note-pr-${returnId}`
    const supplierObj = suppliers.find(s => s.id === selectedSupplierId)
    const debitNoteRecord: SupplierDebitNote = {
      id: debitNoteId,
      supplierId: selectedSupplierId,
      date: returnDate,
      amount: calculatedTotalAmount,
      invoiceRef: finalReturnNo,
      remarks: `Purchase Return #${finalReturnNo}${remarks ? ' - ' + remarks : ''}`,
      fy: currentFY,
      createdAt: Date.now()
    }

    // Save Purchase Return
    setPurchaseReturns(prev => {
      const exists = prev.some(p => p.id === returnId)
      return exists ? prev.map(p => p.id === returnId ? purchaseReturnRecord : p) : [purchaseReturnRecord, ...prev]
    })

    // Save corresponding Debit Note automatically
    if (setDebitNotes) {
      setDebitNotes(prev => {
        const exists = prev.some(d => d.id === debitNoteId)
        return exists ? prev.map(d => d.id === debitNoteId ? debitNoteRecord : d) : [debitNoteRecord, ...prev]
      })
    }

    toast.success(editingItem ? 'Purchase Return & Debit Note updated' : 'Purchase Return & Debit Note created', {
      description: `Items deducted from inventory. Debit Note of ${formatCurrency(calculatedTotalAmount)} auto-generated.`
    })

    setOpen(false)
    setEditingItem(null)
  }

  const handleDelete = () => {
    if (isLocked || !itemToDelete) return
    const returnId = itemToDelete.id
    const debitNoteId = `debit-note-pr-${returnId}`

    setPurchaseReturns(prev => prev.filter(p => p.id !== returnId))
    if (setDebitNotes) {
      setDebitNotes(prev => prev.filter(d => d.id !== debitNoteId))
    }

    setDeleteDialogOpen(false)
    setItemToDelete(null)
    toast.success('Purchase Return & associated Debit Note deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1>
          <p className="text-muted-foreground">Record item returns to suppliers (reduces stock & auto-creates Debit Notes)</p>
        </div>
        
        <Button onClick={handleOpenAddModal} disabled={isLocked}>
          <Plus className="mr-2 h-4 w-4" /> Add Purchase Return
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
          <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Return / Ref No</TableHead>
              <TableHead>Supplier</TableHead>
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
                  No purchase returns recorded for this period.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map(item => {
                const supplier = suppliers.find(s => s.id === item.supplierId)
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.returnDate}</TableCell>
                    <TableCell className="font-medium">{item.returnNo || item.invoiceRef || '-'}</TableCell>
                    <TableCell className="font-semibold">{supplier?.name || 'Unknown'}</TableCell>
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

      {/* Main Dialog: Add / Edit Purchase Return */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Purchase Return' : 'New Purchase Return'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Supplier *</Label>
                  {setSuppliers && (
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs flex items-center gap-1"
                      onClick={() => setShowQuickSupplier(true)}
                    >
                      <UserPlus className="h-3 w-3" /> Quick Add
                    </Button>
                  )}
                </div>
                <Popover open={supplierPickerOpen} onOpenChange={setSupplierPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedSupplierId
                        ? suppliers.find(s => s.id === selectedSupplierId)?.name
                        : 'Select supplier...'}
                      <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search supplier..." />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map(s => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              onSelect={() => {
                                setSelectedSupplierId(s.id)
                                setSupplierPickerOpen(false)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedSupplierId === s.id ? "opacity-100" : "opacity-0")} />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="returnNo">Return / Invoice Ref No</Label>
                <Input
                  id="returnNo"
                  placeholder="e.g. PR-001"
                  value={returnNo}
                  onChange={e => setReturnNo(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="returnDate">Return Date *</Label>
                <Input
                  id="returnDate"
                  type="date"
                  value={returnDate}
                  onChange={e => setReturnDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Return Items (Items will be deducted from inventory)</h3>
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

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[35%]">Item Name</TableHead>
                      <TableHead className="w-[15%]">Unit</TableHead>
                      <TableHead className="w-[20%] text-right">Quantity MT</TableHead>
                      <TableHead className="w-[20%] text-right">Return Rate</TableHead>
                      <TableHead className="w-[20%] text-right">Amount</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
                          No items added. Click "Add Item Line" to add items being returned.
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
                                <SelectTrigger className="h-9">
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

                            <TableCell>
                              <span className="text-sm font-medium">{selectedItem?.unit || 'MT'}</span>
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                className="h-9 text-right"
                                value={line.quantityMT || ''}
                                onChange={e => handleUpdateLineItem(idx, 'quantityMT', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>

                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-9 text-right"
                                value={line.rate || ''}
                                onChange={e => handleUpdateLineItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>

                            <TableCell className="text-right font-bold text-sm">
                              {formatCurrency(line.amount || 0)}
                            </TableCell>

                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
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

            {/* Bottom Calculations & Additional Costs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="remarks">Remarks / Reason for Return</Label>
                  <Textarea
                    id="remarks"
                    placeholder="Enter reason for returning goods..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <div className="space-y-3 bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Items Quantity:</span>
                  <span className="font-semibold">{formatMT(totalReturnMT)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(itemsSubtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-sm gap-4">
                  <span className="text-muted-foreground">Additional Costs:</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 w-32 text-right"
                    value={additionalCost || ''}
                    onChange={e => setAdditionalCost(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="flex items-center justify-between text-sm gap-4">
                  <span className="text-muted-foreground">Round-Off Adjustment:</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 w-32 text-right"
                    value={roundOffAdjustment || ''}
                    onChange={e => setRoundOffAdjustment(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="border-t pt-2 flex items-center justify-between font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  <span>Total Return Amount:</span>
                  <span>{formatCurrency(calculatedTotalAmount)}</span>
                </div>

                <p className="text-xs text-muted-foreground pt-1 italic">
                  Note: Saving this purchase return will automatically create/update a Debit Note of {formatCurrency(calculatedTotalAmount)} for {suppliers.find(s => s.id === selectedSupplierId)?.name || 'the supplier'}.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? 'Update Return & Debit Note' : 'Save Purchase Return & Debit Note'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Return?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this purchase return record AND automatically delete its associated Debit Note. Inventory stock will be restored.
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
      {setSuppliers && (
        <PartyEditorDialog
          open={showQuickSupplier}
          onOpenChange={setShowQuickSupplier}
          type="supplier"
          onSave={newSupplier => {
            setSuppliers(prev => [...prev, newSupplier as Supplier])
            setSelectedSupplierId(newSupplier.id)
            toast.success(`Supplier "${newSupplier.name}" added`)
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
                rate: newItem.purchasePrice || 0,
                amount: newItem.purchasePrice || 0
              }
            ])
            toast.success(`Item "${newItem.name}" added`)
          }}
        />
      )}
    </div>
  )
}
