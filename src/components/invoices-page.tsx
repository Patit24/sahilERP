import { useState, useMemo } from 'react'
import { PurchaseInvoice, Supplier, Item, InvoiceItem, Payment } from '@/lib/types'
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
import { ArrowLeft, Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple, MagnifyingGlass, Barcode, Package, UserPlus, GearSix, Keyboard, UploadSimple } from '@phosphor-icons/react'
import { formatCurrency, formatMT, getFYMonths, getFYDateRange, formatDateForInput, isDateInFY } from '@/lib/calculations'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog'
import { exportPurchaseInvoicePDF } from '@/lib/pdf-export'
import { PartyEditorDialog } from '@/components/party-editor-dialog'
import { ItemEditorDialog } from '@/components/item-editor-dialog'

interface InvoicesPageProps {
  invoices: PurchaseInvoice[]
  setInvoices: (updater: (prev: PurchaseInvoice[]) => PurchaseInvoice[]) => void
  suppliers: Supplier[]
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void
  payments: Payment[]
  setPayments: (updater: (prev: Payment[]) => Payment[]) => void
  items: Item[]
  setItems: (updater: (prev: Item[]) => Item[]) => void
  currentFY: string
  isLocked?: boolean
  gstPercentage?: number
}

const DEFAULT_INVOICE_TERMS = '1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to [ENTER_YOUR_CITY_NAME] jurisdiction only'

