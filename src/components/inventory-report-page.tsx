import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, PurchaseInvoice, SalesInvoice } from '@/lib/types'
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
  currentFY: string
  businessName?: string
}

export default function InventoryReportPage({
  items,
  purchaseInvoices,
  salesInvoices,
  currentFY,
  businessName = 'Steel Trading ERP'
}: InventoryReportPageProps) {
  const inventoryData = useMemo(() => {
    return calculateInventoryReport(items, purchaseInvoices, salesInvoices)
  }, [items, purchaseInvoices, salesInvoices])

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
      const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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

    const tableData = inventoryData.map(item => [
      item.itemName,
      item.unit,
      item.openingStockMT > 0 ? formatMT(item.openingStockMT) : '-',
      formatMT(item.totalPurchaseMT),
      formatMT(item.totalSalesMT),
      formatMT(item.balanceMT),
      formatAmount(item.avgPurchaseRate),
      formatAmount(item.avgSalesRate),
      formatAmount(item.currentStockValue)
    ])

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Inventory Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Current stock position and valuation
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2"
            disabled={inventoryData.length === 0}
          >
            <FilePdf className="h-4 w-4" />
            Export PDF
          </Button>
          <Badge variant="outline" className="text-sm px-3 py-1.5 font-mono">
            {currentFY}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            <TrendUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{formatMT(totals.totalPurchaseMT)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{formatMT(totals.totalSalesMT)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{formatMT(totals.balanceMT)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-semibold">{formatCurrency(totals.totalStockValue)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Item-wise Stock Summary</CardTitle>
          <CardDescription>Detailed inventory position by item</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Opening Stock</TableHead>
                <TableHead className="text-right">Purchased</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Avg Purchase Rate</TableHead>
                <TableHead className="text-right">Avg Sales Rate</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No inventory data available
                  </TableCell>
                </TableRow>
              ) : (
                inventoryData.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-medium">{item.itemName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.unit}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.openingStockMT > 0 ? formatMT(item.openingStockMT) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMT(item.totalPurchaseMT)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatMT(item.totalSalesMT)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={item.balanceMT < 0 ? 'text-destructive' : ''}>
                        {formatMT(item.balanceMT)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.avgPurchaseRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(item.avgSalesRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(item.currentStockValue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
