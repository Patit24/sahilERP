import { useState, useMemo } from 'react'
import { SalesInvoice, Customer, Item, InvoiceItem } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple, MagnifyingGlass, Barcode, Package, UserPlus } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog'
import { exportSalesInvoicePDF } from '@/lib/pdf-export'

interface SalesInvoicesPageProps {
  salesInvoices: SalesInvoice[]
  setSalesInvoices: (updater: (prev: SalesInvoice[]) => SalesInvoice[]) => void
  customers: Customer[]
  setCustomers: (updater: (prev: Customer[]) => Customer[]) => void
  items: Item[]
  setItems: (updater: (prev: Item[]) => Item[]) => void
  currentFY: string
  isLocked?: boolean
}

export default function SalesInvoicesPage({ salesInvoices, setSalesInvoices, customers, setCustomers, items, setItems, currentFY, isLocked = false }: SalesInvoicesPageProps) {
  const [open, setOpen] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showQuickCustomer, setShowQuickCustomer] = useState(false)
  const [quickCustomerName, setQuickCustomerName] = useState('')
  const [quickCustomerPhone, setQuickCustomerPhone] = useState('')
  const [quickCustomerEmail, setQuickCustomerEmail] = useState('')
  const [quickCustomerAddress, setQuickCustomerAddress] = useState('')
  const [quickCustomerState, setQuickCustomerState] = useState('')
  const [quickCustomerPincode, setQuickCustomerPincode] = useState('')
  const [quickCustomerCity, setQuickCustomerCity] = useState('')
  const [quickCustomerGstin, setQuickCustomerGstin] = useState('')
  const [quickCustomerOpeningBalance, setQuickCustomerOpeningBalance] = useState('')
  const [showQuickItem, setShowQuickItem] = useState(false)
  const [itemPickerOpen, setItemPickerOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemCategory, setSelectedItemCategory] = useState('all')
  const [selectedPickerItemId, setSelectedPickerItemId] = useState('')
  const [quickItemName, setQuickItemName] = useState('')
  const [quickItemUnit, setQuickItemUnit] = useState<Item['unit']>('MT')
  const [quickItemCategory, setQuickItemCategory] = useState('')
  const [quickItemPurchasePrice, setQuickItemPurchasePrice] = useState('')
  const [quickItemSalesPrice, setQuickItemSalesPrice] = useState('')
  const [quickItemOpeningStock, setQuickItemOpeningStock] = useState('')
  const [quickItemGstRate, setQuickItemGstRate] = useState('')
  
  const fyInvoices = salesInvoices.filter(inv => inv.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const filteredInvoices = useMemo(() => {
    let result = fyInvoices
    
    if (selectedMonth !== 'all') {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'))
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'))
      
      result = result.filter(inv => {
        const invDate = parseISO(inv.invoiceDate)
        return isWithinInterval(invDate, { start: monthStart, end: monthEnd })
      })
    }
    
    if (selectedCustomer !== 'all') {
      result = result.filter(inv => inv.customerId === selectedCustomer)
    }
    
    return result
  }, [fyInvoices, selectedMonth, selectedCustomer])
  
  const totalMT = filteredInvoices.reduce((sum, inv) => sum + inv.quantityMT, 0)
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)

  const addInvoiceItem = () => {
    setInvoiceItems(prev => [...prev, {
      itemId: '',
      quantityMT: 0,
      rate: 0,
      amount: 0
    }])
  }

  const addInvoiceItemWithItem = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId)
    const rate = item?.salesPrice || item?.purchasePrice || 0
    const row = {
      itemId,
      quantityMT: 0,
      rate,
      amount: 0
    }

    setInvoiceItems(prev => {
      const emptyIndex = prev.findIndex(existing => !existing.itemId)
      if (emptyIndex === -1) return [...prev, row]
      return prev.map((existing, index) => index === emptyIndex ? row : existing)
    })
  }

  const handleAddSelectedItemToBill = () => {
    if (!selectedPickerItemId) {
      toast.error('Please select an item first')
      return
    }

    addInvoiceItemWithItem(selectedPickerItemId)
    setItemPickerOpen(false)
    setSelectedPickerItemId('')
    setItemSearch('')
    setSelectedItemCategory('all')
  }

  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index] }
      
      if (field === 'itemId') {
        item.itemId = value as string
      } else if (field === 'quantityMT') {
        item.quantityMT = parseFloat(value as string) || 0
        item.amount = item.quantityMT * item.rate
      } else if (field === 'rate') {
        item.rate = parseFloat(value as string) || 0
        item.amount = item.quantityMT * item.rate
      }
      
      updated[index] = item
      return updated
    })
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index))
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
    const customerId = selectedCustomerId || (formData.get('customerId') as string)
    const invoiceDate = formData.get('invoiceDate') as string

    if (!customerId) {
      toast.error('Select or create a customer before saving the invoice')
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
      document.getElementById('sales-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    for (let i = 0; i < invoiceItems.length; i++) {
      const item = invoiceItems[i]
      if (!item.itemId) {
        toast.error(`Row ${i + 1}: Please select an item`)
        document.getElementById('sales-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      if (!item.quantityMT || item.quantityMT <= 0) {
        toast.error(`Row ${i + 1}: Please enter a valid quantity greater than 0`)
        document.getElementById('sales-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      if (!item.rate || item.rate <= 0) {
        toast.error(`Row ${i + 1}: Please enter a valid rate greater than 0`)
        document.getElementById('sales-invoice-items')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
    }

    const totalQty = invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0)
    const totalAmt = invoiceItems.reduce((sum, item) => sum + item.amount, 0)

    if (editingInvoice) {
      const updatedInvoice: SalesInvoice = {
        ...editingInvoice,
        customerId,
        invoiceNo: formData.get('invoiceNo') as string,
        invoiceDate: formData.get('invoiceDate') as string,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: totalAmt,
      }
      setSalesInvoices((prev) => prev.map(inv => inv.id === editingInvoice.id ? updatedInvoice : inv))
    } else {
      const invoice: SalesInvoice = {
        id: `sales-invoice-${Date.now()}`,
        customerId,
        invoiceNo: formData.get('invoiceNo') as string,
        invoiceDate: formData.get('invoiceDate') as string,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: totalAmt,
        fy: currentFY
      }
      setSalesInvoices((prev) => [...prev, invoice])
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !editingInvoice) {
      setSelectedCustomerId('')
      setShowQuickCustomer(customers.length === 0)
      setQuickCustomerName('')
      setQuickCustomerPhone('')
      setQuickCustomerEmail('')
      setQuickCustomerAddress('')
      setQuickCustomerState('')
      setQuickCustomerPincode('')
      setQuickCustomerCity('')
      setQuickCustomerGstin('')
      setQuickCustomerOpeningBalance('')
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setQuickItemName('')
      setQuickItemUnit('MT')
      setQuickItemCategory('')
      setQuickItemPurchasePrice('')
      setQuickItemSalesPrice('')
      setQuickItemOpeningStock('')
      setQuickItemGstRate('')
      setInvoiceItems([{
        itemId: '',
        quantityMT: 0,
        rate: 0,
        amount: 0
      }])
      setTimeout(() => {
        document.querySelector('.erp-invoice-body')?.scrollTo({ top: 0 })
      }, 0)
    } else if (!newOpen) {
      setInvoiceItems([])
      setEditingInvoice(null)
      setSelectedCustomerId('')
      setShowQuickCustomer(false)
      setQuickCustomerName('')
      setQuickCustomerPhone('')
      setQuickCustomerEmail('')
      setQuickCustomerAddress('')
      setQuickCustomerState('')
      setQuickCustomerPincode('')
      setQuickCustomerCity('')
      setQuickCustomerGstin('')
      setQuickCustomerOpeningBalance('')
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setQuickItemName('')
      setQuickItemUnit('MT')
      setQuickItemCategory('')
      setQuickItemPurchasePrice('')
      setQuickItemSalesPrice('')
      setQuickItemOpeningStock('')
      setQuickItemGstRate('')
    }
  }

  const handleEdit = (invoice: SalesInvoice) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingInvoice(invoice)
    setSelectedCustomerId(invoice.customerId)
    setInvoiceItems(invoice.items || [])
    setOpen(true)
  }

  const handleDeleteClick = (invoice: SalesInvoice) => {
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
      setSalesInvoices((prev) => prev.filter((inv) => inv.id !== invoiceToDelete.id))
      toast.success('Sales invoice deleted successfully')
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

  const handleQuickCustomerCreate = () => {
    const name = quickCustomerName.trim()
    if (!name) {
      toast.error('Customer name is required')
      return
    }

    const duplicate = customers.some((customer) => customer.name.trim().toLowerCase() === name.toLowerCase())
    if (duplicate) {
      toast.error('Customer already exists')
      return
    }

    const customer: Customer = {
      id: `customer-${Date.now()}`,
      name,
      phone: quickCustomerPhone.trim() || undefined,
      email: quickCustomerEmail.trim() || undefined,
      address: quickCustomerAddress.trim() || undefined,
      state: quickCustomerState.trim() || undefined,
      pincode: quickCustomerPincode.trim() || undefined,
      city: quickCustomerCity.trim() || undefined,
      gstin: quickCustomerGstin.trim() || undefined,
      openingBalance: parseFloat(quickCustomerOpeningBalance) || 0
    }

    setCustomers((prev) => [...prev, customer])
    setSelectedCustomerId(customer.id)
    setQuickCustomerName('')
    setQuickCustomerPhone('')
    setQuickCustomerEmail('')
    setQuickCustomerAddress('')
    setQuickCustomerState('')
    setQuickCustomerPincode('')
    setQuickCustomerCity('')
    setQuickCustomerGstin('')
    setQuickCustomerOpeningBalance('')
    setShowQuickCustomer(false)
    toast.success(`Customer "${name}" created`)
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
      unit: quickItemUnit,
      category: quickItemCategory.trim() || undefined,
      purchasePrice: parseFloat(quickItemPurchasePrice) || undefined,
      salesPrice: parseFloat(quickItemSalesPrice) || undefined,
      openingStock: parseFloat(quickItemOpeningStock) || undefined,
      gstRate: parseFloat(quickItemGstRate) || undefined
    }

    const rate = item.salesPrice || item.purchasePrice || 0

    setItems((prev) => [...prev, item])
    setInvoiceItems((prev) => {
      if (prev.length === 0) {
        return [{ itemId: item.id, quantityMT: 0, rate, amount: 0 }]
      }
      const emptyIndex = prev.findIndex((row) => !row.itemId)
      if (emptyIndex === -1) return [...prev, { itemId: item.id, quantityMT: 0, rate, amount: 0 }]
      return prev.map((row, index) => index === emptyIndex ? { ...row, itemId: item.id, rate } : row)
    })
    setQuickItemName('')
    setQuickItemUnit('MT')
    setQuickItemCategory('')
    setQuickItemPurchasePrice('')
    setQuickItemSalesPrice('')
    setQuickItemOpeningStock('')
    setQuickItemGstRate('')
    setShowQuickItem(false)
    toast.success(`Item "${name}" created`)
  }

  const getCustomerName = (customerId: string) => {
    return customers.find(c => c.id === customerId)?.name || 'Unknown'
  }

  const getItemName = (itemId: string) => {
    return items.find(i => i.id === itemId)?.name || 'Unknown'
  }

  const customerMap = new Map(customers.map(customer => [customer.id, customer]))
  const itemMap = new Map(items.map(item => [item.id, item]))
  const filteredPickerItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()

    return items
      .filter((item) => {
        if (selectedItemCategory !== 'all' && item.category !== selectedItemCategory) return false
        if (!query) return true

        return [
          item.name,
          item.itemCode,
          item.category,
          item.description,
          item.unit
        ].some((value) => value?.toLowerCase().includes(query))
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [itemSearch, items, selectedItemCategory])

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  const handleDownloadInvoicePDF = (invoice: SalesInvoice) => {
    exportSalesInvoicePDF(invoice, customerMap.get(invoice.customerId), itemMap, {
      businessName: 'SK TRADERS',
      state: 'West Bengal',
      phone: '9083876218'
    })
    toast.success(`Downloaded invoice ${invoice.invoiceNo}`)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Sales Invoices</p>
                <p className="text-3xl font-semibold text-foreground">{fyInvoices.length}</p>
              </div>
              <Receipt size={40} weight="duotone" className="text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Quantity Sold</p>
                <p className="text-3xl font-semibold text-foreground">{formatMT(totalMT)}</p>
              </div>
              <div className="text-success text-2xl font-mono">MT</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Sales Amount</p>
                <p className="text-3xl font-semibold text-foreground">{formatCurrency(totalAmount)}</p>
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
              <Receipt size={22} weight="duotone" className="text-primary" />
              Sales Invoice List
            </h3>
            <Dialog open={open} onOpenChange={handleOpenChange}>
              <DialogTrigger asChild>
		                <Button onClick={handleAdd}>
                  <Plus size={18} weight="bold" />
                  Add Sales Invoice
                </Button>
              </DialogTrigger>
                <DialogContent className="erp-invoice-dialog max-w-[min(1180px,calc(100vw-2rem))] max-h-[92dvh] p-0">
                  <DialogHeader className="erp-invoice-dialog-header">
                    <div className="erp-dialog-kicker">Sales Entry</div>
                    <DialogTitle className="erp-invoice-dialog-title">
                      {editingInvoice ? 'Edit Sales Invoice' : 'Add Sales Invoice'}
                    </DialogTitle>
                    <p className="erp-invoice-dialog-subtitle">Enter invoice header and add items</p>
                  </DialogHeader>
                  
                  <form onSubmit={handleSubmit} className="erp-invoice-form">
                    <div className="erp-invoice-body">
                      <div className="erp-form-panel">
                        <h3 className="erp-section-title">Invoice Header</h3>
                        <div className="erp-responsive-grid">
	                          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                            <Label htmlFor="customerId" className="text-xs font-medium">Customer <span className="text-destructive">*</span></Label>
	                            <div className="flex gap-2">
	                            <Select name="customerId" value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
	                              <SelectTrigger id="customerId" className="h-9 bg-background text-sm">
	                                <SelectValue placeholder="Select customer" />
	                              </SelectTrigger>
	                              <SelectContent>
                                {customers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </SelectItem>
	                                ))}
	                              </SelectContent>
	                            </Select>
	                              <Button
	                                type="button"
	                                variant="outline"
	                                className="h-9 shrink-0 gap-1.5 px-3 text-xs"
	                                onClick={() => setShowQuickCustomer(true)}
	                              >
	                                <Plus size={14} weight="bold" />
	                                New
	                              </Button>
	                            </div>
	                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="invoiceNo" className="text-xs font-medium">Invoice Number <span className="text-destructive">*</span></Label>
                            <Input
                              id="invoiceNo"
                              name="invoiceNo"
                              placeholder="SI-001"
                              className="h-9 bg-background text-sm"
                              defaultValue={editingInvoice?.invoiceNo}
                              required
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="invoiceDate" className="text-xs font-medium">Invoice Date <span className="text-destructive">*</span></Label>
                            <Input
                              id="invoiceDate"
                              name="invoiceDate"
                              type="date"
                              className="h-9 bg-background text-sm"
                              defaultValue={editingInvoice?.invoiceDate}
                              min={minDate}
                              max={maxDate}
                              required
                            />
                            <p className="text-[10px] text-muted-foreground">Must be within {currentFY}</p>
                          </div>
                        </div>
                      </div>

                        <div id="sales-invoice-items" className="space-y-2.5">
	                        <div className="erp-section-toolbar">
	                          <h3 className="erp-section-title">
	                            Invoice Items <span className="text-destructive">*</span>
	                          </h3>
	                          <div className="erp-toolbar-actions">
	                            <Button 
	                              type="button" 
	                              size="sm" 
	                              variant="outline"
	                              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs px-3"
	                              onClick={() => setItemPickerOpen(true)}
	                            >
	                              <Plus size={14} weight="bold" />
	                              Add Item
	                            </Button>
	                            <Button 
	                              type="button" 
	                              size="sm" 
	                              variant="outline"
	                              className="h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary text-xs px-3"
	                              onClick={() => setShowQuickItem(true)}
	                            >
	                              <Plus size={14} weight="bold" />
	                              New Item
	                            </Button>
	                          </div>
	                        </div>

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
                                  <TableHead className="font-semibold text-foreground text-xs w-[34%] px-2">
                                    Item <span className="text-destructive">*</span>
                                  </TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs w-[18%] px-2">
                                    Qty (MT) <span className="text-destructive">*</span>
                                  </TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs w-[18%] px-2">
                                    Rate <span className="text-destructive">*</span>
                                  </TableHead>
                                  <TableHead className="font-semibold text-foreground text-xs w-[22%] px-2">Amount</TableHead>
                                  <TableHead className="w-[8%] px-1"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {invoiceItems.map((item, index) => (
                                  <TableRow key={index} className="hover:bg-muted/30">
                                    <TableCell className="px-2 py-2">
                                      <Select 
                                        value={item.itemId}
                                        onValueChange={(value) => updateInvoiceItem(index, 'itemId', value)}
                                      >
                                        <SelectTrigger className="h-8 w-full border-border/60 text-xs">
                                          <SelectValue placeholder="Select an item" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {items.map((itm) => (
                                            <SelectItem key={itm.id} value={itm.id}>
                                              {itm.name} ({itm.unit})
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
                                        value={item.quantityMT || ''}
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
                                        value={item.rate || ''}
                                        onChange={(e) => updateInvoiceItem(index, 'rate', e.target.value)}
                                        placeholder="0"
                                        className="h-8 font-mono text-right border-border/60 text-xs px-2"
                                      />
                                    </TableCell>

                                    <TableCell className="px-2 py-2">
                                      <Input 
                                        type="text"
                                        value={formatCurrency(item.amount)}
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
                          <div className="erp-total-panel">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Total Quantity:</span>
                                <span className="font-mono font-semibold text-foreground">{formatMT(invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0))}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground font-medium">Total Invoice Amount:</span>
                                <span className="font-mono font-bold text-base text-primary">{formatCurrency(invoiceItems.reduce((sum, item) => sum + item.amount, 0))}</span>
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

            <Dialog open={showQuickCustomer} onOpenChange={setShowQuickCustomer}>
              <DialogContent className="max-w-[min(640px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
                <DialogHeader className="border-b border-border px-6 py-5">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <UserPlus size={22} className="text-primary" weight="duotone" />
                    Create New Party
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="quickCustomerName">Party Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="quickCustomerName"
                      value={quickCustomerName}
                      onChange={(event) => setQuickCustomerName(event.target.value)}
                      placeholder="Enter name"
                      className="h-11"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quickCustomerPhone">Mobile Number</Label>
                      <Input
                        id="quickCustomerPhone"
                        value={quickCustomerPhone}
                        onChange={(event) => setQuickCustomerPhone(event.target.value)}
                        placeholder="Enter Mobile Number"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quickCustomerEmail">Email</Label>
                      <Input
                        id="quickCustomerEmail"
                        type="email"
                        value={quickCustomerEmail}
                        onChange={(event) => setQuickCustomerEmail(event.target.value)}
                        placeholder="Enter Email"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="font-semibold">Address (Optional)</div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
                        setQuickCustomerAddress('')
                        setQuickCustomerState('')
                        setQuickCustomerPincode('')
                        setQuickCustomerCity('')
                      }}>
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-4 p-4">
                      <div className="space-y-2">
                        <Label htmlFor="quickCustomerAddress" className="text-xs uppercase text-muted-foreground">
                          Billing Address
                        </Label>
                        <Textarea
                          id="quickCustomerAddress"
                          value={quickCustomerAddress}
                          onChange={(event) => setQuickCustomerAddress(event.target.value)}
                          placeholder="Enter billing address"
                          rows={3}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="quickCustomerState" className="text-xs uppercase text-muted-foreground">State</Label>
                          <Input
                            id="quickCustomerState"
                            value={quickCustomerState}
                            onChange={(event) => setQuickCustomerState(event.target.value)}
                            placeholder="Enter State"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="quickCustomerPincode" className="text-xs uppercase text-muted-foreground">Pincode</Label>
                          <Input
                            id="quickCustomerPincode"
                            value={quickCustomerPincode}
                            onChange={(event) => setQuickCustomerPincode(event.target.value)}
                            placeholder="Enter Pincode"
                            className="h-10"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickCustomerCity" className="text-xs uppercase text-muted-foreground">City</Label>
                        <Input
                          id="quickCustomerCity"
                          value={quickCustomerCity}
                          onChange={(event) => setQuickCustomerCity(event.target.value)}
                          placeholder="Enter City"
                          className="h-10"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <input type="checkbox" checked readOnly className="h-4 w-4 accent-primary" />
                        Shipping address same as billing address
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="font-semibold">GSTIN (Optional)</div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setQuickCustomerGstin('')}>
                        Remove
                      </Button>
                    </div>
                    <div className="space-y-2 p-4">
                      <Label htmlFor="quickCustomerGstin" className="text-xs uppercase text-muted-foreground">GSTIN</Label>
                      <Input
                        id="quickCustomerGstin"
                        value={quickCustomerGstin}
                        onChange={(event) => setQuickCustomerGstin(event.target.value.toUpperCase())}
                        placeholder="ex: 29XXXXX9438X1XX"
                        className="h-10"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="mb-3 font-semibold">Accounting Details</div>
                    <div className="space-y-2">
                      <Label htmlFor="quickCustomerOpeningBalance">Opening Balance (₹)</Label>
                      <Input
                        id="quickCustomerOpeningBalance"
                        type="number"
                        step="0.01"
                        value={quickCustomerOpeningBalance}
                        onChange={(event) => setQuickCustomerOpeningBalance(event.target.value)}
                        placeholder="0.00"
                        className="h-10 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setShowQuickCustomer(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleQuickCustomerCreate} disabled={!quickCustomerName.trim()}>
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={itemPickerOpen} onOpenChange={setItemPickerOpen}>
              <DialogContent className="max-w-[min(1120px,calc(100vw-2rem))] max-h-[82dvh] p-0">
                <DialogHeader className="border-b border-border px-6 py-5">
                  <DialogTitle className="text-xl">Add Items to Bill</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 px-6 py-5">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                    <div className="relative">
                      <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={itemSearch}
                        onChange={(event) => setItemSearch(event.target.value)}
                        placeholder="Search by Item/ Serial no./ HSN code/ SKU/ Custom Field / Category"
                        className="h-11 pl-10 pr-10"
                      />
                      <Barcode size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <Select value={selectedItemCategory} onValueChange={setSelectedItemCategory}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {[...new Set(items.map(item => item.category).filter(Boolean))].map(category => (
                          <SelectItem key={category} value={category!}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" className="h-11" onClick={() => setShowQuickItem(true)}>
                      Create New Item
                    </Button>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="max-h-[420px] overflow-y-auto">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted">
                          <TableRow>
                            <TableHead className="w-[34%]">Item Name</TableHead>
                            <TableHead>Item Code</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead className="text-right">Sales Price</TableHead>
                            <TableHead className="text-right">Purchase Price</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPickerItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="h-72 text-center text-muted-foreground">
                                No items found
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredPickerItems.map(item => (
                              <TableRow
                                key={item.id}
                                className={selectedPickerItemId === item.id ? 'bg-primary/10' : 'cursor-pointer'}
                                onClick={() => setSelectedPickerItemId(item.id)}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      checked={selectedPickerItemId === item.id}
                                      onChange={() => setSelectedPickerItemId(item.id)}
                                      className="h-4 w-4 accent-primary"
                                    />
                                    <span>{item.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{item.itemCode || '-'}</TableCell>
                                <TableCell className="text-right font-mono">{item.openingStock ?? 0}</TableCell>
                                <TableCell className="text-right font-mono">{item.salesPrice ? formatCurrency(item.salesPrice) : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{item.purchasePrice ? formatCurrency(item.purchasePrice) : '-'}</TableCell>
                                <TableCell className="text-right font-mono">0</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border px-6 py-4">
                  <div className="text-sm text-primary">
                    Show {selectedPickerItemId ? 1 : 0} Item(s) Selected
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => {
                      setItemPickerOpen(false)
                      setSelectedPickerItemId('')
                      setItemSearch('')
                      setSelectedItemCategory('all')
                    }}>
                      Cancel [ESC]
                    </Button>
                    <Button type="button" onClick={handleAddSelectedItemToBill} disabled={!selectedPickerItemId}>
                      Add to Bill [F7]
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showQuickItem} onOpenChange={setShowQuickItem}>
              <DialogContent className="max-w-[min(720px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
                <DialogHeader className="border-b border-border px-6 py-5">
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Package size={22} className="text-primary" weight="duotone" />
                    Create New Item
                  </DialogTitle>
                </DialogHeader>

                <div className="border-b border-border p-6">
                  <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                    Basic Details *
                  </div>
                  <div className="rounded-xl border border-border p-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="quickItemCategory">Category</Label>
                        <Input
                          id="quickItemCategory"
                          value={quickItemCategory}
                          onChange={(event) => setQuickItemCategory(event.target.value)}
                          placeholder="Search Categories"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemName">Item Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="quickItemName"
                          value={quickItemName}
                          onChange={(event) => setQuickItemName(event.target.value)}
                          placeholder="ex: Maggi 20gm"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemGstRate">GST Tax Rate(%)</Label>
                        <Input
                          id="quickItemGstRate"
                          type="number"
                          step="0.01"
                          value={quickItemGstRate}
                          onChange={(event) => setQuickItemGstRate(event.target.value)}
                          placeholder="None"
                          className="h-11 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemPurchasePrice">Purchase Price</Label>
                        <Input
                          id="quickItemPurchasePrice"
                          type="number"
                          step="0.01"
                          value={quickItemPurchasePrice}
                          onChange={(event) => setQuickItemPurchasePrice(event.target.value)}
                          placeholder="ex: ₹200"
                          className="h-11 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemSalesPrice">Sales Price</Label>
                        <Input
                          id="quickItemSalesPrice"
                          type="number"
                          step="0.01"
                          value={quickItemSalesPrice}
                          onChange={(event) => setQuickItemSalesPrice(event.target.value)}
                          placeholder="ex: ₹250"
                          className="h-11 font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemUnit">Measuring Unit</Label>
                        <Select value={quickItemUnit} onValueChange={(value) => setQuickItemUnit(value as Item['unit'])}>
                          <SelectTrigger id="quickItemUnit" className="h-11">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PCS">Pieces(PCS)</SelectItem>
                            <SelectItem value="MT">Metric Ton(MT)</SelectItem>
                            <SelectItem value="KG">Kilogram(KG)</SelectItem>
                            <SelectItem value="TON">Ton(TON)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quickItemOpeningStock">Opening Stock</Label>
                        <Input
                          id="quickItemOpeningStock"
                          type="number"
                          step="0.001"
                          value={quickItemOpeningStock}
                          onChange={(event) => setQuickItemOpeningStock(event.target.value)}
                          placeholder={`ex: 150 ${quickItemUnit}`}
                          className="h-11 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setShowQuickItem(false)}>
                    Cancel
                  </Button>
                  <Button type="button" disabled={!quickItemName.trim()} onClick={handleQuickItemCreate}>
                    Save Item
                  </Button>
                </div>
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
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            </Badge>
          </div>

	          <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Invoice No</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Items</TableHead>
                    <TableHead className="font-semibold text-right">Quantity (MT)</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fyInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No sales invoices found for FY {currentFY}. Add your first invoice to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono font-medium">{invoice.invoiceNo}</TableCell>
                        <TableCell>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell className="font-medium">{getCustomerName(invoice.customerId)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {(invoice.items || []).map((item, idx) => (
                              <div key={idx} className="text-muted-foreground">
                                {getItemName(item.itemId)}: {formatMT(item.quantityMT)} @ {formatCurrency(item.rate)}/MT
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatMT(invoice.quantityMT)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(invoice.invoiceAmount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewInvoice(invoice)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              aria-label={`Preview invoice ${invoice.invoiceNo}`}
                            >
                              <Receipt size={16} weight="bold" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadInvoicePDF(invoice)}
                              className="h-8 gap-1.5 px-2 text-xs"
                              aria-label={`Download invoice ${invoice.invoiceNo} PDF`}
                              title="Download PDF"
                            >
                              <DownloadSimple size={14} weight="bold" />
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(invoice)}
                              className="text-primary hover:text-primary hover:bg-primary/10"
                              aria-label={`Edit invoice ${invoice.invoiceNo}`}
                            >
                              <PencilSimple size={16} weight="bold" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(invoice)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              aria-label={`Delete invoice ${invoice.invoiceNo}`}
                            >
                              <Trash size={16} weight="bold" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
	          </div>
        </CardContent>
      </Card>

      {previewInvoice && (
        <InvoicePreviewDialog
          open={Boolean(previewInvoice)}
          onOpenChange={(open) => !open && setPreviewInvoice(null)}
          mode="sales"
          invoiceNo={previewInvoice.invoiceNo}
          invoiceDate={previewInvoice.invoiceDate}
          partyName={customerMap.get(previewInvoice.customerId)?.name || 'Unknown customer'}
          partyAddress={customerMap.get(previewInvoice.customerId)?.address}
          partyPhone={customerMap.get(previewInvoice.customerId)?.phone}
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
              Delete Sales Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete sales invoice <strong>{invoiceToDelete?.invoiceNo}</strong> for <strong>{getCustomerName(invoiceToDelete?.customerId || '')}</strong>? 
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
