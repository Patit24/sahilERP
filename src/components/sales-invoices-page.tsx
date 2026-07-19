import { useState, useMemo } from 'react'
import { SalesInvoice, Customer, Item, InvoiceItem, CustomerPayment } from '@/lib/types'
import { Counter, CashBankTransaction } from '@/lib/cash-bank-types'
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
import { ArrowLeft, Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple, MagnifyingGlass, Barcode, Package, UserPlus, GearSix, Keyboard, UploadSimple , FileText, Wallet } from '@phosphor-icons/react'
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
  counters: Counter[]
  transactions: CashBankTransaction[]
  onUpdateCashBank: (counters: Counter[], transactions: CashBankTransaction[]) => void
}

const DEFAULT_INVOICE_TERMS = '1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to [ENTER_YOUR_CITY_NAME] jurisdiction only'

export type AdditionalCharge = { id: string; remarks: string; basicRate: number; taxMode: 'none' | 'gst'; gstRate: number; finalAmt: number }

export default function SalesInvoicesPage({ salesInvoices, setSalesInvoices, customers, setCustomers, customerPayments, setCustomerPayments, items, setItems, currentFY, isLocked = false, counters, transactions, onUpdateCashBank }: SalesInvoicesPageProps) {
  const [open, setOpen] = useState(false)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<SalesInvoice | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoice | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedCustomer, setSelectedCustomer] = useState<string>('all')
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])

  // We keep these derived values for compatibility with existing calculations
  const additionalCostFinal = additionalCharges.reduce((sum, charge) => sum + (charge.finalAmt || 0), 0)

  const addAnotherCharge = () => {
    setAdditionalCharges(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        remarks: '',
        basicRate: 0,
        taxMode: 'none',
        gstRate: 18,
        finalAmt: 0
      }
    ])
  }

  const handleUpdateCharge = (id: string, field: keyof AdditionalCharge, value: string | number) => {
    setAdditionalCharges(prev => prev.map(charge => {
      if (charge.id !== id) return charge

      const updated = { ...charge, [field]: value }
      
      // Recalculate finalAmt if necessary
      if (field === 'basicRate' || field === 'taxMode' || field === 'gstRate') {
        const basic = Number(updated.basicRate) || 0
        if (updated.taxMode === 'gst') {
          const gst = Number(updated.gstRate) || 18
          updated.finalAmt = parseFloat((basic * (1 + gst / 100)).toFixed(2))
        } else {
          updated.finalAmt = basic
        }
      }

      return updated
    }))
  }

  const removeCharge = (id: string) => {
    setAdditionalCharges(prev => prev.filter(c => c.id !== id))
  }
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [amountReceived, setAmountReceived] = useState('')
  const [selectedCounterId, setSelectedCounterId] = useState('')
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false)
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showQuickCustomer, setShowQuickCustomer] = useState(false)
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

  const syncInvoicePayment = (invoiceId: string, customerId: string, invoiceNo: string, invoiceDate: string, rawAmount: number, counterId: string) => {
    const receivedAmount = Math.max(0, rawAmount || 0)
    const paymentId = getInvoicePaymentId(invoiceId)
    const selectedCounter = counters.find(c => c.id === counterId)
    const oldPayment = customerPayments.find(p => p.id === paymentId)

    setCustomerPayments((prev) => {
      if (receivedAmount <= 0) {
        return prev.filter((payment) => payment.id !== paymentId)
      }

      const payment: CustomerPayment = {
        id: paymentId,
        customerId,
        paymentDate: invoiceDate,
        amount: receivedAmount,
        notes: `Auto-created from sales invoice ${invoiceNo}`,
        counterId: counterId,
        counterName: selectedCounter?.name || 'Unknown',
        fy: currentFY
      }

      const exists = prev.some((candidate) => candidate.id === paymentId)
      if (!exists) return [...prev, payment]

      return prev.map((candidate) => candidate.id === paymentId ? { ...candidate, ...payment } : candidate)
    })

    let newCounters = [...counters]
    let newTransactions = [...transactions]
    const txnId = `txn-cp-${paymentId}`
    
    if (receivedAmount <= 0) {
      if (oldPayment?.counterId) {
        newCounters = newCounters.map(c => c.id === oldPayment.counterId ? { ...c, currentBalance: c.currentBalance - oldPayment.amount } : c)
      }
      newTransactions = newTransactions.filter(t => t.id !== txnId)
    } else {
      if (oldPayment?.counterId) {
        newCounters = newCounters.map(c => c.id === oldPayment.counterId ? { ...c, currentBalance: c.currentBalance - oldPayment.amount } : c)
      }
      if (counterId) {
        newCounters = newCounters.map(c => c.id === counterId ? { ...c, currentBalance: c.currentBalance + receivedAmount } : c)
      }
      
      const customerName = customers.find(c => c.id === customerId)?.name || 'Unknown'
      
      const existingTxn = newTransactions.find(t => t.id === txnId)
      if (existingTxn) {
        newTransactions = newTransactions.map(t => t.id === txnId ? {
          ...t,
          date: invoiceDate,
          counterId: counterId,
          counterName: selectedCounter?.name || 'Unknown',
          amount: receivedAmount,
          narration: `Customer Payment for Invoice ${invoiceNo}: ${customerName}`.trim()
        } : t)
      } else {
        newTransactions.push({
          id: txnId,
          date: invoiceDate,
          counterId: counterId,
          counterName: selectedCounter?.name || 'Unknown',
          type: 'In',
          amount: receivedAmount,
          narration: `Customer Payment for Invoice ${invoiceNo}: ${customerName}`.trim()
        })
      }
    }
    
    onUpdateCashBank(newCounters, newTransactions)

    if (receivedAmount > 0) {
      toast.success(`Receipt linked to invoice ${invoiceNo}`)
    }
  }

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

  const getInvoiceItemGstRate = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return typeof item?.gstRate === 'number' && !Number.isNaN(item.gstRate)
      ? item.gstRate
      : gstPercentage
  }

  const addInvoiceItemWithItem = (itemId: string, quantityMT = 0) => {
    const item = items.find((candidate) => candidate.id === itemId)
    const rate = item?.salesPrice || item?.purchasePrice || 0

    setInvoiceItems(prev => {
      const existingIndex = prev.findIndex(existing => existing.itemId === itemId)
      
      if (existingIndex !== -1) {
        // Item already exists, merge quantities
        const updated = [...prev]
        const existing = updated[existingIndex]
        const newQuantity = (existing.quantityMT || 0) + quantityMT
        
        updated[existingIndex] = {
          ...existing,
          quantityMT: newQuantity,
          amount: parseFloat((newQuantity * existing.rate).toFixed(2))
        }
        return updated
      }

      // If it doesn't exist, create a new row or fill an empty one
      const row = {
        itemId,
        quantityMT,
        rate,
        amount: parseFloat((quantityMT * rate).toFixed(2))
      }

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
        const newItemId = value as string
        const existingIndex = prev.findIndex((r, i) => r.itemId === newItemId && i !== index)
        
        if (existingIndex !== -1) {
          // Merge into existing row
          const existing = { ...updated[existingIndex] }
          existing.quantityMT = (existing.quantityMT || 0) + (item.quantityMT || 0)
          existing.amount = existing.quantityMT * existing.rate
          updated[existingIndex] = existing
          
          // Clear current row
          item.itemId = ''
          item.quantityMT = 0
          item.rate = 0
          item.amount = 0
        } else {
          item.itemId = newItemId
        }
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
    // Re-calculate from state directly instead of formData to support multiple
    const aggregatedBasicRate = additionalCharges.reduce((sum, c) => sum + (c.basicRate || 0), 0)
    const aggregatedFinal = additionalCharges.reduce((sum, c) => sum + (c.finalAmt || 0), 0)
    const aggregatedRemarks = additionalCharges.map(c => c.remarks).filter(Boolean).join(', ')

    const additionalCostBasicRate = aggregatedBasicRate
    const additionalCost = aggregatedFinal
    const additionalCostRemarks = aggregatedRemarks
    const roundOffAdjustment = parseFloat(formData.get('roundOffAdjustment') as string) || 0
    const finalInvoiceAmount = parseFloat((totalAmt + additionalCost + roundOffAdjustment).toFixed(2))
    const amountValue = amountReceived || formData.get('amountReceived') as string
    const finalAmountReceived = Math.max(0, parseFloat(amountValue) || 0)
    const counterId = formData.get('counterId') as string
    
    if (finalAmountReceived > 0 && !counterId) {
      toast.error('Please select a payment account')
      return
    }
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
      syncInvoicePayment(editingInvoice.id, customerId, invoiceNo, invoiceDate, finalAmountReceived, counterId)
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
      syncInvoicePayment(invoiceId, customerId, formData.get('invoiceNo') as string, formData.get('invoiceDate') as string, finalAmountReceived, counterId)
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
    setCustomerPickerOpen(false)
    setCustomerSearch('')
    setRoundOffAdjustment(0)
    setAmountReceived('')
    setPaymentMode('Cash')
    setMarkAsFullyPaid(false)
    setShowAdditionalCharge(false)
    setShowInvoiceNotes(false)
    setInvoiceNotes('')
    setShowInvoiceTerms(false)
    setInvoiceTerms('')
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen && !editingInvoice) {
      setSelectedCustomerId('')
      setCustomerPickerOpen(false)
      setCustomerSearch('')
      setShowQuickCustomer(false)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setPickerQuantities({})
      setInvoiceItems([])
      setRoundOffAdjustment(0)
      setAmountReceived('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
      setShowAdditionalCharge(false)
      setShowInvoiceNotes(false)
      setInvoiceNotes('')
      setShowInvoiceTerms(false)
      setInvoiceTerms('')
      setTimeout(() => {
        document.querySelector('.erp-invoice-body')?.scrollTo({ top: 0 })
      }, 0)
    } else if (!newOpen) {
      setInvoiceItems([])
      setEditingInvoice(null)
      setSelectedCustomerId('')
      setCustomerPickerOpen(false)
      setCustomerSearch('')
      setShowQuickCustomer(false)
      setShowQuickItem(false)
      setItemPickerOpen(false)
      setItemSearch('')
      setSelectedItemCategory('all')
      setSelectedPickerItemId('')
      setPickerQuantities({})
      setRoundOffAdjustment(0)
      setAmountReceived('')
      setPaymentMode('Cash')
      setMarkAsFullyPaid(false)
      setShowAdditionalCharge(false)
      setShowInvoiceNotes(false)
      setInvoiceNotes('')
      setShowInvoiceTerms(false)
      setInvoiceTerms('')
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
    setCustomerPickerOpen(false)
    setCustomerSearch('')
    setInvoiceItems(invoice.items || [])
    const hasCost = Boolean(invoice.additionalCost || invoice.additionalCostBasicRate || invoice.additionalCostRemarks);
    setShowAdditionalCharge(hasCost);
    if (hasCost) {
      setAdditionalCharges([{
        id: Math.random().toString(36).substring(7),
        remarks: invoice.additionalCostRemarks || '',
        basicRate: invoice.additionalCostBasicRate || 0,
        taxMode: invoice.additionalCostBasicRate && invoice.additionalCost && invoice.additionalCost > invoice.additionalCostBasicRate ? 'gst' : 'none',
        gstRate: gstPercentage,
        finalAmt: invoice.additionalCost || 0
      }]);
    } else {
      setAdditionalCharges([]);
    }
    setRoundOffAdjustment(invoice.roundOffAdjustment || 0)
    const linkedPayment = customerPayments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))
    setAmountReceived(linkedPayment ? String(linkedPayment.amount) : '')
    setSelectedCounterId(linkedPayment?.counterId || '')
    setMarkAsFullyPaid(Boolean(linkedPayment && Math.abs(linkedPayment.amount - invoice.invoiceAmount) < 0.01))
        setShowInvoiceNotes(false)
    setInvoiceNotes('')
    setShowInvoiceTerms(false)
    setInvoiceTerms('')
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
  const selectedInvoiceCustomer = selectedCustomerId ? customerMap.get(selectedCustomerId) : undefined
  const filteredCustomers = customers.filter((customer) => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return true
    return [customer.name, customer.phone, customer.email, customer.gstin]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
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
      phone: '9083876218',
            paidAmount: customerPayments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))?.amount || 0
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
                          <div className="erp-party-picker-field">
                            <input type="hidden" name="customerId" value={selectedCustomerId} />
                            {!customerPickerOpen && !selectedInvoiceCustomer ? (
                              <button
                                type="button"
                                className="erp-party-add-box"
                                onClick={() => setCustomerPickerOpen(true)}
                              >
                                <Plus size={18} weight="bold" />
                                Add Party
                              </button>
                            ) : (
                              <div className="erp-party-dropdown-card">
                                <div className="erp-party-search-row">
                                  <MagnifyingGlass size={20} />
                                  <input
                                    id="customerId"
                                    type="text"
                                    value={customerSearch}
                                    onChange={(event) => setCustomerSearch(event.target.value)}
                                    onFocus={() => setCustomerPickerOpen(true)}
                                    placeholder={selectedInvoiceCustomer ? selectedInvoiceCustomer.name : 'Search party by name or number'}
                                    autoComplete="off"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Toggle customer list"
                                    onClick={() => setCustomerPickerOpen((open) => !open)}
                                  >
                                    <span>⌄</span>
                                  </button>
                                </div>

                                {customerPickerOpen && (
                                  <div className="erp-party-options">
                                    <div className="erp-party-options-head">
                                      <span>Party Name</span>
                                      <span>Balance</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="erp-party-option"
                                      onClick={() => {
                                        setSelectedCustomerId('')
                                        setCustomerSearch('')
                                        setCustomerPickerOpen(false)
                                      }}
                                    >
                                      <span>Cash Sale</span>
                                      <span>{formatCurrency(0)}</span>
                                    </button>
                                    {filteredCustomers.map((customer) => (
                                      <button
                                        type="button"
                                        key={customer.id}
                                        className="erp-party-option"
                                        onClick={() => {
                                          setSelectedCustomerId(customer.id)
                                          setCustomerSearch('')
                                          setCustomerPickerOpen(false)
                                        }}
                                      >
                                        <span>{customer.name}</span>
                                        <span>{formatCurrency(customer.openingBalance || 0)}</span>
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      className="erp-party-create-option"
                                      onClick={() => {
                                        setCustomerPickerOpen(false)
                                        setShowQuickCustomer(true)
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
                              placeholder="SI-001"
                              className="h-8 bg-background text-xs"
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
                              className="h-8 bg-background text-xs"
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
                                  <span>Items</span>
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

                                {invoiceItems.map((item, index) => (
                                  <div className="erp-reference-item-row" key={index}>
                                    <span className="erp-reference-row-number">{index + 1}</span>
                                    <Select value={item.itemId} onValueChange={(value) => updateInvoiceItem(index, 'itemId', value)}>
                                      <SelectTrigger className="erp-reference-cell-input">
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
                                    <Input value="-" disabled className="erp-reference-cell-input text-center" />
                                    <Input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      value={item.quantityMT || ''}
                                      onChange={(e) => updateInvoiceItem(index, 'quantityMT', e.target.value)}
                                      placeholder="0"
                                      className="erp-reference-cell-input font-mono text-right"
                                    />
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.rate || ''}
                                      onChange={(e) => updateInvoiceItem(index, 'rate', e.target.value)}
                                      placeholder="0"
                                      className="erp-reference-cell-input font-mono text-right"
                                    />
                                    <Input value="-" disabled className="erp-reference-cell-input text-center" />
                                    <Input value={`GST @ ${getInvoiceItemGstRate(item.itemId)}%`} disabled className="erp-reference-cell-input text-center" />
                                    <Input value={formatCurrency(item.amount)} disabled className="erp-reference-cell-input font-mono text-right" />
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

                                </div>
                              </div>
                        </div>

                        <div className="erp-invoice-reference-footer">
                          {/* Column 1: Invoice Information */}
                          <div className="erp-footer-col erp-footer-col-left">
                            <div className="erp-footer-section">
                              <div className="erp-footer-section-header">
                                <FileText size={20} weight="fill" />
                                <div>
                                  <h3>Invoice Information</h3>
                                  <p>Add notes and terms related to this purchase.</p>
                                </div>
                              </div>
                              <div className="erp-footer-section-content">
                                {/* Invoice Notes */}
                                <div className="erp-inner-card">
                                  <div className="erp-inner-card-header">
                                    <h4><FileText size={16} weight="bold" /> Invoice Notes</h4>
                                    {!showInvoiceNotes && (
                                      <button type="button" className="erp-inner-card-action" onClick={() => setShowInvoiceNotes(true)}>
                                        <Plus size={14} weight="bold" /> Add Notes
                                      </button>
                                    )}
                                  </div>
                                  {showInvoiceNotes && (
                                    <div className="erp-inner-card-body">
                                      <Textarea 
                                        value={invoiceNotes} 
                                        onChange={(event) => setInvoiceNotes(event.target.value)} 
                                        placeholder="Enter notes here..." 
                                      />
                                      <span className="erp-char-count">{invoiceNotes.length} / 500</span>
                                      <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => { setShowInvoiceNotes(false); setInvoiceNotes('') }}>
                                        <X size={16} weight="bold" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Terms & Conditions */}
                                <div className="erp-inner-card">
                                  <div className="erp-inner-card-header">
                                    <h4><Receipt size={16} weight="bold" /> Terms & Conditions</h4>
                                    {!showInvoiceTerms && (
                                      <button type="button" className="erp-inner-card-action" onClick={() => { setShowInvoiceTerms(true); setInvoiceTerms((current) => current || DEFAULT_INVOICE_TERMS) }}>
                                        <Plus size={14} weight="bold" /> Add Terms
                                      </button>
                                    )}
                                  </div>
                                  {showInvoiceTerms && (
                                    <div className="erp-inner-card-body">
                                      <Textarea 
                                        value={invoiceTerms} 
                                        onChange={(event) => setInvoiceTerms(event.target.value)} 
                                        placeholder="Enter terms and conditions..."
                                      />
                                      <span className="erp-char-count">{invoiceTerms.length} / 1000</span>
                                      <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => { setShowInvoiceTerms(false); setInvoiceTerms('') }}>
                                        <X size={16} weight="bold" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Payment Settlement */}
                          <div className="erp-footer-col erp-footer-col-middle">
                            <div className="erp-footer-section">
                              <div className="erp-footer-section-header">
                                <Wallet size={20} weight="fill" />
                                <div>
                                  <h3>Payment Settlement</h3>
                                  <p>Record the amount paid while saving this purchase invoice.</p>
                                </div>
                              </div>
                              <div className="erp-footer-section-content">
                                <input type="hidden" name="amountReceived" value={markAsFullyPaid ? finalInvoiceAmountPreview : amountReceived} />
                                {amountReceived && parseFloat(amountReceived) > 0 && (
                                <input type="hidden" name="counterId" value={selectedCounterId} />
                              )}  
                                <label className="erp-paid-checkbox cursor-pointer">
                                  <Checkbox
                                    checked={markAsFullyPaid}
                                    onCheckedChange={(checked) => setMarkAsFullyPaid(Boolean(checked))}
                                    className="mr-2"
                                  />
                                  Mark invoice as fully paid
                                  <Info size={16} className="ml-1 text-muted-foreground" weight="bold" />
                                </label>

                                <div className="erp-payment-fields-row">
                                  <div className="erp-payment-field">
                                    <label>Amount Paid</label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">₹</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={finalInvoiceAmountPreview || undefined}
                                        value={markAsFullyPaid ? finalInvoiceAmountPreview || '' : amountReceived}
                                        onChange={(event) => setAmountReceived(event.target.value)}
                                        disabled={markAsFullyPaid}
                                        placeholder="0.00"
                                        className="pl-8 font-mono text-right"
                                      />
                                    </div>
                                  </div>
                                  <div className="erp-payment-field">
                                    <label>Payment Account</label>
                                    <Select value={selectedCounterId} onValueChange={setSelectedCounterId} required={parseFloat(amountReceived) > 0 || markAsFullyPaid}>
                                      <SelectTrigger className="h-10 text-sm">
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
                                </div>


                                <div className="erp-payment-summary-box">
                                  <div className="erp-payment-summary-row">
                                    <span>Total Payable</span>
                                    <span className="value">₹{finalInvoiceAmountPreview.toFixed(2)}</span>
                                  </div>
                                  <div className="erp-payment-summary-row">
                                    <span>Amount Paid</span>
                                    <span className="value text-blue-600">₹{receivedAmountPreview.toFixed(2)}</span>
                                  </div>
                                  <div className="erp-payment-summary-row divider"></div>
                                  <div className="erp-payment-summary-row balance">
                                    <span>Balance Due</span>
                                    <span className="value">₹{balanceAmountPreview.toFixed(2)}</span>
                                  </div>
                                </div>

                                <div className="erp-alert-box-info">
                                  <Info size={18} weight="fill" />
                                  <div>If you mark as fully paid, the Amount Paid will be set equal to Total Payable.</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Column 3: Additional Charges & Summary */}
                          <div className="erp-footer-col erp-footer-col-right">
                            <div className="erp-footer-section">
                              <div className="erp-footer-section-header w-full justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                  <div className="icon-container flex items-center justify-center text-blue-500 bg-blue-50 p-1 rounded">
                                    <Receipt size={18} weight="bold" />
                                  </div>
                                  <h3 className="m-0 text-base">Additional Charges</h3>
                                </div>
                                <div className="text-sm font-semibold">
                                  Total Charges: <span className="font-mono text-blue-600 ml-1">₹{additionalCostFinal.toFixed(2)}</span>
                                </div>
                              </div>
                              <div className="erp-footer-section-content">
                                {additionalCharges.length === 0 ? (
                                  <button type="button" className="erp-add-charge-btn" onClick={addAnotherCharge}>
                                    <Plus size={16} weight="bold" /> Add Additional Charge
                                  </button>
                                ) : (
                                  <div className="flex flex-col gap-3">
                                    {additionalCharges.map((charge) => (
                                      <div key={charge.id} className="erp-charge-dashed-card">
                                        <Input
                                          type="text"
                                          value={charge.remarks}
                                          onChange={(e) => handleUpdateCharge(charge.id, 'remarks', e.target.value)}
                                          placeholder="e.g. Transport Charge"
                                          className="bg-muted/50 border-muted"
                                        />
                                        <div className="erp-charge-row-inputs">
                                          <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">₹</span>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={charge.basicRate || ''}
                                              onChange={(e) => handleUpdateCharge(charge.id, 'basicRate', e.target.value)}
                                              placeholder="0.00"
                                              className="pl-7 font-mono text-right"
                                            />
                                          </div>
                                          <Select value={charge.taxMode} onValueChange={(value: any) => handleUpdateCharge(charge.id, 'taxMode', value)}>
                                            <SelectTrigger className="w-[140px]">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">No Tax Applicable</SelectItem>
                                              <SelectItem value="gst">GST Applicable</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          {charge.taxMode === 'gst' && (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={charge.gstRate || ''}
                                              onChange={(e) => handleUpdateCharge(charge.id, 'gstRate', e.target.value)}
                                              placeholder="GST %"
                                              className="w-20 font-mono text-right"
                                            />
                                          )}
                                          <button type="button" onClick={() => removeCharge(charge.id)} className="flex items-center justify-center shrink-0">
                                            <Trash size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <div className="pt-1 px-1">
                                      <button type="button" className="erp-text-link" onClick={addAnotherCharge}>
                                        <Plus size={14} weight="bold" /> Add Another Charge
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="erp-footer-section flex-1">
                              <div className="erp-footer-section-header items-center mb-1">
                                <FileText size={20} weight="fill" />
                                <h3 className="m-0 text-base">Invoice Summary</h3>
                              </div>
                              <div className="erp-footer-section-content justify-end">
                                <div className="erp-invoice-summary-list">
                                  <div className="erp-summary-item">
                                    <span>Total Quantity</span>
                                    <span className="value">{formatMT(totalInvoiceQty)} MT</span>
                                  </div>
                                  <div className="erp-summary-divider"></div>
                                  <div className="erp-summary-item">
                                    <span>Items Subtotal</span>
                                    <span className="value">₹{totalInvoiceAmount.toFixed(2)}</span>
                                  </div>
                                  <div className="erp-summary-divider"></div>
                                  <div className="erp-summary-item">
                                    <span>Additional Charges</span>
                                    <span className="value">₹{additionalCostFinal.toFixed(2)}</span>
                                  </div>
                                  <div className="erp-summary-divider"></div>
                                  <div className="erp-summary-item">
                                    <span>Tax Amount</span>
                                    <span className="value">₹0.00</span>
                                  </div>
                                  <div className="erp-summary-divider"></div>
                                  <div className="erp-summary-item discount">
                                    <span>Discount / Adjustment</span>
                                    <span className="value">- ₹{Math.abs(roundOffAdjustment).toFixed(2)}</span>
                                  </div>
                                </div>
                                
                                <div className="erp-final-amount-block mt-auto">
                                  <span className="label">Final Invoice Amount</span>
                                  <span className="amount">₹{(totalInvoiceAmount + additionalCostFinal + roundOffAdjustment).toFixed(2)}</span>
                                  <input type="hidden" name="roundOffAdjustment" value={roundOffAdjustment} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="erp-global-footer-alert">
                          <Info size={18} weight="fill" />
                          Values are updated automatically based on your entries.
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
