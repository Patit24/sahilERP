import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { 
  PurchaseInvoice, 
  Payment, 
  PaymentAllocation, 
  Supplier, 
  Item,
  FixedScheme,
  ReceivedDiscount,
  ExpenseEntry,
  ExpenseType
} from '@/lib/types'
import { formatCurrency, formatMT, calculatePaymentAllocations, calculateExpectedDiscounts, getFYMonths } from '@/lib/calculations'
import { FileText, Calendar, Package, CurrencyDollar, CreditCard, TrendDown, Calculator, CaretDown, Check } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface PurchaseInvoiceDetailsPageProps {
  invoices: PurchaseInvoice[]
  payments: Payment[]
  suppliers: Supplier[]
  items: Item[]
  fixedSchemes: FixedScheme[]
  receivedDiscounts: ReceivedDiscount[]
  expenseEntries: ExpenseEntry[]
  expenseTypes: ExpenseType[]
  currentFY: string
}

interface DiscountBreakdown {
  paymentCDPerMT: number
  invoiceCloseCDPerMT: number
  fixedSchemePerMT: number
  totalCDPerMT: number
}

interface ItemCostBreakdown {
  itemId: string
  itemName: string
  quantityMT: number
  pricePerMT: number
  fixedDiscPerMT: number
  paymentCDPerMT: number
  invoiceCloseCDPerMT: number
  totalCDPerMT: number
  expensePerMT: number
  additionalCostPerMT: number
  costPerMT: number
}

interface InvoiceDetails {
  invoice: PurchaseInvoice
  supplier: Supplier
  allocatedPayments: Array<{
    payment: Payment
    allocatedAmount: number
  }>
  paidAmount: number
  pendingAmount: number
  status: 'Open' | 'Partially Paid' | 'Closed'
  totalCDEarned: number
  cdPerMT: number
  discountBreakdown: DiscountBreakdown
  itemCostBreakdowns: ItemCostBreakdown[]
  linkedExpenses: Array<{
    expense: ExpenseEntry
    expenseType: ExpenseType
  }>
  totalLinkedExpense: number
  netInvoiceAmount: number
  annualDiscountPerMT: number
}

