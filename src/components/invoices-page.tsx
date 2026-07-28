import { useState, useMemo } from 'react'
import { PurchaseInvoice, Supplier, Item, InvoiceItem, Payment } from '@/lib/types'
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
import { ArrowLeft, CaretLeft, Plus, Receipt, Trash, X, Info, PencilSimple, FunnelSimple, Warning, DownloadSimple, MagnifyingGlass, Barcode, Package, UserPlus, GearSix, Keyboard, UploadSimple, FileText, Wallet, TrendUp, SlidersHorizontal } from '@phosphor-icons/react'
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
  counters: Counter[]
  transactions: CashBankTransaction[]
  onUpdateCashBank: (counters: Counter[], transactions: CashBankTransaction[]) => void
}

const DEFAULT_INVOICE_TERMS = '1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to [ENTER_YOUR_CITY_NAME] jurisdiction only'

export default function InvoicesPage({ invoices, setInvoices, suppliers, setSuppliers, payments, setPayments, items, setItems, currentFY, isLocked = false, gstPercentage = 18, counters, transactions, onUpdateCashBank }: InvoicesPageProps) {
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
  type AdditionalCharge = { id: string; remarks: string; basicRate: number; taxMode: 'none' | 'gst'; gstRate: number; finalAmt: number };
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([])
  
  const additionalCostBasicRate = additionalCharges.reduce((sum, c) => sum + (c.basicRate || 0), 0)
  const additionalCostFinal = additionalCharges.reduce((sum, c) => sum + (c.finalAmt || 0), 0)
  const [roundOffAdjustment, setRoundOffAdjustment] = useState<number>(0)
  const [amountPaid, setAmountPaid] = useState('')
  const [selectedCounterId, setSelectedCounterId] = useState('')
  const [markAsFullyPaid, setMarkAsFullyPaid] = useState(false)
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

  const syncInvoicePayment = (invoiceId: string, supplierId: string, invoiceNo: string, invoiceDate: string, rawAmount: number, counterId: string) => {
    const paidAmount = Math.max(0, rawAmount || 0)
    const paymentId = getInvoicePaymentId(invoiceId)
    const selectedCounter = counters.find(c => c.id === counterId)
    const oldPayment = payments.find(p => p.id === paymentId)

    setPayments((prev) => {
      if (paidAmount <= 0) {
        return prev.filter((payment) => payment.id !== paymentId)
      }

      const payment: Payment = {
        id: paymentId,
        supplierId,
        paymentDate: invoiceDate,
        amount: paidAmount,
        counterId: counterId,
        counterName: selectedCounter?.name || 'Unknown',
        isAdvance: false,
        doNotApplyCD: false,
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

    let newCounters = [...counters]
    let newTransactions = [...transactions]
    const txnId = `txn-sp-${paymentId}`
    
    if (paidAmount <= 0) {
      if (oldPayment?.counterId) {
        newCounters = newCounters.map(c => c.id === oldPayment.counterId ? { ...c, currentBalance: c.currentBalance + oldPayment.amount } : c)
      }
      newTransactions = newTransactions.filter(t => t.id !== txnId)
    } else {
      if (oldPayment?.counterId) {
        newCounters = newCounters.map(c => c.id === oldPayment.counterId ? { ...c, currentBalance: c.currentBalance + oldPayment.amount } : c)
      }
      if (counterId) {
        newCounters = newCounters.map(c => c.id === counterId ? { ...c, currentBalance: c.currentBalance - paidAmount } : c)
      }
      
      const supplierName = suppliers.find(s => s.id === supplierId)?.name || 'Unknown'
      
      const existingTxn = newTransactions.find(t => t.id === txnId)
      if (existingTxn) {
        newTransactions = newTransactions.map(t => t.id === txnId ? {
          ...t,
          date: invoiceDate,
          counterId: counterId,
          counterName: selectedCounter?.name || 'Unknown',
          amount: paidAmount,
          narration: `Supplier Payment for Invoice ${invoiceNo}: ${supplierName}`.trim()
        } : t)
      } else {
        newTransactions.push({
          id: txnId,
          date: invoiceDate,
          counterId: counterId,
          counterName: selectedCounter?.name || 'Unknown',
          type: 'Out',
          amount: paidAmount,
          narration: `Supplier Payment for Invoice ${invoiceNo}: ${supplierName}`.trim()
        })
      }
    }
    
    onUpdateCashBank(newCounters, newTransactions)

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
    const defaultEntryUnit = item?.unit || 'MT'

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
        basicRate,
        rate,
        amount: parseFloat((quantityMT * rate).toFixed(2)),
        entryUnit: defaultEntryUnit,
        entryQuantity: quantityMT
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
      const itemRow = { ...updated[index] }
      const selectedItemDef = items.find(i => i.id === itemRow.itemId)
      
      if (field === 'itemId') {
        const newItemId = value as string
        const selectedDef = items.find(i => i.id === newItemId)
        const defaultUnit = selectedDef?.unit || 'MT'
        
        const existingIndex = prev.findIndex((r, i) => r.itemId === newItemId && i !== index)
        
        if (existingIndex !== -1) {
          // Merge into existing row
          const existing = { ...updated[existingIndex] }
          existing.quantityMT = (existing.quantityMT || 0) + (itemRow.quantityMT || 0)
          existing.amount = parseFloat((existing.quantityMT * existing.rate).toFixed(2))
          updated[existingIndex] = existing
          
          // Clear current row
          itemRow.itemId = ''
          itemRow.quantityMT = 0
          itemRow.basicRate = 0
          itemRow.rate = 0
          itemRow.amount = 0
          itemRow.entryUnit = defaultUnit
          itemRow.entryQuantity = 0
        } else {
          itemRow.itemId = newItemId
          const basicRate = itemRow.basicRate && itemRow.basicRate > 0 ? itemRow.basicRate : selectedDef?.purchasePrice || 0
          itemRow.basicRate = basicRate
          itemRow.rate = calculateRateWithItemGst(basicRate, itemRow.itemId)
          itemRow.entryUnit = defaultUnit
          itemRow.amount = parseFloat((itemRow.quantityMT * itemRow.rate).toFixed(2))
        }
      } else if (field === 'entryUnit') {
        itemRow.entryUnit = value as string
        if (selectedItemDef) {
          const factor = selectedItemDef.conversionFactor || 1000
          if (value === selectedItemDef.alternativeUnit) {
            itemRow.quantityMT = (itemRow.entryQuantity || 0) / factor
          } else {
            itemRow.quantityMT = itemRow.entryQuantity || 0
          }
          itemRow.amount = parseFloat((itemRow.quantityMT * itemRow.rate).toFixed(2))
        }
      } else if (field === 'entryQuantity' || field === 'quantityMT') {
        const numVal = parseFloat(value as string) || 0
        itemRow.entryQuantity = numVal
        
        if (selectedItemDef) {
          const factor = selectedItemDef.conversionFactor || 1000
          const activeUnit = itemRow.entryUnit || selectedItemDef.unit
          if (activeUnit === selectedItemDef.alternativeUnit) {
            itemRow.quantityMT = numVal / factor
          } else {
            itemRow.quantityMT = numVal
          }
        } else {
          itemRow.quantityMT = numVal
        }
        itemRow.amount = parseFloat((itemRow.quantityMT * itemRow.rate).toFixed(2))
      } else if (field === 'basicRate') {
        const basicRate = parseFloat(value as string) || 0
        itemRow.basicRate = basicRate
        itemRow.rate = calculateRateWithItemGst(basicRate, itemRow.itemId)
        itemRow.amount = parseFloat((itemRow.quantityMT * itemRow.rate).toFixed(2))
      } else if (field === 'rate') {
        itemRow.rate = parseFloat(value as string) || 0
        itemRow.amount = parseFloat((itemRow.quantityMT * itemRow.rate).toFixed(2))
      }
      
      updated[index] = itemRow
      return updated
    })
  }

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateCharge = (id: string, field: keyof AdditionalCharge, value: any) => {
    setAdditionalCharges(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [field]: value };
      
      if (field === 'basicRate' || field === 'taxMode' || field === 'gstRate') {
        const rate = field === 'basicRate' ? parseFloat(value) || 0 : updated.basicRate;
        const mode = field === 'taxMode' ? value : updated.taxMode;
        const gRate = field === 'gstRate' ? parseFloat(value) || 0 : updated.gstRate;
        
        updated.finalAmt = mode === 'gst' ? parseFloat((rate * (1 + gRate / 100)).toFixed(2)) : rate;
        if (field === 'basicRate') updated.basicRate = rate;
        if (field === 'gstRate') updated.gstRate = gRate;
      }
      return updated;
    }));
  }

  const addAnotherCharge = () => {
    setAdditionalCharges(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      remarks: '',
      basicRate: 0,
      taxMode: 'none',
      gstRate: gstPercentage,
      finalAmt: 0
    }]);
  }

  const removeCharge = (id: string) => {
    setAdditionalCharges(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) setShowAdditionalCharge(false);
      return next;
    });
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
    // Re-calculate from state directly instead of formData to support multiple
    const aggregatedBasicRate = additionalCharges.reduce((sum, c) => sum + (c.basicRate || 0), 0)
    const aggregatedFinal = additionalCharges.reduce((sum, c) => sum + (c.finalAmt || 0), 0)
    const aggregatedRemarks = additionalCharges.map(c => c.remarks).filter(Boolean).join(', ')

    const additionalCostBasicRate = aggregatedBasicRate
    const additionalCost = aggregatedFinal
    const additionalCostRemarks = aggregatedRemarks
    const roundOffAdjustment = parseFloat(formData.get('roundOffAdjustment') as string) || 0
    const finalInvoiceAmount = parseFloat((totalAmt + additionalCost + roundOffAdjustment).toFixed(2))
    const amountValue = amountPaid || formData.get('amountPaid') as string
    const finalAmountPaid = Math.max(0, parseFloat(amountValue) || 0)
    const counterId = formData.get('counterId') as string
    
    if (finalAmountPaid > 0 && !counterId) {
      toast.error('Please select a payment account')
      return
    }

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
      syncInvoicePayment(editingInvoice.id, supplierId, invoiceNo, invoiceDate, finalAmountPaid, counterId)
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
                fy: currentFY,
        createdAt: Date.now()
      }
      setInvoices((prev) => [...prev, invoice])
      syncInvoicePayment(invoiceId, supplierId, formData.get('invoiceNo') as string, formData.get('invoiceDate') as string, finalAmountPaid, counterId)
      toast.success('Invoice added successfully')
    }

    setOpen(false)
    setInvoiceItems([])
    setEditingInvoice(null)
    setSupplierPickerOpen(false)
    setSupplierSearch('')
    setAmountPaid('')
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
      setRoundOffAdjustment(0)
      setAmountPaid('')
      setMarkAsFullyPaid(false)
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
      setRoundOffAdjustment(0)
      setAmountPaid('')
      setMarkAsFullyPaid(false)
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
    const linkedPayment = payments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))
    setAmountPaid(linkedPayment ? String(linkedPayment.amount) : '')
    setSelectedCounterId(linkedPayment?.counterId || '')
    setMarkAsFullyPaid(Boolean(linkedPayment && Math.abs(linkedPayment.amount - invoice.invoiceAmount) < 0.01))
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
    const payment = payments.find((payment) => payment.id === getInvoicePaymentId(invoice.id))
    exportPurchaseInvoicePDF(invoice, supplierMap.get(invoice.supplierId), itemMap, {
      businessName: 'SK TRADERS',
      state: 'West Bengal',
      phone: '9083876218',
      paidAmount: payment?.amount || 0,
      paymentCounterName: payment?.counterName
    })
    toast.success(`Downloaded invoice ${invoice.invoiceNo}`)
  }

  return (
    <div className="space-y-6 pb-12">
      {!open && (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-slate-700 hover:bg-slate-200/60"
              >
                <CaretLeft className="h-5 w-5" weight="bold" />
              </Button>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchase Invoices</h1>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* Card 1: Total Invoices */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Purchase Invoices</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{fyInvoices.length}</p>
                <p className="text-xs font-semibold text-blue-600 flex items-center gap-1 mt-2">
                  <TrendUp className="h-3.5 w-3.5" weight="bold" /> 0% from last month
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100/60 flex items-center justify-center shrink-0">
                <Receipt className="h-6 w-6" weight="duotone" />
              </div>
            </div>

            {/* Card 2: Total Quantity Purchased */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Quantity Purchased</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
                  {formatMT(totalMT)} <span className="text-base font-bold text-slate-500">MT</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100/60 flex items-center justify-center shrink-0">
                <Package className="h-6 w-6" weight="duotone" />
              </div>
            </div>

            {/* Card 3: Total Purchase Amount */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Purchase Amount</p>
                <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{formatCurrency(totalAmount)}</p>
                <p className="text-xs font-normal text-slate-400 mt-2">Reflects final settlement values</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/60 flex items-center justify-center shrink-0">
                <Wallet className="h-6 w-6" weight="duotone" />
              </div>
            </div>
          </div>
        </>
      )}

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
                        className="h-8 bg-background text-xs"
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
                        className="h-8 bg-background text-xs"
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
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              step="0.001"
                              min="0"
                              value={invoiceItem.entryQuantity ?? (invoiceItem.quantityMT || '')}
                              onChange={(e) => updateInvoiceItem(index, 'entryQuantity', e.target.value)}
                              placeholder="0"
                              className="erp-reference-cell-input font-mono text-right flex-1 min-w-[70px]"
                            />
                            {(() => {
                              const sel = items.find(i => i.id === invoiceItem.itemId)
                              const activeUnit = invoiceItem.entryUnit || sel?.unit || 'MT'
                              return (
                                <select
                                  value={activeUnit}
                                  onChange={(e) => updateInvoiceItem(index, 'entryUnit', e.target.value)}
                                  className="text-xs font-bold font-mono bg-slate-100 border border-slate-300 rounded px-1 py-1 text-slate-800 focus:outline-none"
                                >
                                  <option value={sel?.unit || 'MT'}>{sel?.unit || 'MT'}</option>
                                  {sel?.alternativeUnit && sel.alternativeUnit !== 'NONE' && (
                                    <option value={sel.alternativeUnit}>{sel.alternativeUnit}</option>
                                  )}
                                </select>
                              )
                            })()}
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={invoiceItem.basicRate || ''}
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
                          <input type="hidden" name="amountPaid" value={markAsFullyPaid ? finalInvoiceAmountPreview : amountPaid} />
                          {amountPaid && parseFloat(amountPaid) > 0 && (
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
                                  value={markAsFullyPaid ? finalInvoiceAmountPreview || '' : amountPaid}
                                  onChange={(event) => setAmountPaid(event.target.value)}
                                  disabled={markAsFullyPaid}
                                  placeholder="0.00"
                                  className="pl-8 font-mono text-right"
                                />
                              </div>
                            </div>
                            <div className="erp-payment-field">
                              <label>Payment Account</label>
                              <Select value={selectedCounterId} onValueChange={setSelectedCounterId} required={parseFloat(amountPaid) > 0 || markAsFullyPaid}>
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
                              <span className="value text-blue-600">₹{paidAmountPreview.toFixed(2)}</span>
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
                                    <Select value={charge.taxMode} onValueChange={(value) => handleUpdateCharge(charge.id, 'taxMode', value)}>
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
                              <span className="value">{formatMT(totalInvoiceQty)}</span>
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
            setSelectedPickerItemId(item.id)
            setShowQuickItem(false)
            toast.success(`Item "${item.name}" created`)
          }}
        />
      {!open && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Card Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0256e8] flex items-center justify-center">
                <Receipt className="h-5 w-5" weight="duotone" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Purchase Invoice List</h2>
            </div>
            <Button onClick={handleAdd} className="bg-[#0256e8] hover:bg-[#0046cd] text-white font-semibold rounded-xl px-4 py-2.5 shadow-2xs flex items-center gap-2">
              <Plus className="h-4 w-4" weight="bold" />
              Add Purchase Invoice
            </Button>
          </div>

          {/* Filter Sub-bar */}
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <SlidersHorizontal className="h-4 w-4" weight="bold" />
                <span>Filters:</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger className="w-48 h-9 bg-white border-slate-200 text-xs font-medium rounded-xl">
                    <span className="text-slate-400 mr-1">Supplier:</span>
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-36 h-9 bg-white border-slate-200 text-xs font-medium rounded-xl">
                    <span className="text-slate-400 mr-1">Month:</span>
                    <SelectValue placeholder="Jul 26" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {fyMonths.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200/60">
              {filteredInvoices.length} invoices found
            </span>
          </div>

          {/* Table */}
          <Table>
            <TableHeader className="bg-[#edf3fc]">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5">INVOICE NO</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5">DATE</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5">SUPPLIER</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5">ITEMS</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5 text-right">QUANTITY (MT)</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5 text-right">AMOUNT</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-700 py-3.5 text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-16 h-16 rounded-full bg-blue-50 text-[#0256e8] flex items-center justify-center mx-auto border border-blue-100 shadow-2xs">
                        <Receipt size={32} weight="duotone" />
                      </div>
                      <h3 className="text-base font-bold text-slate-900">No invoices found</h3>
                      <p className="text-xs text-slate-500">
                        No purchase invoices found for FY {currentFY}. Add your first invoice to get started.
                      </p>
                      <button
                        onClick={handleAdd}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0256e8] hover:underline pt-2"
                      >
                        <Plus className="h-4 w-4" weight="bold" />
                        Create First Invoice
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices
                  .sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
                  .map((invoice) => {
                    const supplier = supplierMap.get(invoice.supplierId)
                    const itemNames = (invoice.items || [])
                      .map(item => itemMap.get(item.itemId)?.name || 'Unknown')
                      .join(', ')

                    return (
                      <TableRow key={invoice.id} className="hover:bg-slate-50/80 border-b border-slate-100">
                        <TableCell className="font-mono font-bold text-slate-900 text-sm">{invoice.invoiceNo}</TableCell>
                        <TableCell className="text-slate-600 text-xs font-medium">{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</TableCell>
                        <TableCell className="font-semibold text-slate-800 text-sm">{supplier?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-xs text-slate-600 max-w-[200px] truncate" title={itemNames}>
                          {itemNames || 'No items'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-slate-900">{formatMT(invoice.quantityMT)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900 text-sm">{formatCurrency(invoice.invoiceAmount)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPreviewInvoice(invoice)}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                              aria-label={`Preview invoice ${invoice.invoiceNo}`}
                            >
                              <Receipt size={16} weight="bold" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownloadInvoicePDF(invoice)}
                              className="h-8 gap-1 px-2 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-100 rounded-lg"
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
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                              aria-label={`Edit invoice ${invoice.invoiceNo}`}
                            >
                              <PencilSimple size={16} weight="bold" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(invoice)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              aria-label={`Delete invoice ${invoice.invoiceNo}`}
                            >
                              <Trash size={16} weight="bold" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
              )}
            </TableBody>
          </Table>

          {/* Table Footer */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium bg-white">
            <div>Showing 0 to {filteredInvoices.length} of {filteredInvoices.length} entries</div>
            <div className="flex items-center gap-1">
              <button className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-50" disabled>‹</button>
              <button className="h-7 w-7 rounded-lg bg-[#0256e8] text-white font-bold flex items-center justify-center">1</button>
              <button className="h-7 w-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 disabled:opacity-50" disabled>›</button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Plus Button */}
      {!open && (
        <button
          onClick={handleAdd}
          className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-[#0256e8] text-white shadow-lg flex items-center justify-center z-40 hover:scale-105 transition-transform"
          title="Add Purchase Invoice"
        >
          <Plus className="h-6 w-6" weight="bold" />
        </button>
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
