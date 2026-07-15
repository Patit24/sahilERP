import { useState, useMemo } from 'react'
import { PurchaseInvoice, Supplier, Item, InvoiceItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog'
import { exportPurchaseInvoicePDF } from '@/lib/pdf-export'

interface InvoicesPageProps {
  invoices: PurchaseInvoice[]
  setInvoices: (updater: (prev: PurchaseInvoice[]) => PurchaseInvoice[]) => void
  suppliers: Supplier[]
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void
  items: Item[]
  setItems: (updater: (prev: Item[]) => Item[]) => void
  currentFY: string
  isLocked?: boolean
  gstPercentage?: number
}

export default function InvoicesPage({ invoices, setInvoices, suppliers, setSuppliers, items, setItems, currentFY, isLocked = false, gstPercentage = 18 }: InvoicesPageProps) {
  const [open, setOpen] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<PurchaseInvoice | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [additionalCostBasicRate, setAdditionalCostBasicRate] = useState<number>(0)
  const [additionalCostFinal, setAdditionalCostFinal] = useState<number>(0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [quickSupplierName, setQuickSupplierName] = useState('')
  const [quickSupplierOpeningBalance, setQuickSupplierOpeningBalance] = useState('')
  const [quickSupplierAdvanceCD, setQuickSupplierAdvanceCD] = useState('')
  const [quickSupplierTargetMT, setQuickSupplierTargetMT] = useState('')
  const [quickSupplierTargetRate, setQuickSupplierTargetRate] = useState('')
  const [showQuickItem, setShowQuickItem] = useState(false)
  const [quickItemName, setQuickItemName] = useState('')
  const [quickItemUnit, setQuickItemUnit] = useState<Item['unit']>('MT')
  
  const fyInvoices = invoices.filter(inv => inv.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const filteredInvoices = useMemo(() => {
    let result = fyInvoices
    
    if (selectedMonth !== 'all') {
      result = result.filter(inv => {
        const invDate = new Date(inv.invoiceDate)
        const invMonth = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`
        return invMonth === selectedMonth
      })
    }
    
    if (selectedSupplier !== 'all') {
      result = result.filter(inv => inv.supplierId === selectedSupplier)
    }
    
    return result
  }, [fyInvoices, selectedMonth, selectedSupplier])
  
  const totalMT = filteredInvoices.reduce((sum, inv) => sum + inv.quantityMT, 0)
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)

  const addInvoiceItem = () => {
    setInvoiceItems(prev => [...prev, {
      itemId: '',
      quantityMT: 0,
      basicRate: 0,
      rate: 0,
      amount: 0
    }])
  }

  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index] }
      
      if (field === 'itemId') {
        item.itemId = value as string
      } else if (field === 'quantityMT') {
        item.quantityMT = parseFloat(value as string) || 0
        item.amount = parseFloat((item.quantityMT * item.rate).toFixed(2))
      } else if (field === 'basicRate') {
        const basicRate = parseFloat(value as string) || 0
        item.basicRate = basicRate
        if (basicRate > 0) {
          item.rate = parseFloat((basicRate * (1 + gstPercentage / 100)).toFixed(2))
        } else {
          item.rate = 0
        }
        item.amount = parseFloat((item.quantityMT * item.rate).toFixed(2))
      } else if (field === 'rate') {
        item.rate = parseFloat(value as string) || 0
        item.amount = parseFloat((item.quantityMT * item.rate).toFixed(2))
      }
      
      updated[index] = item
      return updated
    })
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleAdditionalCostBasicRateChange = (value: string) => {
    const basicRate = parseFloat(value) || 0
    setAdditionalCostBasicRate(basicRate)
    if (basicRate > 0) {
      const finalCost = parseFloat((basicRate * (1 + gstPercentage / 100)).toFixed(2))
      setAdditionalCostFinal(finalCost)
    } else {
      setAdditionalCostFinal(0)
    }
  }

  const handleAdditionalCostFinalChange = (value: string) => {
    const finalCost = parseFloat(value) || 0
    setAdditionalCostFinal(finalCost)
  }

  const handleRoundOff = () => {
    const totalAmt = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
    const currentTotal = totalAmt + additionalCostFinal
    const roundedTotal = Math.round(currentTotal)
    const adjustment = parseFloat((roundedTotal - currentTotal).toFixed(2))
    setRoundOffAdjustment(adjustment)
    toast.success(`Round-off adjustment: ${adjustment >= 0 ? '+' : ''}${formatCurrency(adjustment)}`)
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
    const supplierId = selectedSupplierId || (formData.get('supplierId') as string)
    const invoiceNo = formData.get('invoiceNo') as string
    const invoiceDate = formData.get('invoiceDate') as string

    if (!supplierId) {
      toast.error('Select or create a supplier before saving the invoice')
      return
    }

    const isDuplicate = invoices.some(inv => 
      inv.supplierId === supplierId && 
      inv.invoiceNo.trim().toLowerCase() === invoiceNo.trim().toLowerCase() && 
      inv.id !== editingInvoice?.id
    )

    if (isDuplicate) {
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'this supplier'
      toast.error('Duplicate Invoice Number', {
        description: `Invoice number "${invoiceNo}" already exists for ${supplierName}. Please use a different invoice number.`,
        duration: 5000
      })
      return
    }

    if (!isDateInFY(invoiceDate, currentFY)) {
      toast.error('Invalid invoice date', {
        description: `Date must be within ${currentFY} (April to March)`
      })
      return
    }

    if (invoiceItems.length === 0) {
      toast.error('Please add at least one item to the invoice')
      document.getElementById('purchase-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    for (let i = 0; i < invoiceItems.length; i++) {
      const item = invoiceItems[i]
      if (!item.itemId) {
        toast.error(`Row ${i + 1}: Please select an item`)
        document.getElementById('purchase-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      if (!item.quantityMT || item.quantityMT <= 0) {
        toast.error(`Row ${i + 1}: Please enter a valid quantity greater than 0`)
        document.getElementById('purchase-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      if (!item.rate || item.rate <= 0) {
        toast.error(`Row ${i + 1}: Please enter a valid rate greater than 0`)
        document.getElementById('purchase-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
    }

    const totalQty = invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0)
    const totalAmt = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
    const additionalCostBasicRate = parseFloat(formData.get('additionalCostBasicRate') as string) || 0
    const additionalCost = additionalCostBasicRate > 0 
      ? parseFloat((additionalCostBasicRate * (1 + gstPercentage / 100)).toFixed(2))
      : parseFloat(formData.get('additionalCost') as string) || 0
    const additionalCostRemarks = (formData.get('additionalCostRemarks') as string) || ''
    const roundOffAdjustment = parseFloat(formData.get('roundOffAdjustment') as string) || 0
    const finalInvoiceAmount = parseFloat((totalAmt + additionalCost + roundOffAdjustment).toFixed(2))

    if (editingInvoice) {
      const updated: PurchaseInvoice = {
        ...editingInvoice,
        supplierId: supplierId,
        invoiceNo: invoiceNo,
        invoiceDate: invoiceDate,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: finalInvoiceAmount,
        additionalCost: additionalCost,
        additionalCostBasicRate: additionalCostBasicRate || undefined,
        additionalCostRemarks: additionalCostRemarks || undefined,
        roundOffAdjustment: roundOffAdjustment || undefined,
      }
      setInvoices((prev) => prev.map(inv => inv.id === editingInvoice.id ? updated : inv))
      toast.success('Invoice updated successfully')
    } else {
      const invoice: PurchaseInvoice = {
        id: `invoice-${Date.now()}`,
        supplierId: supplierId,
        invoiceNo: invoiceNo,
        invoiceDate: invoiceDate,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: finalInvoiceAmount,
        additionalCost: additionalCost,
        additionalCostBasicRate: additionalCostBasicRate || undefined,
        additionalCostRemarks: additionalCostRemarks || undefined,
        roundOffAdjustment: roundOffAdjustment || undefined,
        fy: currentFY,
        createdAt: Date.now()
      }
      setInvoices((prev) => [...prev, invoice])
      toast.success('Invoice added successfully')
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !editingInvoice) {
      setSelectedSupplierId('')
      setShowQuickSupplier(suppliers.length === 0)
      setQuickSupplierName('')
      setQuickSupplierOpeningBalance('')
      setQuickSupplierAdvanceCD('')
      setQuickSupplierTargetMT('')
      setQuickSupplierTargetRate('')
      setShowQuickItem(items.length === 0)
      setQuickItemName('')
      setQuickItemUnit('MT')
      setInvoiceItems([{
        itemId: '',
        quantityMT: 0,
        basicRate: 0,
        rate: 0,
        amount: 0
      }])
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setRoundOffAdjustment(0)
      
      setTimeout(() => {
        document.querySelector('.erp-invoice-body')?.scrollTo({ top: 0 })
        const invoiceDateInput = document.getElementById('invoiceDate') as HTMLInputElement
        if (invoiceDateInput) {
          invoiceDateInput.value = ''
        }
      }, 0)
    } else if (!newOpen) {
      setInvoiceItems([])
      setEditingInvoice(null)
      setSelectedSupplierId('')
      setShowQuickSupplier(false)
      setQuickSupplierName('')
      setQuickSupplierOpeningBalance('')
      setQuickSupplierAdvanceCD('')
      setQuickSupplierTargetMT('')
      setQuickSupplierTargetRate('')
      setShowQuickItem(false)
      setQuickItemName('')
      setQuickItemUnit('MT')
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setRoundOffAdjustment(0)
    }
  }

  const handleEdit = (invoice: PurchaseInvoice) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingInvoice(invoice)
    setSelectedSupplierId(invoice.supplierId)
    setInvoiceItems(invoice.items || [])
    setAdditionalCostBasicRate(invoice.additionalCostBasicRate || 0)
    setAdditionalCostFinal(invoice.additionalCost || 0)
    setRoundOffAdjustment(invoice.roundOffAdjustment || 0)
    setOpen(true)
  }

  const handleDeleteClick = (invoice: PurchaseInvoice) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setInvoiceToDelete(invoice)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (invoiceToDelete) {
      setInvoices((prev) => prev.filter(inv => inv.id !== invoiceToDelete.id))
      toast.success('Invoice deleted successfully')
      setDeleteDialogOpen(false)
      setInvoiceToDelete(null)
    }
  }

  const handleAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingInvoice(null)
    setOpen(true)
  }

  const handleQuickSupplierCreate = () => {
    const name = quickSupplierName.trim()
    if (!name) {
      toast.error('Supplier name is required')
      return
    }

    const duplicate = suppliers.some((supplier) => supplier.name.trim().toLowerCase() === name.toLowerCase())
    if (duplicate) {
      toast.error('Supplier already exists')
      return
    }

    const targetMT = parseFloat(quickSupplierTargetMT) || 0
    const targetRate = parseFloat(quickSupplierTargetRate) || 0

    const supplier: Supplier = {
      id: `supplier-${Date.now()}`,
      name,
      openingBalance: parseFloat(quickSupplierOpeningBalance) || 0,
      advanceCDPercentage: parseFloat(quickSupplierAdvanceCD) || 0,
      annualTarget: targetMT > 0 || targetRate > 0 ? {
        targetMT,
        ratePerMT: targetRate
      } : undefined,
      paymentCDRules: [],
      invoiceCloseCDRules: []
    }

    setSuppliers((prev) => [...prev, supplier])
    setSelectedSupplierId(supplier.id)
    setQuickSupplierName('')
    setQuickSupplierOpeningBalance('')
    setQuickSupplierAdvanceCD('')
    setQuickSupplierTargetMT('')
    setQuickSupplierTargetRate('')
    setShowQuickSupplier(false)
    toast.success(`Supplier "${name}" created`)
  }

  const handleQuickItemCreate = () => {
    const name = quickItemName.trim()
    if (!name) {
      toast.error('Item name is required')
      return
    }

    const duplicate = items.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())
    if (duplicate) {
      toast.error('Item already exists')
      return
    }

    const item: Item = {
      id: `item-${Date.now()}`,
      name,
      unit: quickItemUnit
    }

    setItems((prev) => [...prev, item])
    setInvoiceItems((prev) => {
      if (prev.length === 0) {
        return [{ itemId: item.id, quantityMT: 0, basicRate: 0, rate: 0, amount: 0 }]
      }
      const emptyIndex = prev.findIndex((row) => !row.itemId)
      if (emptyIndex === -1) {
        return [...prev, { itemId: item.id, quantityMT: 0, basicRate: 0, rate: 0, amount: 0 }]
      }
      return prev.map((row, index) => index === emptyIndex ? { ...row, itemId: item.id } : row)
    })
    setQuickItemName('')
    setQuickItemUnit('MT')
    setShowQuickItem(false)
    toast.success(`Item "${name}" created`)
  }

  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const itemMap = new Map(items.map(i => [i.id, i]))

  const totalInvoiceAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
  const totalInvoiceQty = invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0)

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  const handleDownloadInvoicePDF = (invoice: PurchaseInvoice) => {
    exportPurchaseInvoicePDF(invoice, supplierMap.get(invoice.supplierId), itemMap, {
      businessName: 'SK TRADERS',
      state: 'West Bengal',
      phone: '9083876218'
    })
    toast.success(`Downloaded invoice ${invoice.invoiceNo}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Purchase Invoices</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Record all purchase transactions for {currentFY}
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
		            <Button onClick={handleAdd} size="sm">
              <Plus className="mr-1.5" size={16} />
              Add Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="erp-invoice-dialog max-w-[min(1180px,calc(100vw-2rem))] max-h-[92dvh] p-0">
            <DialogHeader className="erp-invoice-dialog-header">
              <div className="erp-dialog-kicker">Purchase Entry</div>
              <DialogTitle className="erp-invoice-dialog-title">
                {editingInvoice ? 'Edit Invoice' : 'Add New Invoice'}
              </DialogTitle>
              <p className="erp-invoice-dialog-subtitle">Enter invoice header and add items</p>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="erp-invoice-form">
              <div className="erp-invoice-body">
                <div className="erp-form-panel">
                  <h3 className="erp-section-title">Invoice Header</h3>
                  <div className="erp-responsive-grid">
	                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                      <Label htmlFor="supplierId" className="text-xs font-medium">Supplier <span className="text-destructive">*</span></Label>
	                      <div className="flex gap-2">
	                      <Select name="supplierId" value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
	                        <SelectTrigger id="supplierId" className="h-9 bg-background text-sm">
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
	                        <Button
	                          type="button"
	                          variant="outline"
	                          className="h-9 shrink-0 gap-1.5 px-3 text-xs"
	                          onClick={() => setShowQuickSupplier((value) => !value)}
	                        >
	                          <Plus size={14} weight="bold" />
	                          New
	                        </Button>
	                      </div>
	                      {showQuickSupplier && (
	                        <div className="mt-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
	                          <div className="grid gap-2 xl:grid-cols-[minmax(0,1.35fr)_140px_130px_130px_130px_auto]">
	                            <Input
	                              value={quickSupplierName}
	                              onChange={(event) => setQuickSupplierName(event.target.value)}
	                              placeholder="New supplier name"
	                              className="h-9 bg-background text-sm"
	                            />
	                            <Input
	                              type="number"
	                              step="0.01"
	                              value={quickSupplierOpeningBalance}
	                              onChange={(event) => setQuickSupplierOpeningBalance(event.target.value)}
	                              placeholder="Opening balance"
	                              className="h-9 bg-background text-sm font-mono"
	                            />
	                            <Input
	                              type="number"
	                              step="0.01"
	                              value={quickSupplierAdvanceCD}
	                              onChange={(event) => setQuickSupplierAdvanceCD(event.target.value)}
	                              placeholder="Advance CD %"
	                              className="h-9 bg-background text-sm font-mono"
	                            />
	                            <Input
	                              type="number"
	                              step="0.001"
	                              value={quickSupplierTargetMT}
	                              onChange={(event) => setQuickSupplierTargetMT(event.target.value)}
	                              placeholder="Target MT"
	                              className="h-9 bg-background text-sm font-mono"
	                            />
	                            <Input
	                              type="number"
	                              step="0.01"
	                              value={quickSupplierTargetRate}
	                              onChange={(event) => setQuickSupplierTargetRate(event.target.value)}
	                              placeholder="Rate/MT"
	                              className="h-9 bg-background text-sm font-mono"
	                            />
	                            <Button type="button" className="h-9 px-4 text-xs" onClick={handleQuickSupplierCreate}>
	                              Create
	                            </Button>
	                          </div>
	                        </div>
	                      )}
	                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invoiceNo" className="text-xs font-medium">Invoice Number <span className="text-destructive">*</span></Label>
                      <Input 
                        id="invoiceNo" 
                        name="invoiceNo"
                        defaultValue={editingInvoice?.invoiceNo}
                        placeholder="INV-001"
                        className="h-9 bg-background text-sm"
                        required 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="invoiceDate" className="text-xs font-medium">Invoice Date <span className="text-destructive">*</span></Label>
                      <Input 
                        id="invoiceDate" 
                        name="invoiceDate" 
                        type="date"
                        defaultValue={editingInvoice?.invoiceDate}
                        min={minDate}
                        max={maxDate}
                        className="h-9 bg-background text-sm"
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">For payments, reports, ageing, and fixed scheme eligibility</p>
                    </div>
                  </div>
                </div>

                <div id="purchase-invoice-items" className="space-y-2.5">
                  <div className="erp-section-toolbar">
                    <h3 className="erp-section-title">
                      Invoice Items <span className="text-destructive">*</span>
                    </h3>
                    <div className="erp-toolbar-actions">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        GST: {gstPercentage}% • Rate = Basic Rate × {(1 + gstPercentage / 100).toFixed(2)}
                      </span>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
	                        className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs px-3"
	                        onClick={addInvoiceItem}
	                      >
	                        <Plus size={14} weight="bold" />
	                        Add Item
	                      </Button>
	                      <Button 
	                        type="button" 
	                        size="sm" 
	                        variant="outline"
	                        className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs px-3"
	                        onClick={() => setShowQuickItem((value) => !value)}
	                      >
	                        <Plus size={14} weight="bold" />
	                        New Item
	                      </Button>
	                    </div>
	                  </div>

	                  {showQuickItem && (
	                    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
	                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
	                        <Input
	                          value={quickItemName}
	                          onChange={(event) => setQuickItemName(event.target.value)}
	                          placeholder="New item name"
	                          className="h-9 bg-background text-sm"
	                        />
	                        <Select value={quickItemUnit} onValueChange={(value) => setQuickItemUnit(value as Item['unit'])}>
	                          <SelectTrigger className="h-9 bg-background text-sm">
	                            <SelectValue placeholder="Unit" />
	                          </SelectTrigger>
	                          <SelectContent>
	                            <SelectItem value="MT">MT</SelectItem>
	                            <SelectItem value="KG">KG</SelectItem>
	                            <SelectItem value="PCS">PCS</SelectItem>
	                            <SelectItem value="TON">TON</SelectItem>
	                          </SelectContent>
	                        </Select>
	                        <Button type="button" className="h-9 px-4 text-xs" onClick={handleQuickItemCreate}>
	                          Create Item
	                        </Button>
	                      </div>
	                    </div>
	                  )}

	                  <div className="erp-table-panel">
                    {items.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground border-b border-border/50">
                        No item master found. Use <span className="font-semibold text-primary">New Item</span> above to create one inside this invoice.
                      </div>
                    )}
                    <div className="max-h-[320px] overflow-y-auto overflow-x-hidden">
                      <Table>
                        <TableHeader className="sticky top-0 bg-muted/50 z-10">
                          <TableRow className="hover:bg-muted/50">
                            <TableHead className="font-semibold text-foreground text-xs w-[28%] px-2">
                              Item <span className="text-destructive">*</span>
                            </TableHead>
                            <TableHead className="font-semibold text-foreground text-xs w-[14%] px-2">
                              Qty (MT) <span className="text-destructive">*</span>
                            </TableHead>
                            <TableHead className="font-semibold text-foreground text-xs w-[14%] px-2">
                              Basic Rate
                            </TableHead>
                            <TableHead className="font-semibold text-foreground text-xs w-[14%] px-2">
                              Rate <span className="text-destructive">*</span>
                            </TableHead>
                            <TableHead className="font-semibold text-foreground text-xs w-[20%] px-2">Amount</TableHead>
                            <TableHead className="w-[10%] px-1"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoiceItems.map((invoiceItem, index) => (
                            <TableRow key={index} className="hover:bg-muted/30">
                              <TableCell className="px-2 py-2">
                                <Select 
                                  value={invoiceItem.itemId}
                                  onValueChange={(value) => updateInvoiceItem(index, 'itemId', value)}
                                >
                                  <SelectTrigger className="h-8 w-full border-border/60 text-xs">
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
                              </TableCell>

                              <TableCell className="px-2 py-2">
                                <Input 
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={invoiceItem.quantityMT || ''}
                                  onChange={(e) => updateInvoiceItem(index, 'quantityMT', e.target.value)}
                                  placeholder="0"
                                  className="h-8 font-mono text-right border-border/60 text-xs px-2"
                                />
                              </TableCell>

                              <TableCell className="px-2 py-2">
                                <Input 
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={invoiceItem.basicRate || ''}
                                  onChange={(e) => updateInvoiceItem(index, 'basicRate', e.target.value)}
                                  placeholder="0"
                                  className="h-8 font-mono text-right border-border/60 text-xs px-2"
                                />
                              </TableCell>

                              <TableCell className="px-2 py-2">
                                <Input 
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={invoiceItem.rate || ''}
                                  onChange={(e) => updateInvoiceItem(index, 'rate', e.target.value)}
                                  placeholder="0"
                                  className="h-8 font-mono text-right border-border/60 text-xs px-2"
                                />
                              </TableCell>

                              <TableCell className="px-2 py-2">
                                <Input 
                                  type="text"
                                  value={formatCurrency(invoiceItem.amount)}
                                  disabled
                                  className="h-8 font-mono text-right bg-muted/50 border-muted text-xs px-2"
                                />
                              </TableCell>

                              <TableCell className="px-1 py-2 text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                                  onClick={() => removeInvoiceItem(index)}
                                  disabled={invoiceItems.length === 1}
                                >
                                  <X size={16} weight="bold" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {invoiceItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="erp-section-toolbar">
                          <h3 className="erp-section-title">
                            Additional Cost (Optional)
                          </h3>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            GST: {gstPercentage}% • Final = Basic × {(1 + gstPercentage / 100).toFixed(2)}
                          </span>
                        </div>

                        <div className="erp-table-panel">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow className="hover:bg-muted/50">
                                <TableHead className="font-semibold text-foreground text-xs w-[25%] px-2">
                                  Remarks / Note
                                </TableHead>
                                <TableHead className="font-semibold text-foreground text-xs w-[20%] px-2">
                                  Basic Rate
                                </TableHead>
                                <TableHead className="font-semibold text-foreground text-xs w-[20%] px-2">
                                  Final Cost
                                </TableHead>
                                <TableHead className="font-semibold text-foreground text-xs w-[35%] px-2">Description</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              <TableRow className="hover:bg-muted/30">
                                <TableCell className="px-2 py-2">
                                  <Input 
                                    id="additionalCostRemarks" 
                                    name="additionalCostRemarks"
                                    type="text"
                                    defaultValue={editingInvoice?.additionalCostRemarks || ''}
                                    placeholder="e.g., Freight, Handling"
                                    className="h-8 bg-background text-xs px-2"
                                  />
                                </TableCell>

                                <TableCell className="px-2 py-2">
                                  <Input 
                                    id="additionalCostBasicRate" 
                                    name="additionalCostBasicRate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={additionalCostBasicRate || ''}
                                    onChange={(e) => handleAdditionalCostBasicRateChange(e.target.value)}
                                    placeholder="0.00"
                                    className="h-8 font-mono text-right bg-background text-xs px-2"
                                  />
                                </TableCell>

                                <TableCell className="px-2 py-2">
                                  <Input 
                                    id="additionalCost" 
                                    name="additionalCost"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={additionalCostFinal || ''}
                                    onChange={(e) => handleAdditionalCostFinalChange(e.target.value)}
                                    placeholder="0.00"
                                    className="h-8 font-mono text-right bg-background text-xs px-2"
                                  />
                                </TableCell>

                                <TableCell className="px-2 py-2">
                                  <span className="text-[10px] text-muted-foreground italic">
                                    {additionalCostBasicRate > 0 
                                      ? `Auto-calculated: ${additionalCostBasicRate} × ${(1 + gstPercentage / 100).toFixed(2)} = ${additionalCostFinal.toFixed(2)}`
                                      : 'Enter Basic Rate or Final Cost directly'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      
                      <div className="erp-total-panel">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Total Quantity:</span>
                              <span className="font-mono font-semibold text-foreground">{formatMT(totalInvoiceQty)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Items Total:</span>
                              <span className="font-mono font-semibold text-foreground">{formatCurrency(totalInvoiceAmount)}</span>
                            </div>
                          </div>
                          {(additionalCostBasicRate > 0 || additionalCostFinal > 0) && (
                            <>
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Additional Cost:</span>
                                  <span className="font-mono font-semibold text-foreground">{formatCurrency(additionalCostFinal)}</span>
                                </div>
                              </div>
                            </>
                          )}
                          {roundOffAdjustment !== 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Round-off:</span>
                                <span className="font-mono font-semibold text-foreground">{roundOffAdjustment >= 0 ? '+' : ''}{formatCurrency(roundOffAdjustment)}</span>
                              </div>
                            </div>
                          )}
                          <div className="h-px bg-border"></div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-medium">Final Invoice Amount:</span>
                                <span className="font-mono font-bold text-base text-primary">{formatCurrency(totalInvoiceAmount + additionalCostFinal + roundOffAdjustment)}</span>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2.5 gap-1.5"
                                onClick={handleRoundOff}
                              >
                                Round Off
                              </Button>
                            </div>
                          </div>
                          <input type="hidden" name="roundOffAdjustment" value={roundOffAdjustment} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="erp-dialog-footer">
                <div className="erp-dialog-actions">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="erp-secondary-action flex-1" 
                    onClick={() => handleOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="erp-primary-action flex-1" 
                    disabled={invoiceItems.length === 0}
                  >
                    {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <>
          <Card className="bg-accent/5 border-accent/20">
            <CardContent className="pt-3 pb-3">
              <div className="flex gap-2.5">
                <Info size={18} className="text-accent mt-0.5 flex-shrink-0" />
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-foreground">FIFO Allocation Updates Automatically</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Adding an invoice with an earlier date will trigger complete FIFO recalculation. 
                    All existing payments and invoices are reprocessed chronologically, ensuring advances 
                    allocate to the earliest available invoices.
                  </p>
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
                  {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Total Quantity</div>
                <div className="text-xl font-mono font-semibold">{formatMT(totalMT)}</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="pt-4 pb-4">
                <div className="text-xs text-muted-foreground mb-1">Total Amount</div>
                <div className="text-xl font-mono font-semibold">{formatCurrency(totalAmount)}</div>
              </CardContent>
            </Card>
          </div>

          {filteredInvoices.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Receipt size={40} className="text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  No invoices found for the selected month.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-muted/30">
                        <TableHead className="h-9 text-xs font-semibold">Invoice No</TableHead>
                        <TableHead className="h-9 text-xs font-semibold">Supplier</TableHead>
                        <TableHead className="h-9 text-xs font-semibold">Date</TableHead>
                        <TableHead className="h-9 text-xs font-semibold">Items</TableHead>
                        <TableHead className="h-9 text-xs font-semibold text-right">Quantity</TableHead>
                        <TableHead className="h-9 text-xs font-semibold text-right">Amount</TableHead>
                        <TableHead className="h-9 w-[150px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices
                        .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
                        .map(invoice => {
                          const supplier = supplierMap.get(invoice.supplierId)
                          const itemNames = (invoice.items || [])
                            .map(item => itemMap.get(item.itemId)?.name || 'Unknown')
                            .join(', ')
                          
                          return (
                            <TableRow key={invoice.id} className="hover:bg-muted/20">
                              <TableCell className="text-xs font-medium">{invoice.invoiceNo}</TableCell>
                              <TableCell className="text-xs">{supplier?.name || 'Unknown'}</TableCell>
                              <TableCell className="text-xs font-mono">{new Date(invoice.invoiceDate).toLocaleDateString()}</TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate" title={itemNames}>
                                {itemNames || 'No items'}
                              </TableCell>
                              <TableCell className="text-xs font-mono text-right">{formatMT(invoice.quantityMT)}</TableCell>
                              <TableCell className="text-xs font-mono text-right">{formatCurrency(invoice.invoiceAmount)}</TableCell>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => setPreviewInvoice(invoice)}
                                    aria-label={`Preview invoice ${invoice.invoiceNo}`}
                                  >
                                    <Receipt size={16} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 px-2 text-xs"
                                    onClick={() => handleDownloadInvoicePDF(invoice)}
                                    aria-label={`Download invoice ${invoice.invoiceNo} PDF`}
                                    title="Download PDF"
                                  >
                                    <DownloadSimple size={14} />
                                    PDF
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={() => handleEdit(invoice)}
                                    aria-label={`Edit invoice ${invoice.invoiceNo}`}
                                  >
                                    <PencilSimple size={16} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteClick(invoice)}
                                    aria-label={`Delete invoice ${invoice.invoiceNo}`}
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
              </CardContent>
            </Card>
          )}
      </>

      {previewInvoice && (
        <InvoicePreviewDialog
          open={Boolean(previewInvoice)}
          onOpenChange={(open) => !open && setPreviewInvoice(null)}
          mode="purchase"
          invoiceNo={previewInvoice.invoiceNo}
          invoiceDate={previewInvoice.invoiceDate}
          partyName={supplierMap.get(previewInvoice.supplierId)?.name || 'Unknown supplier'}
          items={previewInvoice.items || []}
          itemMap={itemMap}
          totalAmount={previewInvoice.invoiceAmount}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Purchase Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice <strong>{invoiceToDelete?.invoiceNo}</strong> from <strong>{supplierMap.get(invoiceToDelete?.supplierId || '')?.name}</strong>? 
              <br /><br />
              This action cannot be undone and will affect all related calculations, payments, and reports.
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
  );
}
