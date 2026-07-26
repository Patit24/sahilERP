import { useState, useMemo } from 'react'
import { PurchaseReturn, Supplier, Item, InvoiceItem, SupplierDebitNote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Plus, PencilSimple, Trash, MagnifyingGlass, Barcode, Package, UserPlus, X, FileText, Check } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, isDateInFY } from '@/lib/calculations'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
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
  gstPercentage?: number
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
  isLocked = false,
  gstPercentage = 18
}: PurchaseReturnPageProps) {
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PurchaseReturn | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<PurchaseReturn | null>(null)
  
  // List Filters
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all')

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [returnNo, setReturnNo] = useState<string>('')
  const [returnDate, setReturnDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [returnItems, setReturnItems] = useState<InvoiceItem[]>([])
  const [additionalCost, setAdditionalCost] = useState<number>(0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [remarks, setRemarks] = useState<string>('')

  // Item Picker Modal state
  const [itemPickerOpen, setItemPickerOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemCategory, setSelectedItemCategory] = useState('all')
  const [pickerQuantities, setPickerQuantities] = useState<Record<string, number>>({})

  // Quick party/item dialogs
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [showQuickItem, setShowQuickItem] = useState(false)

  const fyItems = purchaseReturns.filter(p => p.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const filteredReturns = useMemo(() => {
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
  
  const totalAmount = filteredReturns.reduce((sum, p) => sum + p.amount, 0)
  const totalQuantityMT = filteredReturns.reduce((sum, p) => sum + (p.quantityMT || 0), 0)

  // Calculations for active form
  const itemsSubtotal = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }, [returnItems])

  const totalReturnMT = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + (item.quantityMT || 0), 0)
  }, [returnItems])

  const calculatedTotalAmount = useMemo(() => {
    return parseFloat((Math.max(0, itemsSubtotal + (additionalCost || 0) + (roundOffAdjustment || 0))).toFixed(2))
  }, [itemsSubtotal, additionalCost, roundOffAdjustment])

  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const selectedSupplier = selectedSupplierId ? supplierMap.get(selectedSupplierId) : undefined

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = supplierSearch.trim().toLowerCase()
    if (!query) return true
    return [supplier.name, supplier.phone, supplier.gstin]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  const filteredPickerItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()
    return items
      .filter(item => {
        if (selectedItemCategory !== 'all' && item.category !== selectedItemCategory) return false
        if (!query) return true
        return [
          item.name,
          item.itemCode,
          item.category,
          item.description,
          item.unit
        ].some(value => (value || '').toLowerCase().includes(query))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [itemSearch, items, selectedItemCategory])

  const updatePickerQuantity = (itemId: string, nextQuantity: number | null) => {
    setPickerQuantities((prev) => {
      const updated = { ...prev }
      if (nextQuantity === null) {
        delete updated[itemId]
      } else {
        const quantity = Math.max(0, Number.isFinite(nextQuantity) ? nextQuantity : 0)
        updated[itemId] = quantity
      }
      return updated
    })
  }

  const resetItemPicker = () => {
    setItemSearch('')
    setSelectedItemCategory('all')
    setPickerQuantities({})
  }

  const handleAddSelectedItemToBill = () => {
    const newItems: InvoiceItem[] = []

    Object.entries(pickerQuantities).forEach(([itemId, qty]) => {
      if (qty > 0) {
        const item = items.find(i => i.id === itemId)
        const rate = item?.purchasePrice || 0
        newItems.push({
          itemId,
          quantityMT: qty,
          rate,
          amount: parseFloat((qty * rate).toFixed(2))
        })
      }
    })

    if (newItems.length > 0) {
      setReturnItems(prev => {
        const prevCopy = [...prev]
        newItems.forEach(newItem => {
          const idx = prevCopy.findIndex(x => x.itemId === newItem.itemId)
          if (idx !== -1) {
            const existing = prevCopy[idx]
            const updatedQty = (existing.quantityMT || 0) + newItem.quantityMT
            prevCopy[idx] = {
              ...existing,
              quantityMT: updatedQty,
              amount: parseFloat((updatedQty * existing.rate).toFixed(2))
            }
          } else {
            prevCopy.push(newItem)
          }
        })
        return prevCopy
      })
    }

    setItemPickerOpen(false)
    resetItemPicker()
  }

  const handleOpenAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode')
      return
    }
    setEditingItem(null)
    setSelectedSupplierId('')
    setSupplierSearch('')
    setReturnNo(`PR-${Date.now().toString().slice(-6)}`)
    setReturnDate(format(new Date(), 'yyyy-MM-dd'))
    setReturnItems([])
    setAdditionalCost(0)
    setRoundOffAdjustment(0)
    setRemarks('')
    setOpen(true)
  }

  const handleOpenEdit = (item: PurchaseReturn) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode')
      return
    }
    setEditingItem(item)
    setSelectedSupplierId(item.supplierId)
    setSupplierSearch('')
    setReturnNo(item.returnNo || item.invoiceRef || '')
    setReturnDate(item.returnDate)
    setReturnItems(item.items || [])
    setAdditionalCost(item.additionalCost || 0)
    setRoundOffAdjustment(item.roundOffAdjustment || 0)
    setRemarks(item.remarks || '')
    setOpen(true)
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
      toast.error('Cannot save in locked mode')
      return
    }

    if (!selectedSupplierId) {
      toast.error('Select a supplier before saving')
      return
    }

    if (returnItems.length === 0) {
      toast.error('Please add at least one item to return')
      return
    }

    if (!isDateInFY(returnDate, currentFY)) {
      toast.error('Invalid return date', { description: `Date must be within ${currentFY}` })
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

    // Auto-create / update Supplier Debit Note
    const debitNoteId = `debit-note-pr-${returnId}`
    const debitNoteRecord: SupplierDebitNote = {
      id: debitNoteId,
      supplierId: selectedSupplierId,
      date: returnDate,
      amount: calculatedTotalAmount,
      invoiceRef: finalReturnNo,
      remarks: `Purchase Return #${finalReturnNo}${remarks ? ' - ' + remarks : ''}`,
      fy: currentFY,
      createdAt: Date.now(),
      isAutoGenerated: true,
      sourceType: 'purchase_return',
      sourceId: returnId
    }

    // Save Purchase Return
    setPurchaseReturns(prev => {
      const exists = prev.some(p => p.id === returnId)
      return exists ? prev.map(p => p.id === returnId ? purchaseReturnRecord : p) : [...prev, purchaseReturnRecord]
    })

    // Auto-save Debit Note
    if (setDebitNotes) {
      setDebitNotes(prev => {
        const exists = prev.some(d => d.id === debitNoteId)
        return exists ? prev.map(d => d.id === debitNoteId ? debitNoteRecord : d) : [...prev, debitNoteRecord]
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
    <div className="space-y-4">
      {/* If form is NOT open, show Register view */}
      {!open ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1>
              <p className="text-muted-foreground">Manage item returns to suppliers (reduces stock & auto-creates Debit Notes)</p>
            </div>
            
            <Button onClick={handleOpenAdd} disabled={isLocked}>
              <Plus className="mr-2 h-4 w-4" /> Add Purchase Return
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Return Records</p>
                  <h3 className="text-2xl font-bold mt-1">{filteredReturns.length}</h3>
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

          {/* Register Table */}
          <div className="rounded-md border bg-card overflow-hidden">
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
                {filteredReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No purchase returns recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReturns.map(item => {
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
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(item)} disabled={isLocked}>
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
        </div>
      ) : (
        /* If form is OPEN, render FULL PAGE Shell view exactly like InvoicesPage! */
        <div className="erp-invoice-page-shell">
          <form onSubmit={handleSubmit} className="erp-invoice-form erp-invoice-page-form">
            {/* Top Bar Header */}
            <div className="erp-invoice-page-header">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={() => setOpen(false)}
                  aria-label="Back to purchase returns"
                >
                  <ArrowLeft size={24} />
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">
                    {editingItem ? 'Edit Purchase Return' : 'Create Purchase Return'}
                  </h2>
                  <p className="text-sm text-muted-foreground">Return goods to supplier and auto-generate Debit Note</p>
                </div>
              </div>
              <div className="erp-reference-actions flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="erp-save-button" disabled={returnItems.length === 0}>
                  {editingItem ? 'Update Return & Debit Note' : 'Save Return & Debit Note'}
                </Button>
              </div>
            </div>

            {/* Main Form Body */}
            <div className="erp-invoice-body erp-invoice-page-body space-y-6">
              {/* Panel 1: Bill From / Return To Supplier */}
              <div className="erp-form-panel">
                <h3 className="erp-section-title">Return To Supplier</h3>
                <div className="erp-responsive-grid">
                  <div className="erp-party-picker-field">
                    <input type="hidden" name="supplierId" value={selectedSupplierId} />
                    {!supplierPickerOpen && !selectedSupplier ? (
                      <button
                        type="button"
                        className="erp-party-add-box"
                        onClick={() => setSupplierPickerOpen(true)}
                      >
                        <Plus size={18} weight="bold" />
                        Select Supplier
                      </button>
                    ) : (
                      <div className="erp-party-dropdown-card">
                        <div className="erp-party-search-row">
                          <MagnifyingGlass size={20} />
                          <input
                            id="supplierId"
                            type="text"
                            value={supplierSearch}
                            onChange={(event) => setSupplierSearch(event.target.value)}
                            onFocus={() => setSupplierPickerOpen(true)}
                            placeholder={selectedSupplier ? selectedSupplier.name : 'Search supplier by name or number'}
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            aria-label="Toggle supplier list"
                            onClick={() => setSupplierPickerOpen((o) => !o)}
                          >
                            <span>⌄</span>
                          </button>
                        </div>

                        {supplierPickerOpen && (
                          <div className="erp-party-options">
                            <div className="erp-party-options-head">
                              <span>Supplier Name</span>
                              <span>Balance</span>
                            </div>
                            {filteredSuppliers.map((supplier) => (
                              <button
                                type="button"
                                key={supplier.id}
                                className="erp-party-option"
                                onClick={() => {
                                  setSelectedSupplierId(supplier.id)
                                  setSupplierSearch('')
                                  setSupplierPickerOpen(false)
                                }}
                              >
                                <span>{supplier.name}</span>
                                <span>{formatCurrency(supplier.openingBalance || 0)}</span>
                              </button>
                            ))}
                            {setSuppliers && (
                              <button
                                type="button"
                                className="erp-party-create-option"
                                onClick={() => {
                                  setSupplierPickerOpen(false)
                                  setShowQuickSupplier(true)
                                }}
                              >
                                <Plus size={16} weight="bold" />
                                Create Supplier
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="returnNo" className="text-xs font-medium">Return / Ref Number <span className="text-destructive">*</span></Label>
                    <Input 
                      id="returnNo" 
                      value={returnNo}
                      onChange={e => setReturnNo(e.target.value)}
                      placeholder="PR-001"
                      className="h-8 bg-background text-xs font-mono"
                      required 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="returnDate" className="text-xs font-medium">Return Date <span className="text-destructive">*</span></Label>
                    <Input 
                      id="returnDate" 
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="h-8 bg-background text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Panel 2: Return Items Table */}
              <div id="purchase-return-items" className="space-y-2.5">
                <div className="erp-section-toolbar flex items-center justify-between">
                  <h3 className="erp-section-title">
                    Return Items <span className="text-destructive">*</span>
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Returned items will be automatically deducted from inventory stock
                  </span>
                </div>

                <div className="erp-reference-table-wrap border rounded-xl overflow-hidden bg-card">
                  <div className="erp-reference-item-table">
                    <div className="erp-reference-item-head">
                      <span>No</span>
                      <span>Items</span>
                      <span>HSN/ SAC</span>
                      <span>Qty (MT)</span>
                      <span>Price/Item (₹)</span>
                      <span>Discount</span>
                      <span>Tax</span>
                      <span>Amount (₹)</span>
                      <button type="button" className="erp-reference-row-plus" onClick={() => setItemPickerOpen(true)} aria-label="Add item">
                        <Plus size={22} weight="bold" />
                      </button>
                    </div>

                    {returnItems.map((lineItem, index) => {
                      const selectedItem = items.find(i => i.id === lineItem.itemId)
                      return (
                        <div className="erp-reference-item-row" key={index}>
                          <span className="erp-reference-row-number">{index + 1}</span>
                          <Select value={lineItem.itemId} onValueChange={(val) => handleUpdateLineItem(index, 'itemId', val)}>
                            <SelectTrigger className="erp-reference-cell-input">
                              <SelectValue placeholder="Select an item" />
                            </SelectTrigger>
                            <SelectContent>
                              {items.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                  {item.name} ({item.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input value="-" disabled className="erp-reference-cell-input text-center" />
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={lineItem.quantityMT || ''}
                            onChange={(e) => handleUpdateLineItem(index, 'quantityMT', e.target.value)}
                            placeholder="0"
                            className="erp-reference-cell-input font-mono text-right"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={lineItem.rate || ''}
                            onChange={(e) => handleUpdateLineItem(index, 'rate', e.target.value)}
                            placeholder="0"
                            className="erp-reference-cell-input font-mono text-right"
                          />
                          <Input value="-" disabled className="erp-reference-cell-input text-center" />
                          <Input value={`GST @ ${selectedItem?.gstRate || gstPercentage}%`} disabled className="erp-reference-cell-input text-center" />
                          <Input value={formatCurrency(lineItem.amount || 0)} disabled className="erp-reference-cell-input font-mono text-right" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="erp-reference-remove-row text-destructive"
                            onClick={() => handleRemoveLineItem(index)}
                            aria-label="Remove item"
                          >
                            <X size={16} weight="bold" />
                          </Button>
                        </div>
                      )
                    })}

                    <div className="erp-reference-add-item-row p-2">
                      <button type="button" className="erp-reference-add-item-dashed" onClick={() => setItemPickerOpen(true)}>
                        <Plus size={18} weight="bold" />
                        Add Item to Return
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Panel 3: Footer Sections (Remarks & Totals) */}
              <div className="erp-invoice-reference-footer grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t">
                {/* Column 1: Remarks / Notes */}
                <div className="erp-footer-col">
                  <div className="erp-footer-section">
                    <div className="erp-footer-section-header flex items-center gap-2 mb-2">
                      <FileText size={20} weight="fill" className="text-primary" />
                      <div>
                        <h3 className="font-semibold text-sm">Return Notes & Remarks</h3>
                        <p className="text-xs text-muted-foreground">Specify reason for return or notes for supplier.</p>
                      </div>
                    </div>
                    <div className="erp-footer-section-content">
                      <Textarea 
                        value={remarks} 
                        onChange={(e) => setRemarks(e.target.value)} 
                        placeholder="Enter return notes or reasons..." 
                        rows={5}
                      />
                    </div>
                  </div>
                </div>

                {/* Column 2: Additional Charges & Totals Box */}
                <div className="erp-footer-col">
                  <div className="bg-muted/40 p-5 rounded-xl border space-y-3">
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
                          className="h-8 w-28 text-right font-mono text-sm bg-background"
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
                          className="h-8 w-28 text-right font-mono text-sm bg-background"
                          value={roundOffAdjustment || ''}
                          onChange={e => setRoundOffAdjustment(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <div className="border-t pt-3 mt-2 flex items-center justify-between">
                      <span className="font-bold text-base text-foreground">Total Return Amount:</span>
                      <span className="font-extrabold text-xl text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                        {formatCurrency(calculatedTotalAmount)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-dashed">
                      Note: Saving this return will auto-create/update a Debit Note of <span className="font-semibold text-foreground">{formatCurrency(calculatedTotalAmount)}</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Item Picker Modal Dialog */}
      <Dialog
        open={itemPickerOpen}
        onOpenChange={(nextOpen) => {
          setItemPickerOpen(nextOpen)
          if (!nextOpen) resetItemPicker()
        }}
      >
        <DialogContent
          className="erp-item-picker-dialog max-h-[85vh] p-0"
          style={{ width: 'min(1100px, calc(100vw - 2rem))', maxWidth: 'min(1100px, calc(100vw - 2rem))' }}
        >
          <DialogHeader className="erp-item-picker-header border-b border-border px-6 py-5">
            <DialogTitle className="erp-item-picker-title text-xl font-bold">Add Return Items</DialogTitle>
          </DialogHeader>

          <div className="erp-item-picker-body space-y-4 px-6 py-5">
            <div className="erp-item-picker-toolbar grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
              <div className="erp-item-picker-search relative">
                <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={itemSearch}
                  onChange={(event) => setItemSearch(event.target.value)}
                  placeholder="Search by Item name / code / category"
                  className="erp-item-picker-input h-11 pl-10 pr-10"
                />
                <Barcode size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
              <Select value={selectedItemCategory} onValueChange={setSelectedItemCategory}>
                <SelectTrigger className="erp-item-picker-category h-11">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {[...new Set(items.map(item => item.category).filter(Boolean))].map(category => (
                    <SelectItem key={category} value={category!}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {setItems && (
                <Button type="button" className="erp-item-picker-create h-11" onClick={() => setShowQuickItem(true)}>
                  Create New Item
                </Button>
              )}
            </div>

            <div className="erp-item-picker-table-card overflow-hidden rounded-xl border border-border">
              <div className="erp-item-picker-table-scroll max-h-[400px] overflow-y-auto">
                <Table className="erp-item-picker-table">
                  <TableHeader className="erp-item-picker-table-head sticky top-0 z-10 bg-muted">
                    <TableRow>
                      <TableHead className="w-[40%]">Item Name</TableHead>
                      <TableHead>Item Code</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Return Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPickerItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                          No items found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPickerItems.map(item => {
                        const pickerQuantity = pickerQuantities[item.id] !== undefined ? pickerQuantities[item.id] : 0
                        const isSelected = pickerQuantities[item.id] !== undefined
                        return (
                          <TableRow
                            key={item.id}
                            className={isSelected ? 'erp-item-picker-row is-selected bg-primary/10' : 'erp-item-picker-row'}
                          >
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.itemCode || '-'}</TableCell>
                            <TableCell className="text-right font-mono">{item.openingStock ?? 0} {item.unit}</TableCell>
                            <TableCell className="text-right font-mono">{item.purchasePrice ? formatCurrency(item.purchasePrice) : '-'}</TableCell>
                            <TableCell className="text-right">
                              {isSelected ? (
                                <div className="erp-picker-stepper flex items-center justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => updatePickerQuantity(item.id, pickerQuantity <= 1 ? null : pickerQuantity - 1)}
                                  >
                                    -
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={pickerQuantity}
                                    onChange={(event) => updatePickerQuantity(item.id, event.target.value === '' ? 0 : parseFloat(event.target.value))}
                                    className="h-7 w-16 px-1 text-center font-mono"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => updatePickerQuantity(item.id, pickerQuantity + 1)}
                                  >
                                    +
                                  </Button>
                                  <span className="erp-picker-unit text-xs ml-1 font-medium">{item.unit}</span>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                                  onClick={() => updatePickerQuantity(item.id, 1)}
                                >
                                  + Add
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <div className="erp-item-picker-footer flex items-center justify-between border-t border-border px-6 py-4">
            <div className="erp-item-picker-selected-count text-sm text-primary font-medium">
              {Object.values(pickerQuantities).filter((quantity) => quantity > 0).length} Item(s) Selected
            </div>
            <div className="erp-item-picker-actions flex gap-3">
              <Button type="button" variant="outline" onClick={() => {
                setItemPickerOpen(false)
                resetItemPicker()
              }}>
                Cancel
              </Button>
              <Button type="button" onClick={handleAddSelectedItemToBill} disabled={Object.values(pickerQuantities).every((quantity) => quantity <= 0)}>
                Add to Return
              </Button>
            </div>
          </div>
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

      {/* Quick Add Supplier Dialog */}
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
            toast.success(`Item "${newItem.name}" added`)
          }}
        />
      )}
    </div>
  )
}