export default function InvoicesPage({ invoices, setInvoices, suppliers, setSuppliers, payments, setPayments, items, setItems, currentFY, isLocked = false, gstPercentage = 18 }: InvoicesPageProps) {
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
  const [additionalCostTaxMode, setAdditionalCostTaxMode] = useState<'none' | 'gst'>('none')
  const [additionalCostGstRate, setAdditionalCostGstRate] = useState<number>(gstPercentage)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [showQuickItem, setShowQuickItem] = useState(false)
  const [itemPickerOpen, setItemPickerOpen] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [selectedItemCategory, setSelectedItemCategory] = useState('all')
  const [selectedPickerItemId, setSelectedPickerItemId] = useState('')
  const [pickerQuantities, setPickerQuantities] = useState<Record<string, number>>({})
  const [showAdditionalCharge, setShowAdditionalCharge] = useState(false)
  const [showInvoiceNotes, setShowInvoiceNotes] = useState(false)
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [showInvoiceTerms, setShowInvoiceTerms] = useState(false)
  const [invoiceTerms, setInvoiceTerms] = useState('')
  
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

  const getInvoicePaymentId = (invoiceId: string) => `purchase-invoice-payment-${invoiceId}`

  const syncInvoicePayment = (invoiceId: string, supplierId: string, invoiceNo: string, invoiceDate: string, rawAmount: number, mode: string) => {
    const paidAmount = Math.max(0, rawAmount || 0)

    setPayments((prev) => {
      const paymentId = getInvoicePaymentId(invoiceId)

      if (paidAmount <= 0) {
        return prev.filter((payment) => payment.id !== paymentId)
      }

      const payment: Payment = {
        id: paymentId,
        supplierId,
        paymentDate: invoiceDate,
        amount: paidAmount,
        paymentMode: mode || 'Cash',
        isAdvance: false,
        doNotApplyCD: true,
        fy: currentFY,
        createdAt: Date.now()
      }

      const exists = prev.some((candidate) => candidate.id === paymentId)
      if (!exists) return [...prev, payment]

      return prev.map((candidate) => (
        candidate.id === paymentId
          ? {
              ...candidate,
              ...payment,
              createdAt: candidate.createdAt || payment.createdAt
            }
          : candidate
      ))
    })

    if (paidAmount > 0) {
      toast.success(`Payment linked to invoice ${invoiceNo}`)
    }
  }

  const getInvoiceItemGstRate = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return typeof item?.gstRate === 'number' && !Number.isNaN(item.gstRate)
      ? item.gstRate
      : gstPercentage
  }

  const calculateRateWithItemGst = (basicRate: number, itemId: string) => (
    basicRate > 0 ? parseFloat((basicRate * (1 + getInvoiceItemGstRate(itemId) / 100)).toFixed(2)) : 0
  )

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
    setSelectedPickerItemId('')
    setItemSearch('')
    setSelectedItemCategory('all')
    setPickerQuantities({})
  }

  const addInvoiceItemWithItem = (itemId: string, quantityMT = 0) => {
    const item = items.find((candidate) => candidate.id === itemId)
    const basicRate = item?.purchasePrice || 0
    const rate = calculateRateWithItemGst(basicRate, itemId)
    const row = {
      itemId,
      quantityMT,
      basicRate,
      rate,
      amount: parseFloat((quantityMT * rate).toFixed(2))
    }

    setInvoiceItems(prev => {
      const emptyIndex = prev.findIndex(existing => !existing.itemId)
      if (emptyIndex === -1) return [...prev, row]
      return prev.map((existing, index) => index === emptyIndex ? row : existing)
    })
  }

  const handleAddSelectedItemToBill = () => {
    const selectedEntries = Object.entries(pickerQuantities).filter(([, quantity]) => quantity > 0)
    if (selectedEntries.length === 0) {
      toast.error('Please add quantity for an item first')
      return
    }

    selectedEntries.forEach(([itemId, quantity]) => addInvoiceItemWithItem(itemId, quantity))
    setItemPickerOpen(false)
    resetItemPicker()
  }

  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index] }
      
      if (field === 'itemId') {
        item.itemId = value as string
        const selectedItem = items.find((candidate) => candidate.id === item.itemId)
        const basicRate = item.basicRate && item.basicRate > 0 ? item.basicRate : selectedItem?.purchasePrice || 0
        item.basicRate = basicRate
        item.rate = calculateRateWithItemGst(basicRate, item.itemId)
        item.amount = parseFloat((item.quantityMT * item.rate).toFixed(2))
      } else if (field === 'quantityMT') {
        item.quantityMT = parseFloat(value as string) || 0
        item.amount = parseFloat((item.quantityMT * item.rate).toFixed(2))
      } else if (field === 'basicRate') {
        const basicRate = parseFloat(value as string) || 0
        item.basicRate = basicRate
        item.rate = calculateRateWithItemGst(basicRate, item.itemId)
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
    const finalCost = additionalCostTaxMode === 'gst'
      ? parseFloat((basicRate * (1 + additionalCostGstRate / 100)).toFixed(2))
      : basicRate
    setAdditionalCostFinal(finalCost)
  }

  const handleAdditionalCostTaxModeChange = (value: 'none' | 'gst') => {
    setAdditionalCostTaxMode(value)
    const finalCost = value === 'gst'
      ? parseFloat((additionalCostBasicRate * (1 + additionalCostGstRate / 100)).toFixed(2))
      : additionalCostBasicRate
    setAdditionalCostFinal(finalCost)
  }

  const handleAdditionalCostGstRateChange = (value: string) => {
    const rate = parseFloat(value) || 0
    setAdditionalCostGstRate(rate)
    if (additionalCostTaxMode === 'gst') {
      setAdditionalCostFinal(parseFloat((additionalCostBasicRate * (1 + rate / 100)).toFixed(2)))
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

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a signature image')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSignatureDataUrl(typeof reader.result === 'string' ? reader.result : '')
      toast.success('Signature added to invoice')
    }
    reader.onerror = () => toast.error('Could not read signature image')
    reader.readAsDataURL(file)
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
    const additionalCost = parseFloat(formData.get('additionalCost') as string) || 0
    const additionalCostRemarks = (formData.get('additionalCostRemarks') as string) || ''
    const roundOffAdjustment = parseFloat(formData.get('roundOffAdjustment') as string) || 0
    const finalInvoiceAmount = parseFloat((totalAmt + additionalCost + roundOffAdjustment).toFixed(2))
    const rawAmountPaid = parseFloat(formData.get('amountPaid') as string) || 0
    const paymentAmount = Math.min(Math.max(rawAmountPaid, 0), finalInvoiceAmount)
    const selectedPaymentMode = (formData.get('paymentMode') as string) || 'Cash'

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
        signatureDataUrl: signatureDataUrl || undefined,
      }
      setInvoices((prev) => prev.map(inv => inv.id === editingInvoice.id ? updated : inv))
      syncInvoicePayment(editingInvoice.id, supplierId, invoiceNo, invoiceDate, paymentAmount, selectedPaymentMode)
      toast.success('Invoice updated successfully')
    } else {
      const invoiceId = `invoice-${Date.now()}`
      const invoice: PurchaseInvoice = {
        id: invoiceId,
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
        signatureDataUrl: signatureDataUrl || undefined,
        fy: currentFY,
        createdAt: Date.now()
      }
      setInvoices((prev) => [...prev, invoice])
      syncInvoicePayment(invoiceId, supplierId, invoiceNo, invoiceDate, paymentAmount, selectedPaymentMode)
      toast.success('Invoice added successfully')
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
    setSupplierPickerOpen(false)
    setSupplierSearch('')
    setAmountPaid('')
    setPaymentMode('Cash')
    setMarkAsFullyPaid(false)
    setSignatureDataUrl('')
    setShowAdditionalCharge(false)
    setShowInvoiceNotes(false)
    setInvoiceNotes('')
    setShowInvoiceTerms(false)
    setInvoiceTerms('')
    setAdditionalCostTaxMode('none')
    setAdditionalCostGstRate(gstPercentage)
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !editingInvoice) {
      setSelectedSupplierId('')
      setSupplierPickerOpen(false)
      setSupplierSearch('')
      setShowQuickSupplier(false)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setPickerQuantities({})
      setInvoiceItems([])
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setAdditionalCostTaxMode('none')
      setAdditionalCostGstRate(gstPercentage)
      setRoundOffAdjustment(0)
      setAmountPaid('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
      setSignatureDataUrl('')
      setShowAdditionalCharge(false)
      setShowInvoiceNotes(false)
      setInvoiceNotes('')
      setShowInvoiceTerms(false)
      setInvoiceTerms('')
      
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
      setSupplierPickerOpen(false)
      setSupplierSearch('')
      setShowQuickSupplier(false)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setPickerQuantities({})
      setAdditionalCostBasicRate(0)
      setAdditionalCostFinal(0)
      setAdditionalCostTaxMode('none')
      setAdditionalCostGstRate(gstPercentage)
      setRoundOffAdjustment(0)
      setAmountPaid('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
      setSignatureDataUrl('')
      setShowAdditionalCharge(false)
      setShowInvoiceNotes(false)
      setInvoiceNotes('')
      setShowInvoiceTerms(false)
      setInvoiceTerms('')
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
    setSupplierPickerOpen(false)
    setSupplierSearch('')
    setInvoiceItems(invoice.items || [])
    setAdditionalCostBasicRate(invoice.additionalCostBasicRate || 0)
    setAdditionalCostFinal(invoice.additionalCost || 0)
    setAdditionalCostTaxMode(invoice.additionalCostBasicRate && invoice.additionalCost && invoice.additionalCost > invoice.additionalCostBasicRate ? 'gst' : 'none')
    setAdditionalCostGstRate(gstPercentage)
    setShowAdditionalCharge(Boolean(invoice.additionalCost || invoice.additionalCostBasicRate || invoice.additionalCostRemarks))
    setRoundOffAdjustment(invoice.roundOffAdjustment || 0)
    const linkedPayment = payments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))
    setAmountPaid(linkedPayment ? String(linkedPayment.amount) : '')
    setPaymentMode(linkedPayment?.paymentMode || 'Cash')
    setMarkAsFullyPaid(Boolean(linkedPayment && Math.abs(linkedPayment.amount - invoice.invoiceAmount) < 0.01))
    setSignatureDataUrl(invoice.signatureDataUrl || '')
    setShowInvoiceNotes(false)
    setInvoiceNotes('')
    setShowInvoiceTerms(false)
    setInvoiceTerms('')
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
      setPayments((prev) => prev.filter((payment) => payment.id !== getInvoicePaymentId(invoiceToDelete.id)))
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

  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  const selectedInvoiceSupplier = selectedSupplierId ? supplierMap.get(selectedSupplierId) : undefined
  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = supplierSearch.trim().toLowerCase()
    if (!query) return true
    return [supplier.name, supplier.phone, supplier.gstin]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
  const itemMap = new Map(items.map(i => [i.id, i]))
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

  const totalInvoiceAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0)
  const totalInvoiceQty = invoiceItems.reduce((sum, item) => sum + item.quantityMT, 0)
  const finalInvoiceAmountPreview = parseFloat((totalInvoiceAmount + additionalCostFinal + roundOffAdjustment).toFixed(2))
  const paidAmountPreview = Math.min(
    Math.max(markAsFullyPaid ? finalInvoiceAmountPreview : parseFloat(amountPaid) || 0, 0),
    finalInvoiceAmountPreview
  )
  const balanceAmountPreview = Math.max(finalInvoiceAmountPreview - paidAmountPreview, 0)

  const fyDateRange = getFYDateRange(currentFY)
  const minDate = fyDateRange ? formatDateForInput(fyDateRange.startDate) : undefined
  const maxDate = fyDateRange ? formatDateForInput(fyDateRange.endDate) : undefined

  const handleDownloadInvoicePDF = (invoice: PurchaseInvoice) => {
    exportPurchaseInvoicePDF(invoice, supplierMap.get(invoice.supplierId), itemMap, {
      businessName: 'SK TRADERS',
      state: 'West Bengal',
      phone: '9083876218',
      signatureDataUrl: invoice.signatureDataUrl,
      paidAmount: payments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))?.amount || 0
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
        {!open && (
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-1.5" size={16} />
            Add Invoice
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
                  aria-label="Back to purchase invoices"
                >
                  <ArrowLeft size={24} />
                </Button>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold">
                    {editingInvoice ? 'Edit Purchase Invoice' : 'Create Purchase Invoice'}
                  </h2>
                  <p className="text-sm text-muted-foreground">Bill from supplier and add invoice items</p>
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
                  <h3 className="erp-section-title">Bill From</h3>
                  <div className="erp-responsive-grid">
                    <div className="erp-party-picker-field">
                      <input type="hidden" name="supplierId" value={selectedSupplierId} />
                      {!supplierPickerOpen && !selectedInvoiceSupplier ? (
                        <button
                          type="button"
                          className="erp-party-add-box"
                          onClick={() => setSupplierPickerOpen(true)}
                        >
                          <Plus size={18} weight="bold" />
                          Add Party
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
                              placeholder={selectedInvoiceSupplier ? selectedInvoiceSupplier.name : 'Search party by name or number'}
                              autoComplete="off"
                            />
                            <button
                              type="button"
                              aria-label="Toggle supplier list"
                              onClick={() => setSupplierPickerOpen((open) => !open)}
                            >
                              <span>⌄</span>
                            </button>
                          </div>

                          {supplierPickerOpen && (
                            <div className="erp-party-options">
                              <div className="erp-party-options-head">
                                <span>Party Name</span>
                                <span>Balance</span>
                              </div>
                              <button
                                type="button"
                                className="erp-party-option"
                                onClick={() => {
                                  setSelectedSupplierId('')
                                  setSupplierSearch('')
                                  setSupplierPickerOpen(false)
                                }}
                              >
                                <span>Cash Sale</span>
                                <span>{formatCurrency(0)}</span>
                              </button>
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
                              <button
                                type="button"
                                className="erp-party-create-option"
                                onClick={() => {
                                  setSupplierPickerOpen(false)
                                  setShowQuickSupplier(true)
                                }}
                              >
                                <Plus size={16} weight="bold" />
                                Create Party
                              </button>
                            </div>
                          )}
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
                    <span className="text-[10px] text-muted-foreground font-medium">
                      Rate uses item GST • fallback company GST: {gstPercentage}%
                    </span>
                  </div>

                  <div className="erp-reference-table-wrap">
                    {items.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground border-b border-border/50">
                        No item master found. Click <span className="font-semibold text-primary">Add Item</span>, then use Create New Item inside the list.
                      </div>
                    )}
                    <div className="erp-reference-item-table">
                      <div className="erp-reference-item-head">
                        <span>No</span>
                        <span>Items/ Services</span>
                        <span>HSN/ SAC</span>
                        <span>Qty</span>
                        <span>Price/Item (₹)</span>
                        <span>Discount</span>
                        <span>Tax</span>
                        <span>Amount (₹)</span>
                        <button type="button" className="erp-reference-row-plus" onClick={() => setItemPickerOpen(true)} aria-label="Add item">
                          <Plus size={22} weight="bold" />
                        </button>
                      </div>

                      {invoiceItems.map((invoiceItem, index) => (
                        <div className="erp-reference-item-row" key={index}>
                          <span className="erp-reference-row-number">{index + 1}</span>
                          <Select value={invoiceItem.itemId} onValueChange={(value) => updateInvoiceItem(index, 'itemId', value)}>
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
                            value={invoiceItem.quantityMT === 0 ? 0 : invoiceItem.quantityMT}
                            onChange={(e) => updateInvoiceItem(index, 'quantityMT', e.target.value)}
                            placeholder="0"
                            className="erp-reference-cell-input font-mono text-right"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={invoiceItem.basicRate === 0 ? 0 : invoiceItem.basicRate}
                            onChange={(e) => updateInvoiceItem(index, 'basicRate', e.target.value)}
                            placeholder="0"
                            className="erp-reference-cell-input font-mono text-right"
                          />
                          <Input value="-" disabled className="erp-reference-cell-input text-center" />
                          <Input value={`GST @ ${getInvoiceItemGstRate(invoiceItem.itemId)}%`} disabled className="erp-reference-cell-input text-center" />
                          <Input value={formatCurrency(invoiceItem.amount)} disabled className="erp-reference-cell-input font-mono text-right" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="erp-reference-remove-row"
                            onClick={() => removeInvoiceItem(index)}
                            aria-label="Remove item"
                          >
                            <X size={16} weight="bold" />
                          </Button>
                        </div>
                      ))}

                      <div className="erp-reference-add-item-row">
                        <button type="button" className="erp-reference-add-item-dashed" onClick={() => setItemPickerOpen(true)}>
                          <Plus size={18} weight="bold" />
                          Add Item
                        </button>
                        <button type="button" className="erp-reference-scan-button" onClick={() => toast.info('Barcode scanner is not configured yet')}>
                          <Barcode size={30} weight="bold" />
                          <span>Scan Barcode</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="erp-invoice-reference-footer">
                    <div className="erp-invoice-footer-col flex flex-col gap-3">
<div className="erp-reference-notes-panel">
                      {!showInvoiceNotes ? (
                        <button type="button" className="erp-note-action" onClick={() => setShowInvoiceNotes(true)}>
                          + Add Notes
                        </button>
                      ) : (
                        <div className="erp-inline-editor">
                          <div className="erp-inline-editor-header">
                            <span>Notes</span>
                            <button type="button" onClick={() => { setShowInvoiceNotes(false); setInvoiceNotes('') }} aria-label="Remove notes">
                              <X size={16} weight="bold" />
                            </button>
                          </div>
                          <Textarea value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} placeholder="Enter invoice notes" />
                        </div>
                      )}
                      {!showInvoiceTerms ? (
                        <button
                          type="button"
                          className="erp-note-action"
                          onClick={() => {
                            setShowInvoiceTerms(true)
                            setInvoiceTerms((current) => current || DEFAULT_INVOICE_TERMS)
                          }}
                        >
                          + Add Terms and Conditions
                        </button>
                      ) : (
                        <div className="erp-inline-editor">
                          <div className="erp-inline-editor-header">
                            <span>Terms and Conditions</span>
                            <button type="button" onClick={() => { setShowInvoiceTerms(false); setInvoiceTerms('') }} aria-label="Remove terms and conditions">
                              <X size={16} weight="bold" />
                            </button>
                          </div>
                          <Textarea value={invoiceTerms} onChange={(event) => setInvoiceTerms(event.target.value)} />
                        </div>
                      )}
                    </div>
                    <div className="erp-signature-panel">
                        <div className="erp-signature-grid">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">Invoice Signature</h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Upload a signature image to show on this invoice PDF.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Label
                                htmlFor="purchaseInvoiceSignature"
                                className="erp-signature-upload-button"
                              >
                                <UploadSimple size={16} weight="bold" />
                                Upload Signature
                              </Label>
                              <Input
                                id="purchaseInvoiceSignature"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="sr-only"
                                onChange={handleSignatureUpload}
                              />
                              {signatureDataUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setSignatureDataUrl('')}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="erp-signature-preview">
                            {signatureDataUrl ? (
                              <img
                                src={signatureDataUrl}
                                alt="Invoice signature preview"
                                className="max-h-20 max-w-full object-contain"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">No signature uploaded</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
<div className="erp-payment-settlement-panel">
                        <input type="hidden" name="amountPaid" value={markAsFullyPaid ? finalInvoiceAmountPreview : amountPaid} />
                        <input type="hidden" name="paymentMode" value={paymentMode} />

                        <div className="erp-payment-settlement-grid">
                          <div className="space-y-3">
                            <div className="erp-payment-header-row">
                              <div>
                                <h3 className="text-sm font-semibold text-foreground">Payment Settlement</h3>
                                <p className="text-xs text-muted-foreground">Record amount paid while saving this purchase invoice.</p>
                              </div>
                              <label className="erp-paid-toggle">
                                <Checkbox
                                  checked={markAsFullyPaid}
                                  onCheckedChange={(checked) => setMarkAsFullyPaid(Boolean(checked))}
                                />
                                Mark as fully paid
                              </label>
                            </div>

                            <div className="erp-payment-fields-grid">
                              <div className="erp-payment-field">
                                <Label htmlFor="purchaseAmountPaid">Amount Paid</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                                  <Input
                                    id="purchaseAmountPaid"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={finalInvoiceAmountPreview || undefined}
                                    value={markAsFullyPaid ? finalInvoiceAmountPreview || '' : amountPaid}
                                    onChange={(event) => setAmountPaid(event.target.value)}
                                    disabled={markAsFullyPaid}
                                    placeholder="0.00"
                                    className="erp-payment-amount-input pl-8 font-mono text-right"
                                  />
                                </div>
                              </div>

                              <div className="erp-payment-field">
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

                          <div className="erp-payment-summary-card">
                            <div className="flex items-center justify-between border-b border-border/70 py-2 text-sm">
                              <span className="text-muted-foreground">Total Amount</span>
                              <span className="font-mono font-semibold">{formatCurrency(finalInvoiceAmountPreview)}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border/70 py-2 text-sm">
                              <span className="text-muted-foreground">Amount Paid</span>
                              <span className="font-mono font-semibold text-primary">{formatCurrency(paidAmountPreview)}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 text-sm">
                              <span className="font-semibold text-emerald-600">Balance Amount</span>
                              <span className="font-mono font-bold text-emerald-600">{formatCurrency(balanceAmountPreview)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="erp-reference-totals-panel">
                      <div className="space-y-2">
                        {!showAdditionalCharge ? (
                          <div className="erp-summary-link-row">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-primary"
                              onClick={() => setShowAdditionalCharge(true)}
                            >
                              + Add Additional Charges
                            </Button>
                            <span className="font-mono text-sm">{formatCurrency(additionalCostFinal)}</span>
                          </div>
                        ) : (
                          <div className="erp-additional-charge-panel">
                            <div className="erp-additional-charge-row">
                              <Input
                                id="additionalCostRemarks"
                                name="additionalCostRemarks"
                                type="text"
                                defaultValue={editingInvoice?.additionalCostRemarks || ''}
                                placeholder="Enter charge (ex. Transport Charge)"
                                className="h-10 bg-muted/70 text-sm"
                              />
                              <div className="erp-money-input">
                                <span>₹</span>
                                <Input
                                  id="additionalCostBasicRate"
                                  name="additionalCostBasicRate"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={additionalCostBasicRate === 0 ? 0 : additionalCostBasicRate}
                                  onChange={(e) => handleAdditionalCostBasicRateChange(e.target.value)}
                                  placeholder="0"
                                  className="h-10 border-0 bg-transparent text-right font-mono shadow-none focus-visible:ring-0"
                                />
                              </div>
                              <Select value={additionalCostTaxMode} onValueChange={(value) => handleAdditionalCostTaxModeChange(value as 'none' | 'gst')}>
                                <SelectTrigger className="h-10 bg-background">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Tax Applicable</SelectItem>
                                  <SelectItem value="gst">GST Applicable</SelectItem>
                                </SelectContent>
                              </Select>
                              {additionalCostTaxMode === 'gst' ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={additionalCostGstRate === 0 ? 0 : additionalCostGstRate}
                                  onChange={(e) => handleAdditionalCostGstRateChange(e.target.value)}
                                  placeholder="GST %"
                                  className="h-10 w-28 bg-background text-right font-mono"
                                />
                              ) : (
                                <div />
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => {
                                  setShowAdditionalCharge(false)
                                  setAdditionalCostBasicRate(0)
                                  setAdditionalCostFinal(0)
                                  setAdditionalCostTaxMode('none')
                                  setAdditionalCostGstRate(gstPercentage)
                                }}
                              >
                                <X size={18} weight="bold" />
                              </Button>
                              <input type="hidden" id="additionalCost" name="additionalCost" value={additionalCostFinal || ''} />
                            </div>
                          </div>
                        )}
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
                          <div className="flex items-center justify-between text-xs">
                            <Button type="button" variant="link" className="h-auto p-0 text-primary text-xs">
                              + Add Discount
                            </Button>
                            <span className="font-mono font-semibold text-foreground">- {formatCurrency(0)}</span>
                          </div>
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
                  </div>
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
          open={showQuickSupplier}
          onOpenChange={setShowQuickSupplier}
          type="supplier"
          existingParties={suppliers}
          onSave={(party) => {
            const supplier = party as Supplier
            setSuppliers((prev) => [...prev, supplier])
            setSelectedSupplierId(supplier.id)
            setShowQuickSupplier(false)
            toast.success(`Supplier "${supplier.name}" created`)
          }}
        />

        <Dialog
          open={itemPickerOpen}
          onOpenChange={(nextOpen) => {
            setItemPickerOpen(nextOpen)
            if (!nextOpen) resetItemPicker()
          }}
        >
          <DialogContent
            className="erp-item-picker-dialog max-h-[82dvh] p-0"
            style={{ width: 'min(1180px, calc(100vw - 2rem))', maxWidth: 'min(1180px, calc(100vw - 2rem))' }}
          >
            <DialogHeader className="erp-item-picker-header border-b border-border px-6 py-5">
              <DialogTitle className="erp-item-picker-title text-xl">Add Items to Bill</DialogTitle>
            </DialogHeader>

            <div className="erp-item-picker-body space-y-4 px-6 py-5">
              <div className="erp-item-picker-toolbar grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
                <div className="erp-item-picker-search relative">
                  <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                    placeholder="Search by Item/ Serial no./ HSN code/ SKU/ Custom Field / Category"
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
                <Button type="button" className="erp-item-picker-create h-11" onClick={() => setShowQuickItem(true)}>
                  Create New Item
                </Button>
              </div>

              <div className="erp-item-picker-table-card overflow-hidden rounded-xl border border-border">
                <div className="erp-item-picker-table-scroll max-h-[420px] overflow-y-auto">
                  <Table className="erp-item-picker-table">
                    <TableHeader className="erp-item-picker-table-head sticky top-0 z-10 bg-muted">
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
                              <TableCell className="text-right font-mono">{item.salesPrice ? formatCurrency(item.salesPrice) : '-'}</TableCell>
                              <TableCell className="text-right font-mono">{item.purchasePrice ? formatCurrency(item.purchasePrice) : '-'}</TableCell>
                              <TableCell className="text-right">
                                {isSelected ? (
                                  <div className="erp-picker-stepper">
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
                                      className="h-7 w-14 px-1 text-center font-mono"
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
                                    <span className="erp-picker-unit">{item.unit}</span>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 min-w-32 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                    onClick={() => {
                                      setSelectedPickerItemId(item.id)
                                      updatePickerQuantity(item.id, 1)
                                    }}
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
              <div className="erp-item-picker-selected-count text-sm text-primary">
                Show {Object.values(pickerQuantities).filter((quantity) => quantity > 0).length} Item(s) Selected
              </div>
              <div className="erp-item-picker-actions flex gap-3">
                <Button type="button" variant="outline" onClick={() => {
                  setItemPickerOpen(false)
                  resetItemPicker()
                }}>
                  Cancel [ESC]
                </Button>
                <Button type="button" onClick={handleAddSelectedItemToBill} disabled={Object.values(pickerQuantities).every((quantity) => quantity <= 0)}>
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
            setItems((prev) => [...prev, item])
            const basicRate = item.purchasePrice || 0
            const gstRate = typeof item.gstRate === 'number' && !Number.isNaN(item.gstRate) ? item.gstRate : gstPercentage
            const rate = basicRate > 0 ? parseFloat((basicRate * (1 + gstRate / 100)).toFixed(2)) : 0
            setInvoiceItems((prev) => {
              const row = { itemId: item.id, quantityMT: 0, basicRate, rate, amount: 0 }
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
      )}

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
