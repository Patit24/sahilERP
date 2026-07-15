import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash, BookBookmark, Lock, Funnel, X, FilePdf } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { MTBooking, Supplier, FixedScheme, PurchaseInvoice, MTBookingTieBreakPreference } from '@/lib/types'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatCurrency = (value: number): string => {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatCurrencyForPDF = (value: number): string => {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface MTBookingsPageProps {
  mtBookings: MTBooking[]
  setMTBookings: (updater: (prev: MTBooking[]) => MTBooking[]) => void
  suppliers: Supplier[]
  fixedSchemes: FixedScheme[]
  invoices: PurchaseInvoice[]
  currentFY: string
  isLocked: boolean
}

interface BookingFormData {
  supplierId: string
  orderDate: string
  consumeStartDate: string
  bookedMT: string
  bookedMarketRate: string
  tieBreakPreference: MTBookingTieBreakPreference
  manualSelection: 'current' | 'previous'
  notes: string
  editableSchemes: Array<{
    schemeId: string
    schemeName: string
    ratePerMT: number
    ruleVersionId?: string
    ruleVersion?: number
    effectiveFrom?: string
    effectiveTo?: string
  }>
}

interface NewSchemeFormData {
  schemeName: string
  ratePerMT: string
}

export default function MTBookingsPage({
  mtBookings,
  setMTBookings,
  suppliers,
  fixedSchemes,
  invoices,
  currentFY,
  isLocked
}: MTBookingsPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBooking, setEditingBooking] = useState<MTBooking | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [bookingToDelete, setBookingToDelete] = useState<MTBooking | null>(null)

  const [filterSupplier, setFilterSupplier] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [formData, setFormData] = useState<BookingFormData>({
    supplierId: '',
    orderDate: '',
    consumeStartDate: '',
    bookedMT: '',
    bookedMarketRate: '',
    tieBreakPreference: 'current',
    manualSelection: 'current',
    notes: '',
    editableSchemes: []
  })
  
  const [newSchemeDialogOpen, setNewSchemeDialogOpen] = useState(false)
  const [newSchemeData, setNewSchemeData] = useState<NewSchemeFormData>({
    schemeName: '',
    ratePerMT: ''
  })

  const getSupplierName = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId)
    return supplier?.name || 'Unknown'
  }

  const getTieBreakLabel = (preference: MTBookingTieBreakPreference) => {
    if (preference === 'previous') return 'Previous month'
    if (preference === 'highestBenefit') return 'Highest benefit'
    if (preference === 'manual') return 'Manual approval'
    return 'Current month'
  }

  const getActiveSchemesForDate = (supplierId: string, orderDate: string): { schemes: any[], totalRate: number } => {
    const supplierSchemes = fixedSchemes.filter(fs => 
      fs.supplierId === supplierId && 
      (fs.applyInMTBooking !== false)
    )
    const activeSchemes: any[] = []
    
    for (const scheme of supplierSchemes) {
      const schemeFrom = new Date(scheme.fromDate)
      const schemeTo = new Date(scheme.toDate)
      const order = new Date(orderDate)
      
      if (order >= schemeFrom && order <= schemeTo) {
        activeSchemes.push({
          schemeId: scheme.id,
          schemeName: scheme.schemeName,
          ratePerMT: scheme.ratePerMT,
          ruleVersionId: scheme.id,
          ruleVersion: scheme.version || 1,
          effectiveFrom: scheme.fromDate,
          effectiveTo: scheme.toDate
        })
      }
    }
    
    const totalRate = activeSchemes.reduce((sum, s) => sum + s.ratePerMT, 0)
    return { schemes: activeSchemes, totalRate }
  }

  const calculateConsumedMT = (bookingId: string): number => {
    const booking = mtBookings.find(b => b.id === bookingId)
    if (!booking) return 0

    const eligibleInvoices = invoices
      .filter(inv => {
        const invDate = new Date(inv.invoiceDate)
        const consumeStart = new Date(booking.consumeStartDate)
        return inv.supplierId === booking.supplierId && invDate >= consumeStart
      })
      .sort((a, b) => {
        const dateA = new Date(a.invoiceDate).getTime()
        const dateB = new Date(b.invoiceDate).getTime()
        return dateA - dateB
      })

    let totalConsumed = 0
    for (const inv of eligibleInvoices) {
      const remainingInBooking = booking.bookedMT - totalConsumed
      if (remainingInBooking <= 0) break
      
      const mtFromThisInvoice = Math.min(inv.quantityMT, remainingInBooking)
      totalConsumed += mtFromThisInvoice
    }

    return totalConsumed
  }

  const enrichedBookings = useMemo(() => {
    return mtBookings.map(booking => {
      const consumedMT = calculateConsumedMT(booking.id)
      const remainingMT = booking.bookedMT - consumedMT
      
      return {
        ...booking,
        consumedMT,
        remainingMT,
        status: remainingMT > 0 ? 'Active' : 'Consumed'
      }
    })
  }, [mtBookings, invoices])

  const handleOpenAddDialog = () => {
    setEditingBooking(null)
    setFormData({
      supplierId: '',
      orderDate: '',
      consumeStartDate: '',
      bookedMT: '',
      bookedMarketRate: '',
      tieBreakPreference: 'current',
      manualSelection: 'current',
      notes: '',
      editableSchemes: []
    })
    setDialogOpen(true)
  }

  const handleOpenEditDialog = (booking: MTBooking) => {
    setEditingBooking(booking)
    setFormData({
      supplierId: booking.supplierId,
      orderDate: booking.orderDate,
      consumeStartDate: booking.consumeStartDate,
      bookedMT: booking.bookedMT.toString(),
      bookedMarketRate: booking.bookedMarketRate ? booking.bookedMarketRate.toString() : '',
      tieBreakPreference: booking.tieBreakPreference || 'current',
      manualSelection: booking.manualSelection || 'current',
      notes: booking.notes || '',
      editableSchemes: booking.lockedSchemes ? booking.lockedSchemes.map(s => ({
        schemeId: s.schemeId,
        schemeName: s.schemeName,
        ratePerMT: s.ratePerMT,
        ruleVersionId: s.ruleVersionId,
        ruleVersion: s.ruleVersion,
        effectiveFrom: s.effectiveFrom,
        effectiveTo: s.effectiveTo
      })) : []
    })
    setDialogOpen(true)
  }

  const handleOrderDateChange = (orderDate: string) => {
    setFormData(prev => {
      const consumeStart = orderDate ? getNextDay(orderDate) : ''
      
      if (prev.supplierId && orderDate) {
        const { schemes } = getActiveSchemesForDate(prev.supplierId, orderDate)
        return {
          ...prev,
          orderDate,
          consumeStartDate: consumeStart,
          editableSchemes: schemes
        }
      }
      
      return {
        ...prev,
        orderDate,
        consumeStartDate: consumeStart
      }
    })
  }

  const getNextDay = (dateStr: string): string => {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + 1)
    return date.toISOString().split('T')[0]
  }

  const handleAddScheme = () => {
    if (!newSchemeData.schemeName.trim()) {
      toast.error('Please enter scheme name')
      return
    }
    
    const ratePerMT = parseFloat(newSchemeData.ratePerMT)
    if (!newSchemeData.ratePerMT || isNaN(ratePerMT) || ratePerMT <= 0) {
      toast.error('Please enter a valid rate per MT')
      return
    }

    const newScheme = {
      schemeId: `custom-scheme-${Date.now()}`,
      schemeName: newSchemeData.schemeName.trim(),
      ratePerMT,
      ruleVersionId: `custom-scheme-${Date.now()}`,
      ruleVersion: 1
    }

    setFormData(prev => ({
      ...prev,
      editableSchemes: [...prev.editableSchemes, newScheme]
    }))

    setNewSchemeData({ schemeName: '', ratePerMT: '' })
    setNewSchemeDialogOpen(false)
    toast.success('Scheme added successfully')
  }

  const handleRemoveScheme = (index: number) => {
    setFormData(prev => ({
      ...prev,
      editableSchemes: prev.editableSchemes.filter((_, i) => i !== index)
    }))
    toast.success('Scheme removed successfully')
  }

  const handleUpdateSchemeRate = (index: number, newRate: number) => {
    setFormData(prev => ({
      ...prev,
      editableSchemes: prev.editableSchemes.map((s, i) =>
        i === index ? { ...s, ratePerMT: newRate } : s
      )
    }))
  }

  const handleSaveBooking = () => {
    if (!formData.supplierId || !formData.orderDate || !formData.consumeStartDate || !formData.bookedMT) {
      toast.error('Please fill all required fields')
      return
    }

    const bookedMT = parseFloat(formData.bookedMT)
    if (isNaN(bookedMT) || bookedMT <= 0) {
      toast.error('Please enter a valid Booked MT value')
      return
    }

    const bookedMarketRate = formData.bookedMarketRate.trim()
      ? parseFloat(formData.bookedMarketRate)
      : undefined

    if (bookedMarketRate !== undefined && (isNaN(bookedMarketRate) || bookedMarketRate <= 0)) {
      toast.error('Please enter a valid booking month market rate')
      return
    }

    const lockedSchemes = formData.editableSchemes.map(s => ({
      schemeId: s.schemeId,
      schemeName: s.schemeName,
      ratePerMT: s.ratePerMT,
      ruleVersionId: s.ruleVersionId || s.schemeId,
      ruleVersion: s.ruleVersion || 1,
      effectiveFrom: s.effectiveFrom,
      effectiveTo: s.effectiveTo
    }))
    
    const totalRate = lockedSchemes.reduce((sum, s) => sum + s.ratePerMT, 0)
    
    if (editingBooking) {
      setMTBookings(prev => prev.map(booking =>
        booking.id === editingBooking.id
          ? {
              ...booking,
              supplierId: formData.supplierId,
              orderDate: formData.orderDate,
              consumeStartDate: formData.consumeStartDate,
              bookedMT,
              bookedMarketRate,
              tieBreakPreference: formData.tieBreakPreference,
              manualSelection: formData.tieBreakPreference === 'manual' ? formData.manualSelection : undefined,
              notes: formData.notes,
              rateMode: 'auto',
              lockedSchemes,
              totalLockedRate: totalRate,
              manualRate: undefined
            }
          : booking
      ))
      toast.success('MT Booking updated successfully')
    } else {
      const newBooking: MTBooking = {
        id: `booking-${Date.now()}`,
        supplierId: formData.supplierId,
        orderDate: formData.orderDate,
        consumeStartDate: formData.consumeStartDate,
        bookedMT,
        bookedMarketRate,
        tieBreakPreference: formData.tieBreakPreference,
        manualSelection: formData.tieBreakPreference === 'manual' ? formData.manualSelection : undefined,
        notes: formData.notes,
        fy: currentFY,
        rateMode: 'auto',
        lockedSchemes,
        totalLockedRate: totalRate
      }
      setMTBookings(prev => [...prev, newBooking])
      toast.success('MT Booking created successfully')
    }

    setDialogOpen(false)
  }

  const handleDeleteClick = (booking: MTBooking) => {
    setBookingToDelete(booking)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (!bookingToDelete) return

    setMTBookings(prev => prev.filter(b => b.id !== bookingToDelete.id))
    toast.success('MT Booking deleted successfully')
    setDeleteDialogOpen(false)
    setBookingToDelete(null)
  }

  const filteredBookings = useMemo(() => {
    let filtered = [...enrichedBookings]

    if (filterSupplier !== 'all') {
      filtered = filtered.filter(b => b.supplierId === filterSupplier)
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus)
    }

    return filtered
  }, [enrichedBookings, filterSupplier, filterStatus])

  const sortedBookings = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
      const dateA = new Date(a.orderDate).getTime()
      const dateB = new Date(b.orderDate).getTime()
      return dateB - dateA
    })
  }, [filteredBookings])

  const handleClearFilters = () => {
    setFilterSupplier('all')
    setFilterStatus('all')
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterSupplier !== 'all') count++
    if (filterStatus !== 'all') count++
    return count
  }, [filterSupplier, filterStatus])

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')
    const pageWidth = doc.internal.pageSize.getWidth()
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('MT Booking Report', pageWidth / 2, 15, { align: 'center' })
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Financial Year: ${currentFY}`, pageWidth / 2, 22, { align: 'center' })
    
    let yPos = 30
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Filters Applied:', 14, yPos)
    yPos += 5
    
    doc.setFont('helvetica', 'normal')
    const supplierName = filterSupplier === 'all' ? 'All Suppliers' : getSupplierName(filterSupplier)
    doc.text(`Supplier: ${supplierName}`, 14, yPos)
    yPos += 5
    doc.text(`Status: ${filterStatus === 'all' ? 'All Status' : filterStatus}`, 14, yPos)
    yPos += 8
    
    const tableData = sortedBookings.map(booking => {
      let schemeNames = 'No scheme'
      if (booking.rateMode === 'manual') {
        schemeNames = 'Manual Entry'
      } else if (booking.lockedSchemes && booking.lockedSchemes.length > 0) {
        schemeNames = booking.lockedSchemes.map(s => s.schemeName).join(', ')
      }
      
      return [
        getSupplierName(booking.supplierId),
        formatDate(booking.orderDate),
        formatDate(booking.consumeStartDate),
        booking.bookedMT.toFixed(3),
        booking.consumedMT.toFixed(3),
        booking.remainingMT.toFixed(3),
        booking.bookedMarketRate ? formatCurrencyForPDF(booking.bookedMarketRate) : 'Legacy',
        schemeNames,
        booking.totalLockedRate ? formatCurrencyForPDF(booking.totalLockedRate) : '-',
        getTieBreakLabel(booking.tieBreakPreference || 'current'),
        booking.status
      ]
    })
    
    autoTable(doc, {
      startY: yPos,
      head: [['Supplier', 'Order Date', 'Consume From', 'Booked MT', 'Consumed MT', 'Remaining MT', 'Booked Rate', 'Locked Scheme', 'Scheme Rate', 'Tie Break', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8
      },
      columnStyles: {
        0: { halign: 'left', cellWidth: 35 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 24 },
        7: { halign: 'left', cellWidth: 40 },
        8: { halign: 'right', cellWidth: 22 },
        9: { halign: 'center', cellWidth: 24 },
        10: { halign: 'center', cellWidth: 18 }
      },
      margin: { left: 14, right: 14 }
    })
    
    const finalY = (doc as any).lastAutoTable.finalY || yPos + 20
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total Bookings: ${sortedBookings.length}`, 14, finalY + 10)
    doc.text(`Active: ${sortedBookings.filter(b => b.status === 'Active').length}`, 14, finalY + 15)
    doc.text(`Consumed: ${sortedBookings.filter(b => b.status === 'Consumed').length}`, 14, finalY + 20)
    
    const totalBookedMT = sortedBookings.reduce((sum, b) => sum + b.bookedMT, 0)
    const totalConsumedMT = sortedBookings.reduce((sum, b) => sum + b.consumedMT, 0)
    const totalRemainingMT = sortedBookings.reduce((sum, b) => sum + b.remainingMT, 0)
    
    doc.text(`Total Booked MT: ${totalBookedMT.toFixed(3)}`, pageWidth - 80, finalY + 10)
    doc.text(`Total Consumed MT: ${totalConsumedMT.toFixed(3)}`, pageWidth - 80, finalY + 15)
    doc.text(`Total Remaining MT: ${totalRemainingMT.toFixed(3)}`, pageWidth - 80, finalY + 20)
    
    const fileName = `MT_Booking_Report_${currentFY}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    toast.success('PDF report downloaded successfully')
  }

  return (
    <div className="space-y-responsive-lg">
      <Card className="card-spacing-responsive shadow-professional">
        <div className="flex items-center justify-between mb-responsive-md">
          <div className="flex items-center gap-responsive-sm">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary via-accent to-primary/80 flex items-center justify-center shadow-md">
              <BookBookmark className="h-6 w-6 text-primary-foreground" weight="duotone" />
            </div>
            <div>
              <h2 className="text-responsive-xl font-bold text-foreground">MT Booking Master</h2>
              <p className="text-responsive-sm text-muted-foreground">
                Compare booking-month and invoice-month rates before applying scheme benefits
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenAddDialog}
            disabled={isLocked}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Booking
          </Button>
        </div>

        {isLocked && (
          <div className="mb-responsive-md p-responsive-sm bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-900" weight="fill" />
            <span className="text-responsive-sm text-amber-900 font-medium">
              Data is locked - Read-only mode
            </span>
          </div>
        )}

        <div className="mb-responsive-md flex flex-wrap items-center gap-responsive-sm">
          <div className="flex items-center gap-2">
            <Funnel className="h-4 w-4 text-muted-foreground" weight="duotone" />
            <span className="text-responsive-sm font-semibold text-foreground">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-responsive-xs text-muted-foreground">Supplier:</Label>
            <Select value={filterSupplier} onValueChange={setFilterSupplier}>
              <SelectTrigger className="w-48 h-9 text-responsive-sm">
                <SelectValue />
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
            <Label className="text-responsive-xs text-muted-foreground">Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 h-9 text-responsive-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Consumed">Consumed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="gap-2 h-9"
            >
              <X className="h-3.5 w-3.5" />
              Clear Filters
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFiltersCount}
              </Badge>
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-responsive-xs text-muted-foreground">
              Showing <strong>{sortedBookings.length}</strong> of <strong>{enrichedBookings.length}</strong> bookings
            </span>
            
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={sortedBookings.length === 0}
                className="gap-2 h-9"
                title="Export to PDF"
              >
                <FilePdf className="h-4 w-4" weight="duotone" />
                <span className="hidden sm:inline text-responsive-xs">PDF</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-responsive-sm">Supplier</TableHead>
                <TableHead className="text-responsive-sm">Order Date</TableHead>
                <TableHead className="text-responsive-sm">Consume From</TableHead>
                <TableHead className="text-responsive-sm text-right">Booked MT</TableHead>
                <TableHead className="text-responsive-sm text-right">Consumed MT</TableHead>
                <TableHead className="text-responsive-sm text-right">Remaining MT</TableHead>
                <TableHead className="text-responsive-sm text-right">Booked Rate</TableHead>
                <TableHead className="text-responsive-sm">Locked Scheme</TableHead>
                <TableHead className="text-responsive-sm text-right">Rate per MT</TableHead>
                <TableHead className="text-responsive-sm">Tie Break</TableHead>
                <TableHead className="text-responsive-sm">Status</TableHead>
                <TableHead className="text-responsive-sm text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground text-responsive-sm">
                    No MT bookings found. Click "Add Booking" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                sortedBookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium text-responsive-sm">
                      {getSupplierName(booking.supplierId)}
                    </TableCell>
                    <TableCell className="text-responsive-sm">
                      {formatDate(booking.orderDate)}
                    </TableCell>
                    <TableCell className="text-responsive-sm">
                      {formatDate(booking.consumeStartDate)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-responsive-sm">
                      {booking.bookedMT.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-responsive-sm">
                      {booking.consumedMT.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-responsive-sm">
                      {booking.remainingMT.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-responsive-sm">
                      {booking.bookedMarketRate ? formatCurrency(booking.bookedMarketRate) : (
                        <span className="text-muted-foreground font-sans">Legacy</span>
                      )}
                    </TableCell>
                    <TableCell className="text-responsive-sm">
                      {booking.lockedSchemes && booking.lockedSchemes.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {booking.lockedSchemes.map((scheme, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-primary" weight="fill" />
                              <span>{scheme.schemeName}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No scheme</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-responsive-sm">
                      {booking.totalLockedRate ? formatCurrency(booking.totalLockedRate) : '-'}
                    </TableCell>
                    <TableCell className="text-responsive-sm">
                      <span className="text-muted-foreground">
                        {getTieBreakLabel(booking.tieBreakPreference || 'current')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={booking.status === 'Active' ? 'default' : 'secondary'}
                        className="text-responsive-xs"
                      >
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditDialog(booking)}
                          disabled={isLocked}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(booking)}
                          disabled={isLocked}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-responsive-md pt-responsive-md border-t border-border">
          <p className="text-responsive-sm text-muted-foreground">
            <strong>Total Bookings:</strong> {sortedBookings.length} |{' '}
            <strong>Active:</strong> {sortedBookings.filter(b => b.status === 'Active').length} |{' '}
            <strong>Consumed:</strong> {sortedBookings.filter(b => b.status === 'Consumed').length}
          </p>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="modal-content max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookBookmark className="h-5 w-5 text-primary" weight="duotone" />
              {editingBooking ? 'Edit MT Booking' : 'Add New MT Booking'}
            </DialogTitle>
            <DialogDescription>
              Book MT with market-rate comparison and versioned scheme benefits
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-responsive-md">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="modal-label">
                Supplier <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) => {
                  setFormData(prev => {
                    if (prev.orderDate) {
                      const { schemes } = getActiveSchemesForDate(value, prev.orderDate)
                      return { ...prev, supplierId: value, editableSchemes: schemes }
                    }
                    return { ...prev, supplierId: value }
                  })
                }}
              >
                <SelectTrigger id="supplier" className="modal-input">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 ? (
                    <SelectItem value="no-suppliers" disabled>
                      No suppliers available
                    </SelectItem>
                  ) : (
                    suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-date" className="modal-label">
                Order Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="order-date"
                type="date"
                value={formData.orderDate}
                onChange={(e) => handleOrderDateChange(e.target.value)}
                className="modal-input"
              />
              <p className="text-xs text-muted-foreground">
                Schemes will be fetched automatically based on this date
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consume-start-date" className="modal-label">
                Consume Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="consume-start-date"
                type="date"
                value={formData.consumeStartDate}
                onChange={(e) => setFormData(prev => ({ ...prev, consumeStartDate: e.target.value }))}
                className="modal-input"
              />
              <p className="text-xs text-muted-foreground">
                Only invoices from this date onwards can consume this booking
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="booked-mt" className="modal-label">
                Booked MT <span className="text-destructive">*</span>
              </Label>
              <Input
                id="booked-mt"
                type="number"
                step="0.001"
                placeholder="0.000"
                value={formData.bookedMT}
                onChange={(e) => setFormData(prev => ({ ...prev, bookedMT: e.target.value }))}
                className="modal-input font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="booked-market-rate" className="modal-label">
                Previous Month Market Rate (₹/MT)
              </Label>
              <Input
                id="booked-market-rate"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.bookedMarketRate}
                onChange={(e) => setFormData(prev => ({ ...prev, bookedMarketRate: e.target.value }))}
                className="modal-input font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Used at invoice time to decide whether booking-month or current-month benefit wins.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tie-break-preference" className="modal-label">
                  Equal Price Tie-Break
                </Label>
                <Select
                  value={formData.tieBreakPreference}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    tieBreakPreference: value as MTBookingTieBreakPreference
                  }))}
                >
                  <SelectTrigger id="tie-break-preference" className="modal-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current month rules</SelectItem>
                    <SelectItem value="previous">Previous month rules</SelectItem>
                    <SelectItem value="highestBenefit">Highest cashback benefit</SelectItem>
                    <SelectItem value="manual">Manually approved selection</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.tieBreakPreference === 'manual' && (
                <div className="space-y-2">
                  <Label htmlFor="manual-selection" className="modal-label">
                    Manual Selection
                  </Label>
                  <Select
                    value={formData.manualSelection}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      manualSelection: value as 'current' | 'previous'
                    }))}
                  >
                    <SelectTrigger id="manual-selection" className="modal-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current month rules</SelectItem>
                      <SelectItem value="previous">Previous month rules</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="modal-label">
                Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="modal-input resize-none"
                rows={3}
              />
            </div>

            {formData.supplierId && formData.orderDate && (
              <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Locked Schemes:</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewSchemeDialogOpen(true)}
                    className="gap-2 h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Scheme
                  </Button>
                </div>
                
                {formData.editableSchemes.length > 0 ? (
                  <div className="space-y-2">
                    {formData.editableSchemes.map((scheme, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded border border-border">
                        <Lock className="h-3.5 w-3.5 text-primary flex-shrink-0" weight="fill" />
                        <span className="text-sm flex-1 font-medium">{scheme.schemeName}</span>
                        <span className="text-xs text-muted-foreground">Rate:</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={scheme.ratePerMT}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value) || 0
                            handleUpdateSchemeRate(idx, newRate)
                          }}
                          className="h-8 w-28 text-sm font-mono"
                          placeholder="0.00"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveScheme(idx)}
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">Total Rate per MT:</span>
                        <span className="text-base font-bold text-primary font-mono">
                          {formatCurrency(formData.editableSchemes.reduce((sum, s) => sum + s.ratePerMT, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      No schemes added yet. Click "Add Scheme" to add one.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBooking}>
              {editingBooking ? 'Update' : 'Create'} Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newSchemeDialogOpen} onOpenChange={setNewSchemeDialogOpen}>
        <DialogContent className="modal-content max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add New Scheme
            </DialogTitle>
            <DialogDescription>
              Add a custom scheme with a specific rate per MT
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scheme-name">
                Scheme Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scheme-name"
                type="text"
                value={newSchemeData.schemeName}
                onChange={(e) => setNewSchemeData(prev => ({ ...prev, schemeName: e.target.value }))}
                placeholder="e.g., Special Support"
                className="modal-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheme-rate">
                Rate per MT <span className="text-destructive">*</span>
              </Label>
              <Input
                id="scheme-rate"
                type="number"
                step="0.01"
                value={newSchemeData.ratePerMT}
                onChange={(e) => setNewSchemeData(prev => ({ ...prev, ratePerMT: e.target.value }))}
                placeholder="0.00"
                className="modal-input font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setNewSchemeDialogOpen(false)
              setNewSchemeData({ schemeName: '', ratePerMT: '' })
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddScheme}>
              Add Scheme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash className="h-5 w-5 text-destructive" />
              Delete MT Booking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this MT booking?
              {bookingToDelete && (
                <div className="mt-3 p-3 bg-muted rounded-lg space-y-1 text-xs">
                  <p><strong>Supplier:</strong> {getSupplierName(bookingToDelete.supplierId)}</p>
                  <p><strong>Order Date:</strong> {formatDate(bookingToDelete.orderDate)}</p>
                  <p><strong>Booked MT:</strong> {bookingToDelete.bookedMT.toFixed(3)}</p>
                </div>
              )}
              <p className="mt-3 text-destructive font-semibold">
                This action cannot be undone and will affect discount calculations.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
