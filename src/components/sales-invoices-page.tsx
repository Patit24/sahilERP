import { useState, useMemo } from 'react'
import { SalesInvoice, Customer, Item, InvoiceItem, CustomerPayment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple, MagnifyingGlass, Barcode, Package, UserPlus, GearSix, Keyboard } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog'
import { exportSalesInvoicePDF } from '@/lib/pdf-export'
import { PartyEditorDialog } from '@/components/party-editor-dialog'
import { ItemEditorDialog } from '@/components/item-editor-dialog'

interface SalesInvoicesPageProps {
  salesInvoices: SalesInvoice[]
  setSalesInvoices: (updater: (prev: SalesInvoice[]) => SalesInvoice[]) => void
  customers: Customer[]
  setCustomers: (updater: (prev: Customer[]) => Customer[]) => void
  customerPayments: CustomerPayment[]
  setCustomerPayments: (updater: (prev: CustomerPayment[]) => CustomerPayment[]) => void
  items: Item[]
  setItems: (updater: (prev: Item[]) => Item[]) => void
  currentFY: string
  isLocked?: boolean
}

export default function SalesInvoicesPage({ salesInvoices, setSalesInvoices, customers, setCustomers, customerPayments, setCustomerPayments, items, setItems, currentFY, isLocked = false }: SalesInvoicesPageProps) {
  const [open, setOpen] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [additionalCostBasicRate, setAdditionalCostBasicRate] = useState<number>(0)
  const [additionalCostFinal, setAdditionalCostFinal] = useState<number>(0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [amountReceived, setAmountReceived] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [showQuickCustomer, setShowQuickCustomer] = useState(false)
  const [showQuickItem, setShowQuickItem] = useState(false)
  const [itemPickerOpen, setItemPickerOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemCategory, setSelectedItemCategory] = useState('all')
  const [selectedPickerItemId, setSelectedPickerItemId] = useState('')
  
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
  const gstPercentage = 18

  const getInvoicePaymentId = (invoiceId: string) => `sales-invoice-payment-${invoiceId}`

  const syncInvoicePayment = (invoiceId: string, customerId: string, invoiceNo: string, invoiceDate: string, rawAmount: number, mode: string) => {
    const receivedAmount = Math.max(0, rawAmount || 0)

    setCustomerPayments((prev) => {
      const paymentId = getInvoicePaymentId(invoiceId)

      if (receivedAmount <= 0) {
        return prev.filter((payment) => payment.id !== paymentId)
      }

      const payment: CustomerPayment = {
        id: paymentId,
        customerId,
        paymentDate: invoiceDate,
        amount: receivedAmount,
        notes: `Auto-created from sales invoice ${invoiceNo}`,
        counterId: mode.toLowerCase().replace(/\s+/g, '-'),
        counterName: mode || 'Cash',
        fy: currentFY
      }

      const exists = prev.some((candidate) => candidate.id === paymentId)
      if (!exists) return [...prev, payment]

      return prev.map((candidate) => candidate.id === paymentId ? { ...candidate, ...payment } : candidate)
    })

    if (receivedAmount > 0) {
      toast.success(`Receipt linked to invoice ${invoiceNo}`)
    }
  }

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

  const handleAdditionalCostBasicRateChange = (value: string) => {
    const basicRate = parseFloat(value) || 0
    setAdditionalCostBasicRate(basicRate)
    setAdditionalCostFinal(basicRate > 0 ? parseFloat((basicRate * (1 + gstPercentage / 100)).toFixed(2)) : 0)
  }

  const handleAdditionalCostFinalChange = (value: string) => {
    setAdditionalCostFinal(parseFloat(value) || 0)
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
    const additionalCostBasicRate = parseFloat(formData.get('additionalCostBasicRate') as string) || 0
    const additionalCost = additionalCostBasicRate > 0
      ? parseFloat((additionalCostBasicRate * (1 + gstPercentage / 100)).toFixed(2))
      : parseFloat(formData.get('additionalCost') as string) || 0
    const additionalCostRemarks = (formData.get('additionalCostRemarks') as string) || ''
    const roundOffAdjustment = parseFloat(formData.get('roundOffAdjustment') as string) || 0
    const finalInvoiceAmount = parseFloat((totalAmt + additionalCost + roundOffAdjustment).toFixed(2))
    const rawAmountReceived = parseFloat(formData.get('amountReceived') as string) || 0
    const receivedAmount = Math.min(Math.max(rawAmountReceived, 0), finalInvoiceAmount)
    const selectedPaymentMode = (formData.get('paymentMode') as string) || 'Cash'
    const invoiceNo = formData.get('invoiceNo') as string

    if (editingInvoice) {
      const updatedInvoice: SalesInvoice = {
        ...editingInvoice,
        customerId,
        invoiceNo,
        invoiceDate: formData.get('invoiceDate') as string,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: finalInvoiceAmount,
        additionalCost,
        additionalCostBasicRate: additionalCostBasicRate || undefined,
        additionalCostRemarks: additionalCostRemarks || undefined,
        roundOffAdjustment: roundOffAdjustment || undefined,
      }
      setSalesInvoices((prev) => prev.map(inv => inv.id === editingInvoice.id ? updatedInvoice : inv))
      syncInvoicePayment(editingInvoice.id, customerId, invoiceNo, invoiceDate, receivedAmount, selectedPaymentMode)
    } else {
      const invoiceId = `sales-invoice-${Date.now()}`
      const invoice: SalesInvoice = {
        id: invoiceId,
        customerId,
        invoiceNo,
        invoiceDate: formData.get('invoiceDate') as string,
        items: invoiceItems,
        quantityMT: totalQty,
        invoiceAmount: finalInvoiceAmount,
        additionalCost,
        additionalCostBasicRate: additionalCostBasicRate || undefined,
        additionalCostRemarks: additionalCostRemarks || undefined,
        roundOffAdjustment: roundOffAdjustment || undefined,
        fy: currentFY
      }
      setSalesInvoices((prev) => [...prev, invoice])
      syncInvoicePayment(invoiceId, customerId, invoiceNo, invoiceDate, receivedAmount, selectedPaymentMode)
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
    setAdditionalCostBasicRate(0)
    setAdditionalCostFinal(0)
    setRoundOffAdjustment(0)
    setAmountReceived('')
    setPaymentMode('Cash')
    setMarkAsFullyPaid(false)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !editingInvoice) {
      setSelectedCustomerId('')
      setShowQuickCustomer(customers.length === 0)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setInvoiceItems([{
        itemId: '',
        quantityMT: 0,
        rate: 0,
        amount: 0
      }])
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setRoundOffAdjustment(0)
      setAmountReceived('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
      setTimeout(() => {
        document.querySelector('.erp-invoice-body')?.scrollTo({ top: 0 })
      }, 0)
    } else if (!newOpen) {
      setInvoiceItems([])
      setEditingInvoice(null)
      setSelectedCustomerId('')
      setShowQuickCustomer(false)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setRoundOffAdjustment(0)
      setAmountReceived('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
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
    setAdditionalCostBasicRate(invoice.additionalCostBasicRate || 0)
    setAdditionalCostFinal(invoice.additionalCost || 0)
    setRoundOffAdjustment(invoice.roundOffAdjustment || 0)
    const linkedPayment = customerPayments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))
    setAmountReceived(linkedPayment ? String(linkedPayment.amount) : '')
    setPaymentMode(linkedPayment?.counterName || 'Cash')
    setMarkAsFullyPaid(Boolean(linkedPayment && Math.abs(linkedPayment.amount - invoice.invoiceAmount) < 0.01))
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
      setCustomerPayments((prev) => prev.filter((payment) => payment.id !== getInvoicePaymentId(invoiceToDelete.id)))
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
  const totalInvoiceQty = invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0)
  const totalInvoiceAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
  const finalInvoiceAmountPreview = parseFloat((totalInvoiceAmount + additionalCostFinal + roundOffAdjustment).toFixed(2))
  const receivedAmountPreview = Math.min(
    Math.max(markAsFullyPaid ? finalInvoiceAmountPreview : parseFloat(amountReceived) || 0, 0),
    finalInvoiceAmountPreview
  )
  const balanceAmountPreview = Math.max(finalInvoiceAmountPreview - receivedAmountPreview, 0)

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
      {!open && (
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
      )}

      <Card className={open ? 'border-0 bg-transparent shadow-none' : undefined}>
        <CardContent className={open ? 'p-0' : 'pt-6'}>
          <div className={open ? 'hidden' : 'flex items-center justify-between mb-4'}>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Receipt size={22} weight="duotone" className="text-primary" />
              Sales Invoice List
            </h3>
            {!open && (
              <Button onClick={handleAdd}>
                <Plus size={18} weight="bold" />
                Add Sales Invoice
              </Button>
            )}
          </div>

          {open ? (
            <div className="erp-invoice-page-shell">
              <form onSubmit={handleSubmit} className="erp-invoice-form erp-invoice-page-form">
                <div className="erp-invoice-page-header">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-full"
                      onClick={() => handleOpenChange(false)}
                      aria-label="Back to sales invoices"
                    >
                      <ArrowLeft size={24} />
                    </Button>
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold">
                        {editingInvoice ? 'Edit Sales Invoice' : 'Create Sales Invoice'}
                      </h2>
                      <p className="text-sm text-muted-foreground">Bill to customer and add invoice items</p>
                    </div>
                  </div>
                  <div className="erp-reference-actions">
                    <Button type="button" variant="ghost" size="icon" className="erp-keyboard-button" aria-label="Keyboard shortcuts">
                      <Keyboard size={20} weight="fill" />
                    </Button>
                    <Button type="button" variant="outline" className="erp-upload-button">
                      <Barcode size={18} weight="bold" />
                      Upload using Phone
                    </Button>
                    <Button type="button" variant="outline" className="erp-settings-button">
                      <GearSix size={22} weight="duotone" />
                      Settings
                    </Button>
                    <Button type="button" variant="outline" className="erp-save-new-button" disabled>
                      Save & New
                    </Button>
                    <Button type="submit" className="erp-save-button" disabled={invoiceItems.length === 0}>
                      {editingInvoice ? 'Update' : 'Save'}
                    </Button>
                  </div>
                </div>
                <div className="erp-invoice-body erp-invoice-page-body">
                      <div className="erp-form-panel">
                        <h3 className="erp-section-title">Bill To</h3>
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
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <div className="erp-section-toolbar">
                                <h3 className="erp-section-title">Additional Cost (Optional)</h3>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  GST: {gstPercentage}% • Final = Basic × {(1 + gstPercentage / 100).toFixed(2)}
                                </span>
                              </div>

                              <div className="erp-table-panel">
                                <Table>
                                  <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-muted/50">
                                      <TableHead className="font-semibold text-foreground text-xs w-[25%] px-2">Remarks / Note</TableHead>
                                      <TableHead className="font-semibold text-foreground text-xs w-[20%] px-2">Basic Rate</TableHead>
                                      <TableHead className="font-semibold text-foreground text-xs w-[20%] px-2">Final Cost</TableHead>
                                      <TableHead className="font-semibold text-foreground text-xs w-[35%] px-2">Description</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    <TableRow className="hover:bg-muted/30">
                                      <TableCell className="px-2 py-2">
                                        <Input
                                          id="salesAdditionalCostRemarks"
                                          name="additionalCostRemarks"
                                          type="text"
                                          defaultValue={editingInvoice?.additionalCostRemarks || ''}
                                          placeholder="e.g., Freight, Handling"
                                          className="h-8 bg-background text-xs px-2"
                                        />
                                      </TableCell>
                                      <TableCell className="px-2 py-2">
                                        <Input
                                          id="salesAdditionalCostBasicRate"
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
                                          id="salesAdditionalCost"
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
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground">Additional Cost:</span>
                                      <span className="font-mono font-semibold text-foreground">{formatCurrency(additionalCostFinal)}</span>
                                    </div>
                                  </div>
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

                            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                              <input type="hidden" name="amountReceived" value={markAsFullyPaid ? finalInvoiceAmountPreview : amountReceived} />
                              <input type="hidden" name="paymentMode" value={paymentMode} />

                              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <h3 className="text-sm font-semibold text-foreground">Payment Settlement</h3>
                                      <p className="text-xs text-muted-foreground">Record amount received while saving this sales invoice.</p>
                                    </div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                                      <Checkbox
                                        checked={markAsFullyPaid}
                                        onCheckedChange={(checked) => setMarkAsFullyPaid(Boolean(checked))}
                                      />
                                      Mark as fully paid
                                    </label>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                                    <div className="space-y-1.5">
                                      <Label htmlFor="salesAmountReceived">Amount Received</Label>
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                        <Input
                                          id="salesAmountReceived"
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max={finalInvoiceAmountPreview || undefined}
                                          value={markAsFullyPaid ? finalInvoiceAmountPreview || '' : amountReceived}
                                          onChange={(event) => setAmountReceived(event.target.value)}
                                          disabled={markAsFullyPaid}
                                          placeholder="0.00"
                                          className="h-11 pl-8 font-mono text-right"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label>Mode</Label>
                                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                                        <SelectTrigger className="h-11">
                                          <SelectValue placeholder="Cash" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="Cash">Cash</SelectItem>
                                          <SelectItem value="Bank">Bank</SelectItem>
                                          <SelectItem value="UPI">UPI</SelectItem>
                                          <SelectItem value="Cheque">Cheque</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl bg-muted/40 p-3">
                                  <div className="flex items-center justify-between border-b border-border/70 py-2 text-sm">
                                    <span className="text-muted-foreground">Total Amount</span>
                                    <span className="font-mono font-semibold">{formatCurrency(finalInvoiceAmountPreview)}</span>
                                  </div>
                                  <div className="flex items-center justify-between border-b border-border/70 py-2 text-sm">
                                    <span className="text-muted-foreground">Amount Received</span>
                                    <span className="font-mono font-semibold text-primary">{formatCurrency(receivedAmountPreview)}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-2 text-sm">
                                    <span className="font-semibold text-emerald-600">Balance Amount</span>
                                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(balanceAmountPreview)}</span>
                                  </div>
                                </div>
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
            </div>
          ) : null}

            <PartyEditorDialog
              open={showQuickCustomer}
              onOpenChange={setShowQuickCustomer}
              type="customer"
              existingParties={customers}
              onSave={(party) => {
                const customer = party as Customer
                setCustomers((prev) => [...prev, customer])
                setSelectedCustomerId(customer.id)
                setShowQuickCustomer(false)
                toast.success(`Customer "${customer.name}" created`)
              }}
            />

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

            <ItemEditorDialog
              open={showQuickItem}
              onOpenChange={setShowQuickItem}
              existingItems={items}
              onSave={(item) => {
                const rate = item.salesPrice || item.purchasePrice || 0
                setItems((prev) => [...prev, item])
                setInvoiceItems((prev) => {
                  const row = { itemId: item.id, quantityMT: 0, rate, amount: 0 }
                  const emptyIndex = prev.findIndex((existing) => !existing.itemId)
                  if (emptyIndex === -1) return [...prev, row]
                  return prev.map((existing, index) => index === emptyIndex ? row : existing)
                })
                setSelectedPickerItemId(item.id)
                setShowQuickItem(false)
                toast.success(`Item "${item.name}" created`)
              }}
            />
          {!open && (
            <>
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
            </>
          )}
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
