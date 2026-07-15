import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Item, PurchaseInvoice, SalesInvoice, Supplier, Customer, ExpenseEntry, ExpenseType } from '@/lib/types'
import { Download, Package } from '@phosphor-icons/react'
import { exportItemReportToPDF } from '@/lib/pdf-export'

interface ItemReportsPageProps {
  items: Item[]
  purchaseInvoices: PurchaseInvoice[]
  salesInvoices: SalesInvoice[]
  suppliers: Supplier[]
  customers: Customer[]
  expenseEntries: ExpenseEntry[]
  expenseTypes: ExpenseType[]
  currentFY: string
  businessName?: string
}

interface ItemPurchaseDetail {
  itemId: string
  itemName: string
  totalQuantity: number
  totalAmount: number
  avgRate: number
  invoiceCount: number
  supplierCount: number
  firstPurchaseDate: string
  lastPurchaseDate: string
}

interface ItemSalesDetail {
  itemId: string
  itemName: string
  totalQuantity: number
  totalAmount: number
  avgRate: number
  invoiceCount: number
  customerCount: number
  firstSaleDate: string
  lastSaleDate: string
}

interface ItemTransactionDetail {
  date: string
  type: 'purchase' | 'sale'
  invoiceNo: string
  partyName: string
  quantity: number
  rate: number
  amount: number
}

interface InvoiceItemCostDetail {
  invoiceId: string
  invoiceNo: string
  invoiceDate: string
  supplierName: string
  itemId: string
  itemName: string
  quantity: number
  rate: number
  itemAmount: number
  linkedExpenses: number
  totalCost: number
  costPerMT: number
}

