import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, PurchaseInvoice, SalesInvoice, PurchaseReturn, SalesReturn } from '@/lib/types'
import { calculateInventoryReport, InventoryData } from '@/lib/report-calculations'
import { formatCurrency, formatMT } from '@/lib/calculations'
import { Package, TrendUp, TrendDown, FilePdf } from '@phosphor-icons/react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from 'sonner'

interface InventoryReportPageProps {
  items: Item[]
  purchaseInvoices: PurchaseInvoice[]
  salesInvoices: SalesInvoice[]
  purchaseReturns?: PurchaseReturn[]
  salesReturns?: SalesReturn[]
  currentFY: string
  businessName?: string
}

export default function InventoryReportPage({
  items,
  purchaseInvoices,
  salesInvoices,
  purchaseReturns = [],
  salesReturns = [],
  currentFY,
  businessName = 'Steel Trading ERP'
}: InventoryReportPageProps) {
  const inventoryData = useMemo(() => {
    return calculateInventoryReport(items, purchaseInvoices, salesInvoices, purchaseReturns, salesReturns)
  }, [items, purchaseInvoices, salesInvoices, purchaseReturns, salesReturns])


  const totals = useMemo(() => {
    return inventoryData.reduce(
      (acc, item) => ({
        totalPurchaseMT: acc.totalPurchaseMT + item.totalPurchaseMT,
        totalSalesMT: acc.totalSalesMT + item.totalSalesMT,
        balanceMT: acc.balanceMT + item.balanceMT,
        totalStockValue: acc.totalStockValue + item.currentStockValue
      }),
      { totalPurchaseMT: 0, totalSalesMT: 0, balanceMT: 0, totalStockValue: 0 }
    )
  }, [inventoryData])

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')
    
    const formatAmount = (amount: number): string => {
      const val = Number.isFinite(Number(amount)) ? Number(amount) : 0
      const formatted = val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return `Rs.${formatted}`
    }
    
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(businessName, 14, 15)
    
    doc.setFontSize(14)
    doc.text('Inventory Report', 14, 23)
    
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
    doc.text('Total Purchase:', 16, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(totals.totalPurchaseMT), 16, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total Sales:', 70, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(totals.totalSalesMT), 70, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Closing Stock:', 120, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(totals.balanceMT), 120, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Stock Value:', 180, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatAmount(totals.totalStockValue), 180, yPos + 15)

    const tableData = inventoryData.map(item => {
      const secUnit = item.secondaryUnit
      const fmt = (primaryQty: number, secQty?: number) => {
        const prim = `${primaryQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${item.unit}`
        if (secUnit && secUnit !== item.unit && typeof secQty === 'number') {
          const sec = secQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })
          return `${prim} (${sec} ${secUnit})`
        }
        return prim
      }

      return [
        item.itemName,
        secUnit && secUnit !== item.unit ? `${item.unit} / ${secUnit}` : item.unit,
        item.openingStockMT > 0 ? fmt(item.openingStockMT, item.secondaryOpeningStock) : '-',
        fmt(item.totalPurchaseMT, item.secondaryTotalPurchase),
        fmt(item.totalSalesMT, item.secondaryTotalSales),
        fmt(item.balanceMT, item.secondaryBalance),
        formatAmount(item.avgPurchaseRate),
        formatAmount(item.avgSalesRate),
        formatAmount(item.currentStockValue)
      ]
    })

    autoTable(doc, {
      startY: yPos + 24,
      head: [['Item Name', 'Unit', 'Opening', 'Purchased', 'Sold', 'Balance', 'Avg Purch Rate', 'Avg Sales Rate', 'Stock Value']],
      body: tableData.length > 0 ? tableData : [['No inventory data', '', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })

    const fileName = `Inventory_Report_${currentFY}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
    toast.success('PDF exported successfully')
  }

  const categories = useMemo(() => {
    return Array.from(new Set(inventoryData.map(i => i.category || 'Uncategorized').filter(Boolean)))
  }, [inventoryData])

  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredInventoryData = useMemo(() => {
    if (selectedCategory === 'all') return inventoryData
    return inventoryData.filter(i => (i.category || 'Uncategorized') === selectedCategory)
  }, [inventoryData, selectedCategory])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Stock Report</h2>
          <p className="text-sm text-slate-500 mt-1">
            Category-wise inventory position, purchases (+), sales (-), and stock valuation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none shadow-2xs"
          >
            <option value="all">All Categories ({inventoryData.length} items)</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({inventoryData.filter(i => (i.category || 'Uncategorized') === cat).length})
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2 font-semibold"
            disabled={inventoryData.length === 0}
          >
            <FilePdf className="h-4 w-4 text-red-600" />
            Export PDF
          </Button>
          <Badge variant="outline" className="text-sm px-3 py-1.5 font-mono">
            {currentFY}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Purchases</CardTitle>
            <TrendUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-extrabold text-slate-900">{formatMT(totals.totalPurchaseMT)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Sales</CardTitle>
            <TrendDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-extrabold text-slate-900">{formatMT(totals.totalSalesMT)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Closing Stock Balance</CardTitle>
            <Package className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-extrabold text-slate-900">{formatMT(totals.balanceMT)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Stock Value</CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-extrabold text-slate-900">{formatCurrency(totals.totalStockValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-2xs overflow-hidden">
        <CardHeader className="bg-slate-50/80 border-b border-slate-200 py-4">
          <CardTitle className="text-base font-bold text-slate-900">Category & Item-wise Inventory Report</CardTitle>
          <CardDescription>Purchases (+), Sales (-), and remaining balance grouped by item & category</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-slate-700">Item Name</TableHead>
                <TableHead className="font-bold text-slate-700">Category</TableHead>
                <TableHead className="font-bold text-slate-700">Unit</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Opening Stock</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Purchased (+)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Sold (-)</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Balance Stock</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Avg Purchase Rate</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Stock Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventoryData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-400 py-8 font-medium">
                    No inventory data available for this category
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventoryData.map((item) => {
                  const secUnit = item.secondaryUnit
                  
                  const renderQtyWithAlt = (primaryQty: number, secQty?: number, colorClass?: string, prefix: string = '') => {
                    if (primaryQty === 0 && prefix === '') return '-'
                    const primaryStr = `${prefix}${primaryQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${item.unit}`
                    let secStr: string | null = null

                    if (secUnit && secUnit !== item.unit && typeof secQty === 'number') {
                      secStr = `${prefix}${secQty.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${secUnit}`
                    }

                    return (
                      <div className="flex flex-col items-end">
                        <span className={`font-mono ${colorClass || 'text-slate-900 font-semibold'}`}>
                          {primaryStr}
                        </span>
                        {secStr && (
                          <span className="font-mono text-[10px] text-slate-500 font-medium">
                            ({secStr})
                          </span>
                        )}
                      </div>
                    )
                  }

                  return (
                    <TableRow key={item.itemId} className="hover:bg-slate-50/80">
                      <TableCell className="font-bold text-slate-900">{item.itemName}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
                          {item.category || 'General'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="font-mono text-xs w-fit">{item.unit}</Badge>
                          {secUnit && secUnit !== item.unit && (
                            <span className="text-[10px] text-slate-500 font-mono">Alt: {secUnit}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {renderQtyWithAlt(item.openingStockMT, item.secondaryOpeningStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderQtyWithAlt(item.totalPurchaseMT, item.secondaryTotalPurchase, 'text-emerald-700 font-bold', '+')}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderQtyWithAlt(item.totalSalesMT, item.secondaryTotalSales, 'text-blue-700 font-bold', '-')}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderQtyWithAlt(item.balanceMT, item.secondaryBalance, item.balanceMT < 0 ? 'text-red-600 font-bold' : 'text-slate-900 font-bold')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.avgPurchaseRate)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.currentStockValue)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
