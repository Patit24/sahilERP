import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PurchaseInvoice, Payment, Supplier } from '@/lib/types'
import { calculateCDAtRisk } from '@/lib/report-calculations'
import { calculatePaymentAllocations, formatCurrency, formatMT } from '@/lib/calculations'
import { Warning, Clock, TrendDown, CaretDown, FilePdf } from '@phosphor-icons/react'
import { format } from 'date-fns'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { motion, AnimatePresence } from 'framer-motion'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface CDAtRiskReportPageProps {
  purchaseInvoices: PurchaseInvoice[]
  payments: Payment[]
  suppliers: Supplier[]
  currentFY: string
  businessName?: string
}

export default function CDAtRiskReportPage({
  purchaseInvoices,
  payments,
  suppliers,
  currentFY,
  businessName = 'Steel Trading ERP'
}: CDAtRiskReportPageProps) {
  const [ineligibleOpen, setIneligibleOpen] = useState(false)
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([])
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false)

  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(() => {
    return calculatePaymentAllocations(payments, purchaseInvoices)
  }, [payments, purchaseInvoices])

  const cdAtRiskData = useMemo(() => {
    const allData = calculateCDAtRisk(purchaseInvoices, payments, paymentAllocations, suppliers)
    
    if (selectedSuppliers.length === 0) {
      return allData
    }
    
    return allData.filter(d => selectedSuppliers.includes(d.supplierId))
  }, [purchaseInvoices, payments, paymentAllocations, suppliers, selectedSuppliers])

  const { eligibleInvoices, ineligibleInvoices } = useMemo(() => {
    const eligible = cdAtRiskData.filter(d => d.totalCDAtRisk > 0)
    const ineligible = cdAtRiskData.filter(d => d.totalCDAtRisk === 0)
    return { eligibleInvoices: eligible, ineligibleInvoices: ineligible }
  }, [cdAtRiskData])

  const summary = useMemo(() => {
    const totalAtRisk = eligibleInvoices.reduce((sum, d) => sum + d.totalCDAtRisk, 0)
    const totalPaymentCDAtCurrentSlab = eligibleInvoices.reduce((sum, d) => sum + d.totalPaymentCDAtCurrentSlab, 0)
    const totalInvoiceCDRisk = eligibleInvoices.reduce((sum, d) => sum + d.invoiceCloseCDRisk, 0)
    const totalPending = cdAtRiskData.reduce((sum, d) => sum + d.pendingAmount, 0)
    const criticalCount = eligibleInvoices.filter(d => d.totalCDAtRisk > 10000).length

    return {
      totalAtRisk,
      totalPaymentCDAtCurrentSlab,
      totalInvoiceCDRisk,
      totalPending,
      criticalCount,
      totalEligible: eligibleInvoices.length,
      totalIneligible: ineligibleInvoices.length
    }
  }, [cdAtRiskData, eligibleInvoices, ineligibleInvoices])

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')
    
    const formatAmount = (amount: number): string => {
      return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(businessName, 14, 15)
    
    doc.setFontSize(14)
    doc.text('CD at Risk Report', 14, 23)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Financial Year: ${currentFY}`, 14, 30)
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 35)
    
    const yPos = 42
    doc.setFillColor(245, 245, 250)
    doc.rect(14, yPos, 268, 20, 'F')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMMARY', 16, yPos + 5)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL CD RISK:', 16, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Rs ${formatAmount(summary.totalPaymentCDAtCurrentSlab)}`, 16, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice CD Loss:', 80, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Rs ${formatAmount(summary.totalInvoiceCDRisk)}`, 80, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Pending Amount:', 145, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Rs ${formatAmount(summary.totalPending)}`, 145, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Eligible Invoices:', 210, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(summary.totalEligible.toString(), 210, yPos + 15)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Eligible Invoices - CD Available', 14, yPos + 26)

    const eligibleTableData = eligibleInvoices.map(data => [
      data.invoiceNo,
      data.supplierName,
      format(new Date(data.invoiceDate), 'dd MMM yyyy'),
      `${data.daysSinceInvoice}d`,
      formatAmount(data.pendingAmount),
      `${formatAmount(data.totalPaymentCDAtCurrentSlab)} (${data.currentSlabPaymentCDRate}%)`,
      `${formatAmount(data.invoiceCloseCDRisk)} (Rs ${data.currentSlabInvoiceCloseCDRate}/MT → Rs ${data.nextSlabInvoiceCloseCDRate}/MT)`,
      formatAmount(data.totalCDAtRisk),
      data.nextSlabDays > 0 ? `${data.nextSlabDays}d` : 'Max',
      data.nextSlabPaymentCDRate > 0 ? `${data.nextSlabPaymentCDRate}%` : '-'
    ])

    autoTable(doc, {
      startY: yPos + 28,
      head: [['Invoice No', 'Supplier', 'Date', 'Days', 'Pending (Rs)', 'TOTAL CD RISK (Rs)', 'Invoice CD Loss (Rs)', 'CURRENT SLAB RISK (Rs)', 'Next Slab', 'Next CD %']],
      body: eligibleTableData.length > 0 ? eligibleTableData : [['No eligible invoices', '', '', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 23, halign: 'left' },
        1: { cellWidth: 35, halign: 'left' },
        2: { cellWidth: 23, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 27, halign: 'right' },
        5: { cellWidth: 32, halign: 'right' },
        6: { cellWidth: 37, halign: 'right' },
        7: { cellWidth: 27, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 18, halign: 'center' },
        9: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })

    const finalY = (doc as any).lastAutoTable.finalY + 10

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Ineligible Invoices - CD Expired', 14, finalY)

    const ineligibleTableData = ineligibleInvoices.map(data => [
      data.invoiceNo,
      data.supplierName,
      format(new Date(data.invoiceDate), 'dd MMM yyyy'),
      `${data.daysSinceInvoice}d`,
      formatAmount(data.pendingAmount),
      'CD Expired'
    ])

    autoTable(doc, {
      startY: finalY + 2,
      head: [['Invoice No', 'Supplier', 'Date', 'Days', 'Pending (Rs)', 'Status']],
      body: ineligibleTableData.length > 0 ? ineligibleTableData : [['No ineligible invoices', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 40, halign: 'right' },
        5: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })

    const fileName = `CD_at_Risk_${currentFY}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    toast.success('PDF exported successfully')
  }

  const handleExportExcel = () => {
    const eligibleData = eligibleInvoices.map(data => ({
      invoiceId: data.invoiceId,
      invoiceNo: data.invoiceNo,
      invoiceDate: data.invoiceDate,
      supplierName: data.supplierName,
      invoiceAmount: data.invoiceAmount,
      paidAmount: data.paidAmount,
      pendingAmount: data.pendingAmount,
      lastPaymentDate: null,
      daysElapsed: data.daysSinceInvoice,
      currentSlabDays: data.daysSinceInvoice,
      currentCDRate: data.currentSlabPaymentCDRate,
      nextSlabDays: data.nextSlabDays || null,
      nextCDRate: data.nextSlabPaymentCDRate || null,
      daysToNextSlab: data.nextSlabDays || null,
      currentCDEarned: data.paymentCDRisk + data.invoiceCloseCDRisk,
      potentialCDLoss: data.totalCDAtRisk,
      status: data.totalCDAtRisk > 10000 ? 'Critical' : 'At Risk'
    }))

    const ineligibleData = ineligibleInvoices.map(data => ({
      invoiceId: data.invoiceId,
      invoiceNo: data.invoiceNo,
      invoiceDate: data.invoiceDate,
      supplierName: data.supplierName,
      invoiceAmount: data.invoiceAmount,
      paidAmount: data.paidAmount,
      pendingAmount: data.pendingAmount,
      lastPaymentDate: null,
      daysElapsed: data.daysSinceInvoice,
      currentSlabDays: 0,
      currentCDRate: 0,
      status: 'CD Expired'
    }))

    toast.success('Excel export not available')
  }

  const handleToggleSupplier = (supplierId: string) => {
    setSelectedSuppliers(prev => 
      prev.includes(supplierId) 
        ? prev.filter(id => id !== supplierId)
        : [...prev, supplierId]
    )
  }

  const handleSelectAllSuppliers = () => {
    if (selectedSuppliers.length === suppliers.length) {
      setSelectedSuppliers([])
    } else {
      setSelectedSuppliers(suppliers.map(s => s.id))
    }
  }

  const handleClearSupplierFilter = () => {
    setSelectedSuppliers([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">CD at Risk Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Potential discount loss on pending payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2"
            disabled={cdAtRiskData.length === 0}
          >
            <FilePdf className="h-4 w-4" />
            Export PDF
          </Button>
          <Badge variant="outline" className="text-sm px-3 py-1.5 font-mono">
            {currentFY}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Supplier:</span>
              <Popover open={supplierFilterOpen} onOpenChange={setSupplierFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 min-w-[200px] justify-between",
                      selectedSuppliers.length > 0 && "border-primary"
                    )}
                  >
                    <span className="truncate">
                      {selectedSuppliers.length === 0
                        ? "All Suppliers"
                        : selectedSuppliers.length === suppliers.length
                        ? "All Suppliers"
                        : `${selectedSuppliers.length} selected`}
                    </span>
                    <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search supplier..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={handleSelectAllSuppliers}
                          className="font-medium"
                        >
                          <Checkbox
                            checked={selectedSuppliers.length === suppliers.length}
                            className="mr-2"
                          />
                          Select All
                        </CommandItem>
                        {suppliers.map((supplier) => (
                          <CommandItem
                            key={supplier.id}
                            onSelect={() => handleToggleSupplier(supplier.id)}
                          >
                            <Checkbox
                              checked={selectedSuppliers.includes(supplier.id)}
                              className="mr-2"
                            />
                            {supplier.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedSuppliers.length > 0 && selectedSuppliers.length < suppliers.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSupplierFilter}
                  className="h-8 px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">TOTAL CD RISK</CardTitle>
            <TrendDown className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold text-warning">
              {formatCurrency(summary.totalPaymentCDAtCurrentSlab)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payment CD at risk
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <TrendDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">
              {formatCurrency(summary.totalPending)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unpaid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Invoices</CardTitle>
            <Warning className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold text-destructive">
              {summary.criticalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              CD at risk &gt; ₹10,000
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eligible Invoices</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{summary.totalEligible}</div>
            <p className="text-xs text-muted-foreground mt-1">
              With CD still available
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eligible Invoices - CD Available</CardTitle>
          <CardDescription>Invoices still within CD slab period - immediate action required</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead className="text-right">Days</TableHead>
                <TableHead className="text-right">Pending Amt</TableHead>
                <TableHead className="text-right">TOTAL CD RISK</TableHead>
                <TableHead className="text-right">Invoice CD Loss</TableHead>
                <TableHead className="text-right">CURRENT SLAB RISK</TableHead>
                <TableHead className="text-right">Next Slab</TableHead>
                <TableHead className="text-right">Next CD %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibleInvoices.length === 0 ? (
                <TableRow>
                    No eligible invoices - all invoices paid or no CD available
                    No eligible invoices - all invoices paid or no CD available
                </TableRow>
              ) : (
                eligibleInvoices.map((data) => (
                  <TableRow key={data.invoiceId}>
                    <TableCell className="font-medium font-mono">{data.invoiceNo}</TableCell>
                    <TableCell>{data.supplierName}</TableCell>
                    <TableCell>{format(new Date(data.invoiceDate), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-right font-mono">
                      <Badge variant={data.daysSinceInvoice > 60 ? 'destructive' : data.daysSinceInvoice > 30 ? 'default' : 'outline'}>
                        {data.daysSinceInvoice}d
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(data.pendingAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(data.totalPaymentCDAtCurrentSlab)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({data.currentSlabPaymentCDRate}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(data.invoiceCloseCDRisk)}</span>
                        <span className="text-xs text-muted-foreground">
                          (₹{data.currentSlabInvoiceCloseCDRate}/MT → ₹{data.nextSlabInvoiceCloseCDRate}/MT)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      <span className={data.totalCDAtRisk > 10000 ? 'text-destructive' : 'text-warning'}>
                        {formatCurrency(data.totalCDAtRisk)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {data.nextSlabDays > 0 ? (
                        <Badge variant="outline" className="font-mono">
                          {data.nextSlabDays}d
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Max</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {data.nextSlabPaymentCDRate > 0 ? (
                        <span className="font-mono text-sm font-medium">
                          {data.nextSlabPaymentCDRate}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Collapsible open={ineligibleOpen} onOpenChange={setIneligibleOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <CardTitle className="flex items-center gap-2">
                    Ineligible Invoices - CD Expired
                    <Badge variant="secondary" className="ml-2">
                      {summary.totalIneligible}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Invoices that exceeded all CD slab periods - no discount available</CardDescription>
                </div>
                <motion.div
                  animate={{ rotate: ineligibleOpen ? 180 : 0 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <CaretDown className="h-5 w-5 text-muted-foreground" />
                </motion.div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <AnimatePresence initial={false}>
            {ineligibleOpen && (
              <CollapsibleContent forceMount asChild>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ 
                    height: "auto", 
                    opacity: 1,
                    transition: {
                      height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.25, ease: "easeOut", delay: 0.05 }
                    }
                  }}
                  exit={{ 
                    height: 0, 
                    opacity: 0,
                    transition: {
                      height: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
                      opacity: { duration: 0.15, ease: "easeIn" }
                    }
                  }}
                  className="overflow-hidden"
                >
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Invoice Date</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">Pending Amt</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ineligibleInvoices.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No ineligible invoices
                            </TableCell>
                          </TableRow>
                        ) : (
                          ineligibleInvoices.map((data) => (
                            <TableRow key={data.invoiceId}>
                              <TableCell className="font-medium font-mono">{data.invoiceNo}</TableCell>
                              <TableCell>{data.supplierName}</TableCell>
                              <TableCell>{format(new Date(data.invoiceDate), 'dd MMM yyyy')}</TableCell>
                              <TableCell className="text-right font-mono">
                                <Badge variant="outline">
                                  {data.daysSinceInvoice}d
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(data.pendingAmount)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary" className="text-xs">
                                  CD Expired
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Card>
      </Collapsible>
    </div>
  )
}