export default function ItemReportsPage({
  items,
  purchaseInvoices,
  salesInvoices,
  suppliers,
  customers,
  expenseEntries,
  expenseTypes,
  currentFY,
  businessName
}: ItemReportsPageProps) {
  const [selectedItemId, setSelectedItemId] = useState<string>('all')

  const purchaseDetails = useMemo(() => {
    const details = new Map<string, ItemPurchaseDetail>()
    
    purchaseInvoices.forEach(invoice => {
      if (!invoice.items || !Array.isArray(invoice.items)) return
      
      invoice.items.forEach(item => {
        const existingDetail = details.get(item.itemId)
        const itemData = items.find(i => i.id === item.itemId)
        const supplierIds = new Set(existingDetail?.supplierCount ? [invoice.supplierId] : [invoice.supplierId])
        
        if (existingDetail) {
          supplierIds.add(invoice.supplierId)
          details.set(item.itemId, {
            ...existingDetail,
            totalQuantity: existingDetail.totalQuantity + item.quantityMT,
            totalAmount: existingDetail.totalAmount + item.amount,
            avgRate: (existingDetail.totalAmount + item.amount) / (existingDetail.totalQuantity + item.quantityMT),
            invoiceCount: existingDetail.invoiceCount + 1,
            supplierCount: supplierIds.size,
            firstPurchaseDate: invoice.invoiceDate < existingDetail.firstPurchaseDate ? invoice.invoiceDate : existingDetail.firstPurchaseDate,
            lastPurchaseDate: invoice.invoiceDate > existingDetail.lastPurchaseDate ? invoice.invoiceDate : existingDetail.lastPurchaseDate
          })
        } else {
          details.set(item.itemId, {
            itemId: item.itemId,
            itemName: itemData?.name || 'Unknown',
            totalQuantity: item.quantityMT,
            totalAmount: item.amount,
            avgRate: item.rate,
            invoiceCount: 1,
            supplierCount: 1,
            firstPurchaseDate: invoice.invoiceDate,
            lastPurchaseDate: invoice.invoiceDate
          })
        }
      })
    })
    
    return Array.from(details.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [purchaseInvoices, items])

  const salesDetails = useMemo(() => {
    const details = new Map<string, ItemSalesDetail>()
    
    salesInvoices.forEach(invoice => {
      if (!invoice.items || !Array.isArray(invoice.items)) return
      
      invoice.items.forEach(item => {
        const existingDetail = details.get(item.itemId)
        const itemData = items.find(i => i.id === item.itemId)
        const customerIds = new Set(existingDetail?.customerCount ? [invoice.customerId] : [invoice.customerId])
        
        if (existingDetail) {
          customerIds.add(invoice.customerId)
          details.set(item.itemId, {
            ...existingDetail,
            totalQuantity: existingDetail.totalQuantity + item.quantityMT,
            totalAmount: existingDetail.totalAmount + item.amount,
            avgRate: (existingDetail.totalAmount + item.amount) / (existingDetail.totalQuantity + item.quantityMT),
            invoiceCount: existingDetail.invoiceCount + 1,
            customerCount: customerIds.size,
            firstSaleDate: invoice.invoiceDate < existingDetail.firstSaleDate ? invoice.invoiceDate : existingDetail.firstSaleDate,
            lastSaleDate: invoice.invoiceDate > existingDetail.lastSaleDate ? invoice.invoiceDate : existingDetail.lastSaleDate
          })
        } else {
          details.set(item.itemId, {
            itemId: item.itemId,
            itemName: itemData?.name || 'Unknown',
            totalQuantity: item.quantityMT,
            totalAmount: item.amount,
            avgRate: item.rate,
            invoiceCount: 1,
            customerCount: 1,
            firstSaleDate: invoice.invoiceDate,
            lastSaleDate: invoice.invoiceDate
          })
        }
      })
    })
    
    return Array.from(details.values()).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [salesInvoices, items])

  const itemTransactions = useMemo(() => {
    if (selectedItemId === 'all') return []
    
    const transactions: ItemTransactionDetail[] = []
    
    purchaseInvoices.forEach(invoice => {
      if (!invoice.items || !Array.isArray(invoice.items)) return
      
      const item = invoice.items.find(i => i.itemId === selectedItemId)
      if (item) {
        const supplier = suppliers.find(s => s.id === invoice.supplierId)
        transactions.push({
          date: invoice.invoiceDate,
          type: 'purchase',
          invoiceNo: invoice.invoiceNo,
          partyName: supplier?.name || 'Unknown',
          quantity: item.quantityMT,
          rate: item.rate,
          amount: item.amount
        })
      }
    })
    
    salesInvoices.forEach(invoice => {
      if (!invoice.items || !Array.isArray(invoice.items)) return
      
      const item = invoice.items.find(i => i.itemId === selectedItemId)
      if (item) {
        const customer = customers.find(c => c.id === invoice.customerId)
        transactions.push({
          date: invoice.invoiceDate,
          type: 'sale',
          invoiceNo: invoice.invoiceNo,
          partyName: customer?.name || 'Unknown',
          quantity: item.quantityMT,
          rate: item.rate,
          amount: item.amount
        })
      }
    })
    
    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [selectedItemId, purchaseInvoices, salesInvoices, suppliers, customers])

  const invoiceItemCosts = useMemo(() => {
    const costs: InvoiceItemCostDetail[] = []
    
    const filterItemId = selectedItemId === 'all' ? null : selectedItemId
    
    purchaseInvoices.forEach(invoice => {
      if (!invoice.items || !Array.isArray(invoice.items)) return
      
      const supplier = suppliers.find(s => s.id === invoice.supplierId)
      const linkedExpensesForInvoice = expenseEntries.filter(e => e.linkedInvoiceId === invoice.id)
      
      const totalInvoiceExpenses = linkedExpensesForInvoice.reduce((sum, e) => sum + e.amount, 0)
      const totalInvoiceItemAmount = invoice.items.reduce((sum, item) => sum + item.amount, 0)
      
      invoice.items.forEach(item => {
        if (filterItemId && item.itemId !== filterItemId) return
        
        const itemData = items.find(i => i.id === item.itemId)
        const itemExpenseShare = totalInvoiceItemAmount > 0 
          ? (item.amount / totalInvoiceItemAmount) * totalInvoiceExpenses 
          : 0
        
        const totalCost = item.amount + itemExpenseShare
        const costPerMT = item.quantityMT > 0 ? totalCost / item.quantityMT : 0
        
        costs.push({
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceDate: invoice.invoiceDate,
          supplierName: supplier?.name || 'Unknown',
          itemId: item.itemId,
          itemName: itemData?.name || 'Unknown',
          quantity: item.quantityMT,
          rate: item.rate,
          itemAmount: item.amount,
          linkedExpenses: itemExpenseShare,
          totalCost,
          costPerMT
        })
      })
    })
    
    return costs.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())
  }, [selectedItemId, purchaseInvoices, suppliers, items, expenseEntries])

  const filteredPurchaseDetails = selectedItemId === 'all' 
    ? purchaseDetails 
    : purchaseDetails.filter(d => d.itemId === selectedItemId)

  const filteredSalesDetails = selectedItemId === 'all' 
    ? salesDetails 
    : salesDetails.filter(d => d.itemId === selectedItemId)

  const handleExportPDF = (type: 'purchase' | 'sale' | 'transactions') => {
    const selectedItem = items.find(i => i.id === selectedItemId)
    const itemName = selectedItemId === 'all' ? 'All Items' : selectedItem?.name || 'Unknown'
    
    if (type === 'purchase') {
      exportItemReportToPDF({
        type: 'purchase',
        itemName,
        details: filteredPurchaseDetails,
        fy: currentFY,
        businessName
      })
    } else if (type === 'sale') {
      exportItemReportToPDF({
        type: 'sale',
        itemName,
        details: filteredSalesDetails,
        fy: currentFY,
        businessName
      })
    } else {
      exportItemReportToPDF({
        type: 'transactions',
        itemName,
        transactions: itemTransactions,
        fy: currentFY,
        businessName
      })
    }
  }

  const totalPurchaseQty = filteredPurchaseDetails.reduce((sum, d) => sum + d.totalQuantity, 0)
  const totalPurchaseAmount = filteredPurchaseDetails.reduce((sum, d) => sum + d.totalAmount, 0)
  const totalSaleQty = filteredSalesDetails.reduce((sum, d) => sum + d.totalQuantity, 0)
  const totalSaleAmount = filteredSalesDetails.reduce((sum, d) => sum + d.totalAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
            <Package className="text-accent" weight="duotone" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Item-Wise Reports</h2>
            <p className="text-sm text-muted-foreground">Purchase and sales analysis by item</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filter by Item</CardTitle>
              <CardDescription>Select an item to view detailed reports</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={selectedItemId} onValueChange={setSelectedItemId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select item" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              {items.map(item => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Purchase</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold font-mono">{totalPurchaseQty.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">MT</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono text-muted-foreground">₹{totalPurchaseAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Total Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold font-mono">{totalSaleQty.toFixed(2)}</span>
                <span className="text-sm text-muted-foreground">MT</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono text-muted-foreground">₹{totalSaleAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="purchase" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4">
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="sale">Sales</TabsTrigger>
          <TabsTrigger value="invoice-cost">Invoice-Wise Cost</TabsTrigger>
          {selectedItemId !== 'all' && <TabsTrigger value="transactions">Transactions</TabsTrigger>}
        </TabsList>

        <TabsContent value="purchase" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Report</CardTitle>
                  <CardDescription>Item-wise purchase summary</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportPDF('purchase')}
                  disabled={filteredPurchaseDetails.length === 0}
                >
                  <Download className="mr-2" size={16} />
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPurchaseDetails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No purchase data available
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity (MT)</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                        <TableHead className="text-right">Avg Rate (₹/MT)</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-center">Suppliers</TableHead>
                        <TableHead>First Purchase</TableHead>
                        <TableHead>Last Purchase</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchaseDetails.map(detail => (
                        <TableRow key={detail.itemId}>
                          <TableCell className="font-medium">{detail.itemName}</TableCell>
                          <TableCell className="text-right font-mono">{detail.totalQuantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">₹{detail.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-mono">₹{detail.avgRate.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{detail.invoiceCount}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{detail.supplierCount}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(detail.firstPurchaseDate).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(detail.lastPurchaseDate).toLocaleDateString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sale" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sales Report</CardTitle>
                  <CardDescription>Item-wise sales summary</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleExportPDF('sale')}
                  disabled={filteredSalesDetails.length === 0}
                >
                  <Download className="mr-2" size={16} />
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredSalesDetails.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No sales data available
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity (MT)</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                        <TableHead className="text-right">Avg Rate (₹/MT)</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-center">Customers</TableHead>
                        <TableHead>First Sale</TableHead>
                        <TableHead>Last Sale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSalesDetails.map(detail => (
                        <TableRow key={detail.itemId}>
                          <TableCell className="font-medium">{detail.itemName}</TableCell>
                          <TableCell className="text-right font-mono">{detail.totalQuantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">₹{detail.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                          <TableCell className="text-right font-mono">₹{detail.avgRate.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{detail.invoiceCount}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{detail.customerCount}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(detail.firstSaleDate).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(detail.lastSaleDate).toLocaleDateString('en-IN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoice-cost" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invoice-Wise Item Cost</CardTitle>
                  <CardDescription>Purchase invoice items with allocated expenses</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {invoiceItemCosts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No invoice data available
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Invoice No</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty (MT)</TableHead>
                        <TableHead className="text-right">Rate (₹/MT)</TableHead>
                        <TableHead className="text-right">Item Amount (₹)</TableHead>
                        <TableHead className="text-right">Linked Expenses (₹)</TableHead>
                        <TableHead className="text-right">Total Cost (₹)</TableHead>
                        <TableHead className="text-right">Cost/MT (₹)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoiceItemCosts.map((cost, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-sm">
                            {new Date(cost.invoiceDate).toLocaleDateString('en-IN')}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{cost.invoiceNo}</TableCell>
                          <TableCell>{cost.supplierName}</TableCell>
                          <TableCell className="font-medium">{cost.itemName}</TableCell>
                          <TableCell className="text-right font-mono">{cost.quantity.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">₹{cost.rate.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">
                            ₹{cost.itemAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-warning">
                            {cost.linkedExpenses > 0 ? `₹${cost.linkedExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            ₹{cost.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-accent">
                            ₹{cost.costPerMT.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {selectedItemId !== 'all' && (
          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>All purchase and sale transactions for selected item</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleExportPDF('transactions')}
                    disabled={itemTransactions.length === 0}
                  >
                    <Download className="mr-2" size={16} />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {itemTransactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No transaction data available
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Invoice No</TableHead>
                          <TableHead>Party</TableHead>
                          <TableHead className="text-right">Quantity (MT)</TableHead>
                          <TableHead className="text-right">Rate (₹/MT)</TableHead>
                          <TableHead className="text-right">Amount (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemTransactions.map((transaction, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-sm">
                              {new Date(transaction.date).toLocaleDateString('en-IN')}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={transaction.type === 'purchase' ? 'default' : 'secondary'}
                                className="capitalize"
                              >
                                {transaction.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{transaction.invoiceNo}</TableCell>
                            <TableCell>{transaction.partyName}</TableCell>
                            <TableCell className="text-right font-mono">{transaction.quantity.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">₹{transaction.rate.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">₹{transaction.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