export default function PurchaseInvoiceDetailsPage({
  invoices,
  payments,
  suppliers,
  items,
  fixedSchemes,
  receivedDiscounts,
  expenseEntries,
  expenseTypes,
  currentFY
}: PurchaseInvoiceDetailsPageProps) {
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [searchInvoiceNo, setSearchInvoiceNo] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set(['all']))
  const [includeAnnualDiscount, setIncludeAnnualDiscount] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, Record<string, boolean>>>({})

  const toggleSection = (invoiceId: string, section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [invoiceId]: {
        ...(prev[invoiceId] || {}),
        [section]: !(prev[invoiceId]?.[section] ?? false)
      }
    }))
  }

  const isSectionOpen = (invoiceId: string, section: string) => {
    return collapsedSections[invoiceId]?.[section] ?? false
  }

  const supplierMap = useMemo(() => new Map(suppliers.map(s => [s.id, s])), [suppliers])
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items])
  const expenseTypeMap = useMemo(() => new Map(expenseTypes.map(e => [e.id, e])), [expenseTypes])

  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(
    () => calculatePaymentAllocations(payments, invoices),
    [payments, invoices]
  )

  const expectedDiscounts = useMemo(
    () => calculateExpectedDiscounts(invoices, payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes),
    [invoices, payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes]
  )

  const invoiceDetails = useMemo((): InvoiceDetails[] => {
    return invoices
      .filter(inv => inv.fy === currentFY)
      .map(invoice => {
        const supplier = supplierMap.get(invoice.supplierId)!
        
        const invAllocations = paymentAllocations.filter(a => a.invoiceId === invoice.id)
        const allocatedPayments = invAllocations.map(alloc => {
          const payment = payments.find(p => p.id === alloc.paymentId)!
          return {
            payment,
            allocatedAmount: alloc.allocatedAmount
          }
        })

        const paidAmount = invAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0)
        const pendingAmount = invoice.invoiceAmount - paidAmount

        let status: 'Open' | 'Partially Paid' | 'Closed' = 'Open'
        if (paidAmount >= invoice.invoiceAmount) {
          status = 'Closed'
        } else if (paidAmount > 0) {
          status = 'Partially Paid'
        }

        const invoiceExpectedDiscounts = expectedDiscounts.filter(ed => ed.invoiceId === invoice.id)
        
        const paymentCDTotal = invoiceExpectedDiscounts
          .filter(ed => ed.type === 'paymentCD' || ed.type === 'advanceCD')
          .reduce((sum, ed) => sum + ed.expectedAmount, 0)
        
        const invoiceCloseCDTotal = invoiceExpectedDiscounts
          .filter(ed => ed.type === 'invoiceCloseCD')
          .reduce((sum, ed) => sum + ed.expectedAmount, 0)
        
        const fixedSchemeTotal = invoiceExpectedDiscounts
          .filter(ed => ed.type === 'fixedScheme')
          .reduce((sum, ed) => sum + ed.expectedAmount, 0)
        
        const totalCDEarned = invoiceExpectedDiscounts.reduce((sum, ed) => sum + ed.expectedAmount, 0)
        const cdPerMT = invoice.quantityMT > 0 ? totalCDEarned / invoice.quantityMT : 0

        const discountBreakdown: DiscountBreakdown = {
          paymentCDPerMT: invoice.quantityMT > 0 ? paymentCDTotal / invoice.quantityMT : 0,
          invoiceCloseCDPerMT: invoice.quantityMT > 0 ? invoiceCloseCDTotal / invoice.quantityMT : 0,
          fixedSchemePerMT: invoice.quantityMT > 0 ? fixedSchemeTotal / invoice.quantityMT : 0,
          totalCDPerMT: cdPerMT
        }

        const annualDiscountPerMT = supplier.annualTarget?.ratePerMT || 0

        const linkedExpenses = expenseEntries
          .filter(exp => exp.linkedInvoiceId === invoice.id)
          .map(expense => {
            const expenseType = expenseTypeMap.get(expense.expenseTypeId)!
            return { expense, expenseType }
          })

        const totalLinkedExpense = linkedExpenses.reduce((sum, le) => sum + le.expense.amount, 0)
        const expensePerMT = invoice.quantityMT > 0 ? totalLinkedExpense / invoice.quantityMT : 0
        const additionalCostPerMT = invoice.quantityMT > 0 && invoice.additionalCost ? invoice.additionalCost / invoice.quantityMT : 0

        const itemCostBreakdowns: ItemCostBreakdown[] = (invoice.items || []).map(item => {
          const itemData = itemMap.get(item.itemId)
          const itemQty = item.quantityMT
          const pricePerMT = item.rate
          
          const itemFixedDiscPerMT = discountBreakdown.fixedSchemePerMT
          const itemPaymentCDPerMT = discountBreakdown.paymentCDPerMT
          const itemInvoiceCloseCDPerMT = discountBreakdown.invoiceCloseCDPerMT
          const itemTotalCDPerMT = itemFixedDiscPerMT + itemPaymentCDPerMT + itemInvoiceCloseCDPerMT
          
          const costPerMT = pricePerMT - itemTotalCDPerMT - (includeAnnualDiscount ? annualDiscountPerMT : 0) + expensePerMT + additionalCostPerMT
          
          return {
            itemId: item.itemId,
            itemName: itemData?.name || 'Unknown Item',
            quantityMT: itemQty,
            pricePerMT,
            fixedDiscPerMT: itemFixedDiscPerMT,
            paymentCDPerMT: itemPaymentCDPerMT,
            invoiceCloseCDPerMT: itemInvoiceCloseCDPerMT,
            totalCDPerMT: itemTotalCDPerMT,
            expensePerMT,
            additionalCostPerMT,
            costPerMT
          }
        })

        const netInvoiceAmount = invoice.invoiceAmount - totalLinkedExpense

        return {
          invoice,
          supplier,
          allocatedPayments,
          paidAmount,
          pendingAmount,
          status,
          totalCDEarned,
          cdPerMT,
          discountBreakdown,
          itemCostBreakdowns,
          linkedExpenses,
          totalLinkedExpense,
          netInvoiceAmount,
          annualDiscountPerMT
        }
      })
  }, [invoices, payments, paymentAllocations, suppliers, expectedDiscounts, expenseEntries, expenseTypes, currentFY, supplierMap, expenseTypeMap, itemMap, receivedDiscounts, includeAnnualDiscount])

  const filteredInvoiceDetails = useMemo(() => {
    return invoiceDetails.filter(detail => {
      if (selectedSupplier !== 'all' && detail.invoice.supplierId !== selectedSupplier) return false
      if (selectedStatus !== 'all' && detail.status !== selectedStatus) return false
      if (searchInvoiceNo && !detail.invoice.invoiceNo.toLowerCase().includes(searchInvoiceNo.toLowerCase())) return false
      if (!selectedMonths.has('all')) {
        const invoiceMonth = detail.invoice.invoiceDate.substring(0, 7)
        if (!selectedMonths.has(invoiceMonth)) return false
      }
      return true
    })
  }, [invoiceDetails, selectedSupplier, selectedStatus, searchInvoiceNo, selectedMonths])

  const summaryStats = useMemo(() => {
    const totalInvoices = filteredInvoiceDetails.length
    const totalAmount = filteredInvoiceDetails.reduce((sum, d) => sum + d.invoice.invoiceAmount, 0)
    const totalPaid = filteredInvoiceDetails.reduce((sum, d) => sum + d.paidAmount, 0)
    const totalPending = filteredInvoiceDetails.reduce((sum, d) => sum + d.pendingAmount, 0)
    const totalCDEarned = filteredInvoiceDetails.reduce((sum, d) => sum + d.totalCDEarned, 0)
    const totalQty = filteredInvoiceDetails.reduce((sum, d) => sum + d.invoice.quantityMT, 0)
    const avgCDPerMT = totalQty > 0 ? totalCDEarned / totalQty : 0

    return {
      totalInvoices,
      totalAmount,
      totalPaid,
      totalPending,
      totalCDEarned,
      totalQty,
      avgCDPerMT
    }
  }, [filteredInvoiceDetails])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Closed':
        return <Badge className="bg-success text-success-foreground">Closed</Badge>
      case 'Partially Paid':
        return <Badge className="bg-warning text-warning-foreground">Partially Paid</Badge>
      case 'Open':
        return <Badge variant="destructive">Open</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="text-primary" />
              Purchase Invoice Details
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="include-annual" 
                checked={includeAnnualDiscount}
                onCheckedChange={(checked) => setIncludeAnnualDiscount(checked === true)}
              />
              <Label htmlFor="include-annual" className="cursor-pointer">
                Include Annual Discount in Cost Calculation
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div>
              <Label>Supplier</Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger>
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

            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Month</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    <span className="truncate">
                      {selectedMonths.has('all') 
                        ? 'All Months' 
                        : `${selectedMonths.size} of ${getFYMonths(currentFY).length} selected`}
                    </span>
                    <CaretDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search months..." />
                    <CommandList>
                      <CommandEmpty>No month found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="all"
                          onSelect={() => {
                            setSelectedMonths(new Set(['all']))
                          }}
                          className="cursor-pointer"
                        >
                          <div className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            selectedMonths.has('all')
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}>
                            <Check className="h-4 w-4" />
                          </div>
                          <span>All Months</span>
                        </CommandItem>
                        {getFYMonths(currentFY).map((month) => (
                          <CommandItem
                            key={month.value}
                            onSelect={() => {
                              setSelectedMonths(prev => {
                                const newSet = new Set(prev)
                                newSet.delete('all')
                                if (newSet.has(month.value)) {
                                  newSet.delete(month.value)
                                } else {
                                  newSet.add(month.value)
                                }
                                if (newSet.size === 0) {
                                  return new Set(['all'])
                                }
                                return newSet
                              })
                            }}
                            className="cursor-pointer"
                          >
                            <div className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              selectedMonths.has(month.value)
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
                            )}>
                              <Check className="h-4 w-4" />
                            </div>
                            <span>{month.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="md:col-span-2">
              <Label>Search Invoice No</Label>
              <Input 
                placeholder="Search by invoice number..."
                value={searchInvoiceNo}
                onChange={(e) => setSearchInvoiceNo(e.target.value)}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setSelectedSupplier('all')
                  setSelectedStatus('all')
                  setSearchInvoiceNo('')
                  setSelectedMonths(new Set(['all']))
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total Invoices</div>
                <div className="text-2xl font-bold">{summaryStats.totalInvoices}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
                <div className="text-lg font-semibold text-primary">{formatCurrency(summaryStats.totalAmount)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total Paid</div>
                <div className="text-lg font-semibold text-success">{formatCurrency(summaryStats.totalPaid)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total Pending</div>
                <div className="text-lg font-semibold text-destructive">{formatCurrency(summaryStats.totalPending)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total CD Earned</div>
                <div className="text-lg font-semibold text-accent">{formatCurrency(summaryStats.totalCDEarned)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Total Qty</div>
                <div className="text-lg font-semibold">{formatMT(summaryStats.totalQty)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground mb-1">Avg CD/MT</div>
                <div className="text-lg font-semibold text-accent">{formatCurrency(summaryStats.avgCDPerMT)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {filteredInvoiceDetails.map(detail => (
              <Card key={detail.invoice.id} className="border-l-4 border-l-primary">
                <Collapsible
                  open={isSectionOpen(detail.invoice.id, 'invoice')}
                  onOpenChange={() => toggleSection(detail.invoice.id, 'invoice')}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="pb-3 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <CaretDown 
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform duration-200 flex-shrink-0",
                              isSectionOpen(detail.invoice.id, 'invoice') && "rotate-180"
                            )}
                          />
                          <div className="text-left">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-lg">{detail.invoice.invoiceNo}</span>
                              {getStatusBadge(detail.status)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">Supplier: </span>
                            <span className="font-medium">{detail.supplier.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Inv Date: </span>
                            <span className="font-medium">{format(new Date(detail.invoice.invoiceDate), 'dd MMM yyyy')}</span>
                          </div>
                          {detail.invoice.orderDate && (
                            <div>
                              <span className="text-muted-foreground">Order Date: </span>
                              <span className="font-medium">{format(new Date(detail.invoice.orderDate), 'dd MMM yyyy')}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Qty: </span>
                            <span className="font-semibold">{formatMT(detail.invoice.quantityMT)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-bold text-primary">{formatCurrency(detail.invoice.invoiceAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4">
                  {includeAnnualDiscount && detail.annualDiscountPerMT > 0 && (
                    <div className="bg-accent/10 border-l-4 border-l-accent rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator size={18} className="text-accent" />
                        <h4 className="font-semibold">Annual Discount Applied</h4>
                      </div>
                      <div className="text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Annual Discount per MT:</span>
                          <span className="font-bold text-accent text-lg">{formatCurrency(detail.annualDiscountPerMT)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {detail.invoice.items && detail.invoice.items.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Package size={16} className="text-primary" />
                        Invoice Items Summary
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Quantity (MT)</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.invoice.items.map((item, idx) => {
                            const itemData = itemMap.get(item.itemId)
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  {itemData?.name || 'Unknown Item'}
                                </TableCell>
                                <TableCell className="text-right">{formatMT(item.quantityMT)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.rate)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <CurrencyDollar size={16} className="text-success" />
                        Payment Status
                      </h4>
                      <div className="bg-muted rounded-lg p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Invoice Amount:</span>
                          <span className="font-semibold">{formatCurrency(detail.invoice.invoiceAmount)}</span>
                        </div>
                        {detail.invoice.additionalCost && detail.invoice.additionalCost > 0 && (
                          <div className="flex justify-between bg-accent/10 -mx-3 px-3 py-1.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              Additional Cost
                              {detail.invoice.additionalCostRemarks && (
                                <span className="text-[10px] italic">({detail.invoice.additionalCostRemarks})</span>
                              )}
                              :
                            </span>
                            <span className="text-xs font-semibold">{formatCurrency(detail.invoice.additionalCost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Paid Amount:</span>
                          <span className="font-semibold text-success">{formatCurrency(detail.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm text-muted-foreground">Pending Amount:</span>
                          <span className="font-bold text-destructive">{formatCurrency(detail.pendingAmount)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Calculator size={16} className="text-accent" />
                        CD Breakdown
                      </h4>
                      <div className="bg-accent/10 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Fixed Scheme/MT:</span>
                          <span className="font-semibold text-success">{formatCurrency(detail.discountBreakdown.fixedSchemePerMT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Payment CD/MT:</span>
                          <span className="font-semibold text-success">{formatCurrency(detail.discountBreakdown.paymentCDPerMT)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Invoice Close CD/MT:</span>
                          <span className="font-semibold text-success">{formatCurrency(detail.discountBreakdown.invoiceCloseCDPerMT)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm text-muted-foreground">Total CD/MT:</span>
                          <span className="font-bold text-accent">{formatCurrency(detail.discountBreakdown.totalCDPerMT)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                          <span>Total CD Earned:</span>
                          <span className="font-semibold">{formatCurrency(detail.totalCDEarned)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Invoice Qty:</span>
                          <span className="font-semibold">{formatMT(detail.invoice.quantityMT)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {detail.itemCostBreakdowns.length > 0 && (
                    <Collapsible
                      open={isSectionOpen(detail.invoice.id, 'itemCost')}
                      onOpenChange={() => toggleSection(detail.invoice.id, 'itemCost')}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors border border-border">
                          <h4 className="font-semibold flex items-center gap-2">
                            <Calculator size={16} className="text-primary" />
                            Item-wise Cost Breakdown
                          </h4>
                          <CaretDown 
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform duration-200",
                              isSectionOpen(detail.invoice.id, 'itemCost') && "rotate-180"
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">Qty (MT)</TableHead>
                                <TableHead className="text-right">Price/MT</TableHead>
                                <TableHead className="text-right">Fixed Disc/MT</TableHead>
                                <TableHead className="text-right">Payment CD/MT</TableHead>
                                <TableHead className="text-right">Close CD/MT</TableHead>
                                <TableHead className="text-right">Total CD/MT</TableHead>
                                {includeAnnualDiscount && (
                                  <TableHead className="text-right">Annual Disc/MT</TableHead>
                                )}
                                <TableHead className="text-right">Expense/MT</TableHead>
                                <TableHead className="text-right">Add. Cost/MT</TableHead>
                                <TableHead className="text-right font-semibold">Cost/MT</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.itemCostBreakdowns.map((breakdown, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">
                                    {breakdown.itemName}
                                  </TableCell>
                                  <TableCell className="text-right">{formatMT(breakdown.quantityMT)}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(breakdown.pricePerMT)}</TableCell>
                                  <TableCell className="text-right text-success">
                                    {breakdown.fixedDiscPerMT > 0 ? `-${formatCurrency(breakdown.fixedDiscPerMT)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-success">
                                    {breakdown.paymentCDPerMT > 0 ? `-${formatCurrency(breakdown.paymentCDPerMT)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-success">
                                    {breakdown.invoiceCloseCDPerMT > 0 ? `-${formatCurrency(breakdown.invoiceCloseCDPerMT)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-accent">
                                    {breakdown.totalCDPerMT > 0 ? `-${formatCurrency(breakdown.totalCDPerMT)}` : '-'}
                                  </TableCell>
                                  {includeAnnualDiscount && (
                                    <TableCell className="text-right text-success">
                                      {detail.annualDiscountPerMT > 0 ? `-${formatCurrency(detail.annualDiscountPerMT)}` : '-'}
                                    </TableCell>
                                  )}
                                  <TableCell className="text-right text-warning">
                                    {breakdown.expensePerMT > 0 ? `+${formatCurrency(breakdown.expensePerMT)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right text-warning">
                                    {breakdown.additionalCostPerMT > 0 ? `+${formatCurrency(breakdown.additionalCostPerMT)}` : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-bold text-primary">
                                    {formatCurrency(breakdown.costPerMT)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {detail.allocatedPayments.length > 0 && (
                    <Collapsible
                      open={isSectionOpen(detail.invoice.id, 'payments')}
                      onOpenChange={() => toggleSection(detail.invoice.id, 'payments')}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors border border-border">
                          <h4 className="font-semibold flex items-center gap-2">
                            <CreditCard size={16} className="text-success" />
                            Payment Allocations ({detail.allocatedPayments.length})
                          </h4>
                          <CaretDown 
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform duration-200",
                              isSectionOpen(detail.invoice.id, 'payments') && "rotate-180"
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Payment Date</TableHead>
                              <TableHead className="text-right">Allocated Amount</TableHead>
                              <TableHead className="text-right">Days</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.allocatedPayments.map((ap, idx) => {
                              const days = Math.floor(
                                (new Date(ap.payment.paymentDate).getTime() - 
                                 new Date(detail.invoice.invoiceDate).getTime()) / 
                                (1000 * 60 * 60 * 24)
                              )
                              const displayDays = Math.max(0, days)
                              return (
                                <TableRow key={idx}>
                                  <TableCell>{format(new Date(ap.payment.paymentDate), 'dd MMM yyyy')}</TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency(ap.allocatedAmount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant={displayDays === 0 ? 'default' : 'secondary'}>
                                      {displayDays} days
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {detail.linkedExpenses.length > 0 && (
                    <Collapsible
                      open={isSectionOpen(detail.invoice.id, 'expenses')}
                      onOpenChange={() => toggleSection(detail.invoice.id, 'expenses')}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors border border-border">
                          <h4 className="font-semibold flex items-center gap-2">
                            <TrendDown size={16} className="text-warning" />
                            Linked Expenses ({detail.linkedExpenses.length})
                          </h4>
                          <CaretDown 
                            className={cn(
                              "h-5 w-5 text-muted-foreground transition-transform duration-200",
                              isSectionOpen(detail.invoice.id, 'expenses') && "rotate-180"
                            )}
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Expense Type</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.linkedExpenses.map((le, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{le.expenseType.name}</TableCell>
                                <TableCell>{format(new Date(le.expense.expenseDate), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{le.expense.notes || '-'}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(le.expense.amount)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50">
                              <TableCell colSpan={3} className="font-semibold">Total Linked Expense</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(detail.totalLinkedExpense)}</TableCell>
                            </TableRow>
                            <TableRow className="bg-primary/5">
                              <TableCell colSpan={3} className="font-semibold">Net Invoice Amount</TableCell>
                              <TableCell className="text-right font-bold text-primary">{formatCurrency(detail.netInvoiceAmount)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}

            {filteredInvoiceDetails.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No invoices found matching the selected filters.
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
