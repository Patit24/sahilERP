import { useMemo, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { AnimatedValue, AnimatedCard } from '@/components/animated-value'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PurchaseInvoice,
  SalesInvoice,
  Payment,
  CustomerPayment,
  Supplier,
  Customer,
  Item,
  ExpenseEntry,
  ExpenseType,
  FixedScheme,
  ReceivedDiscount
} from '@/lib/types'
import {
  calculatePaymentAllocations,
  calculateExpectedDiscounts,
  calculateExpectedAnnualDiscounts,
  formatCurrency,
  formatMT
} from '@/lib/calculations'
import {
  calculateInventoryReport,
  calculateCDAtRisk
} from '@/lib/report-calculations'
import {
  TrendUp,
  TrendDown,
  Package,
  CurrencyDollar,
  Receipt,
  Warning,
  ArrowRight,
  Wallet,
  Percent
} from '@phosphor-icons/react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import CDExpiryAlert from '@/components/cd-expiry-alert'

interface MasterDashboardPageProps {
  suppliers: Supplier[]
  customers: Customer[]
  items: Item[]
  purchaseInvoices: PurchaseInvoice[]
  salesInvoices: SalesInvoice[]
  payments: Payment[]
  customerPayments: CustomerPayment[]
  expenseEntries: ExpenseEntry[]
  expenseTypes: ExpenseType[]
  fixedSchemes: FixedScheme[]
  receivedDiscounts: ReceivedDiscount[]
  currentFY: string
  onNavigateToReport: (reportName: string) => void
}

export default function MasterDashboardPage({
  suppliers,
  customers,
  items,
  purchaseInvoices,
  salesInvoices,
  payments,
  customerPayments,
  expenseEntries,
  expenseTypes,
  fixedSchemes,
  receivedDiscounts,
  currentFY,
  onNavigateToReport
}: MasterDashboardPageProps) {
  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(() => {
    return calculatePaymentAllocations(payments, purchaseInvoices)
  }, [payments, purchaseInvoices])

  const expectedDiscounts = useMemo(() => {
    return calculateExpectedDiscounts(
      purchaseInvoices,
      payments,
      paymentAllocations,
      paymentAdvanceInfo,
      suppliers,
      fixedSchemes
    )
  }, [purchaseInvoices, payments, paymentAllocations, paymentAdvanceInfo, suppliers, fixedSchemes])

  const expectedAnnual = useMemo(() => {
    return calculateExpectedAnnualDiscounts(purchaseInvoices, suppliers)
  }, [purchaseInvoices, suppliers])

  const inventoryData = useMemo(() => {
    return calculateInventoryReport(items, purchaseInvoices, salesInvoices)
  }, [items, purchaseInvoices, salesInvoices])

  const cdAtRiskData = useMemo(() => {
    return calculateCDAtRisk(purchaseInvoices, payments, paymentAllocations, suppliers)
  }, [purchaseInvoices, payments, paymentAllocations, suppliers])

  const totalPayables = useMemo(() => {
    const totalInvoiceAmount = purchaseInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    const totalPaid = paymentAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0)
    return totalInvoiceAmount - totalPaid
  }, [purchaseInvoices, paymentAllocations])

  const totalReceivables = useMemo(() => {
    const totalSalesAmount = salesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    const totalReceived = customerPayments.reduce((sum, payment) => sum + payment.amount, 0)
    return totalSalesAmount - totalReceived
  }, [salesInvoices, customerPayments])

  const totalStockValue = useMemo(() => {
    return inventoryData.reduce((sum, item) => sum + item.currentStockValue, 0)
  }, [inventoryData])

  const stockSummary = useMemo(() => {
    const byUnit: { [unit: string]: number } = {}
    inventoryData.forEach(item => {
      if (!byUnit[item.unit]) {
        byUnit[item.unit] = 0
      }
      byUnit[item.unit] += item.balanceMT
    })
    return byUnit
  }, [inventoryData])

  const netProfit = useMemo(() => {
    const totalSalesRevenue = salesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    const totalPurchaseCost = purchaseInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    const totalExpenses = expenseEntries
      .filter(entry => {
        const expType = expenseTypes.find(t => t.id === entry.expenseTypeId)
        return expType?.linkType === 'netprofit'
      })
      .reduce((sum, entry) => sum + entry.amount, 0)
    
    return totalSalesRevenue - totalPurchaseCost - totalExpenses
  }, [salesInvoices, purchaseInvoices, expenseEntries, expenseTypes])

  const cdAtRisk48Hours = useMemo(() => {
    const now = new Date()
    
    return cdAtRiskData.filter(item => {
      const supplier = suppliers.find(s => s.id === purchaseInvoices.find(inv => inv.id === item.invoiceId)?.supplierId)
      if (!supplier) return false
      
      const invoiceDate = new Date(item.invoiceDate)
      const maxDays = Math.max(
        ...(supplier.paymentCDRules || []).map(rule => rule.maxDays),
        ...(supplier.invoiceCloseCDRules || []).map(rule => rule.maxDays)
      )
      
      const lastDateForCD = new Date(invoiceDate.getTime() + maxDays * 24 * 60 * 60 * 1000)
      const hoursUntilLastDate = (lastDateForCD.getTime() - now.getTime()) / (1000 * 60 * 60)
      
      return hoursUntilLastDate > 0 && hoursUntilLastDate <= 48
    }).slice(0, 10)
  }, [cdAtRiskData, suppliers, purchaseInvoices])

  const salesVsPurchaseData = useMemo(() => {
    const monthlyData: { [key: string]: { sales: number; purchase: number } } = {}
    
    salesInvoices.forEach(inv => {
      const month = inv.invoiceDate.substring(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { sales: 0, purchase: 0 }
      monthlyData[month].sales += inv.invoiceAmount
    })
    
    purchaseInvoices.forEach(inv => {
      const month = inv.invoiceDate.substring(0, 7)
      if (!monthlyData[month]) monthlyData[month] = { sales: 0, purchase: 0 }
      monthlyData[month].purchase += inv.invoiceAmount
    })
    
    return Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        Sales: Math.round(data.sales / 100000),
        Purchase: Math.round(data.purchase / 100000)
      }))
  }, [salesInvoices, purchaseInvoices])

  const expenseDistribution = useMemo(() => {
    const expenseByType: { [key: string]: number } = {}
    
    expenseEntries.forEach(entry => {
      const expType = expenseTypes.find(t => t.id === entry.expenseTypeId)
      if (expType) {
        expenseByType[expType.name] = (expenseByType[expType.name] || 0) + entry.amount
      }
    })
    
    return Object.entries(expenseByType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [expenseEntries, expenseTypes])

  const COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)'
  ]

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    if (percent < 0.05) return null

    return (
      <text 
        x={x} 
        y={y} 
        fill="hsl(var(--card))" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ 
          fontSize: '12px', 
          fontWeight: 700,
          textShadow: '0 0 3px hsl(var(--foreground)), 0 0 6px hsl(var(--foreground))'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  const totalDiscountsPending = useMemo(() => {
    const totalExpected = expectedDiscounts.reduce((sum, disc) => sum + disc.expectedAmount, 0)
    const allocatedReceived = receivedDiscounts
      .filter(rd => rd.type === 'wallet' && rd.status === 'Allocated')
      .reduce((sum, rd) => sum + rd.amount, 0)
    return totalExpected - allocatedReceived
  }, [expectedDiscounts, receivedDiscounts])

  const totalDiscountsReceived = useMemo(() => {
    return receivedDiscounts
      .filter(rd => rd.type === 'wallet')
      .reduce((sum, rd) => sum + rd.amount, 0)
  }, [receivedDiscounts])

  const totalAnnualDiscountPending = useMemo(() => {
    const totalExpected = expectedAnnual.reduce((sum, disc) => sum + disc.expectedAmount, 0)
    const allocatedReceived = receivedDiscounts
      .filter(rd => rd.type === 'annual' && rd.status === 'Allocated')
      .reduce((sum, rd) => sum + rd.amount, 0)
    return totalExpected - allocatedReceived
  }, [expectedAnnual, receivedDiscounts])

  const totalPendingDiscounts = useMemo(() => {
    return totalDiscountsPending + totalAnnualDiscountPending
  }, [totalDiscountsPending, totalAnnualDiscountPending])

  const totalSalesRevenue = useMemo(() => {
    return salesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
  }, [salesInvoices])

  const profitMargin = useMemo(() => {
    const totalSalesRevenue = salesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
    if (totalSalesRevenue === 0) return 0
    return (netProfit / totalSalesRevenue) * 100
  }, [netProfit, salesInvoices])

  const purchaseVolumeByUnit = useMemo(() => {
    const byUnit: { [unit: string]: number } = {}
    purchaseInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const itemData = items.find(i => i.id === item.itemId)
          const unit = itemData?.unit || 'MT'
          if (!byUnit[unit]) byUnit[unit] = 0
          byUnit[unit] += item.quantityMT
        })
      }
    })
    return byUnit
  }, [purchaseInvoices, items])

  const salesVolumeByUnit = useMemo(() => {
    const byUnit: { [unit: string]: number } = {}
    salesInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          const itemData = items.find(i => i.id === item.itemId)
          const unit = itemData?.unit || 'MT'
          if (!byUnit[unit]) byUnit[unit] = 0
          byUnit[unit] += item.quantityMT
        })
      }
    })
    return byUnit
  }, [salesInvoices, items])

  const totalPurchaseValue = useMemo(() => {
    return purchaseInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
  }, [purchaseInvoices])

  const totalSalesValue = useMemo(() => {
    return salesInvoices.reduce((sum, inv) => sum + inv.invoiceAmount, 0)
  }, [salesInvoices])

  const recentTransactions = useMemo(() => {
    const allTransactions: Array<{
      date: string
      type: string
      description: string
      amount: number
      status: string
    }> = []

    purchaseInvoices.slice(-10).forEach(inv => {
      const supplier = suppliers.find(s => s.id === inv.supplierId)
      allTransactions.push({
        date: inv.invoiceDate,
        type: 'Purchase Invoice',
        description: `${supplier?.name || 'Unknown'} - ${inv.invoiceNo}`,
        amount: inv.invoiceAmount,
        status: 'Credit'
      })
    })

    salesInvoices.slice(-10).forEach(inv => {
      const customer = customers.find(c => c.id === inv.customerId)
      allTransactions.push({
        date: inv.invoiceDate,
        type: 'Sales Invoice',
        description: `${customer?.name || 'Unknown'} - ${inv.invoiceNo}`,
        amount: inv.invoiceAmount,
        status: 'Debit'
      })
    })

    payments.slice(-10).forEach(payment => {
      const supplier = suppliers.find(s => s.id === payment.supplierId)
      allTransactions.push({
        date: payment.paymentDate,
        type: 'Supplier Payment',
        description: `${supplier?.name || 'Unknown'}`,
        amount: payment.amount,
        status: 'Debit'
      })
    })

    customerPayments.slice(-10).forEach(payment => {
      const customer = customers.find(c => c.id === payment.customerId)
      allTransactions.push({
        date: payment.paymentDate,
        type: 'Customer Payment',
        description: `${customer?.name || 'Unknown'}`,
        amount: payment.amount,
        status: 'Credit'
      })
    })

    return allTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10)
  }, [purchaseInvoices, salesInvoices, payments, customerPayments, suppliers, customers])

  return (
    <div className="dashboard-page space-y-responsive-lg">
      <div className="dashboard-kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedCard className="dashboard-kpi-card border-l-4 border-l-primary bg-gradient-to-br from-primary/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground tracking-tight">Total Payables</CardTitle>
              <CurrencyDollar className="h-5 w-5 text-primary" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalPayables} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.p 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium"
              key={`${purchaseInvoices.length}-${payments.length}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {purchaseInvoices.length} invoices • {payments.length} payments
            </motion.p>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className="dashboard-kpi-card border-l-4 border-l-accent bg-gradient-to-br from-accent/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Total Receivables</CardTitle>
              <Receipt className="h-5 w-5 text-accent" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalReceivables} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.p 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium"
              key={`${salesInvoices.length}-${customerPayments.length}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {salesInvoices.length} invoices • {customerPayments.length} payments
            </motion.p>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className="dashboard-kpi-card border-l-4 border-l-success bg-gradient-to-br from-success/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Total Stock Value</CardTitle>
              <Package className="h-5 w-5 text-success" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalStockValue} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.div 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium space-y-0.5"
              key={Object.keys(stockSummary).join(',')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {Object.entries(stockSummary).map(([unit, qty]) => (
                <div key={unit}>
                  {qty.toFixed(3)} {unit}
                </div>
              ))}
            </motion.div>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className={cn(
          "dashboard-kpi-card border-l-4 rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow",
          netProfit >= 0 ? "border-l-success bg-gradient-to-br from-success/8 to-transparent" : "border-l-destructive bg-gradient-to-br from-destructive/8 to-transparent"
        )}>
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Net Profit</CardTitle>
              {netProfit >= 0 ? (
                <TrendUp className="h-5 w-5 text-success" weight="duotone" />
              ) : (
                <TrendDown className="h-5 w-5 text-destructive" weight="duotone" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={netProfit} 
              formatFn={formatCurrency}
              className={cn(
                "text-responsive-2xl font-bold tracking-tight",
                netProfit >= 0 ? "text-success" : "text-destructive"
              )}
            />
            <motion.p 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium"
              key={profitMargin}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              Margin: {profitMargin.toFixed(2)}%
            </motion.p>
          </CardContent>
        </AnimatedCard>
      </div>

      <div className="dashboard-kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <AnimatedCard className="dashboard-kpi-card border-l-4 border-l-warning bg-gradient-to-br from-warning/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Total Pending Discounts</CardTitle>
              <Wallet className="h-5 w-5 text-warning" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalPendingDiscounts} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.p 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium"
              key={totalDiscountsReceived}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              Received: {formatCurrency(totalDiscountsReceived)}
            </motion.p>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className="dashboard-kpi-card border-l-4 border-l-accent bg-gradient-to-br from-accent/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Total Sales Revenue</CardTitle>
              <CurrencyDollar className="h-5 w-5 text-accent" weight="duotone" />
            </div>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalSalesRevenue} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.div 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium space-y-0.5"
              key={salesInvoices.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div>{salesInvoices.length} invoices</div>
              {Object.entries(salesVolumeByUnit).map(([unit, qty]) => (
                <div key={unit}>{qty.toFixed(3)} {unit}</div>
              ))}
            </motion.div>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className="dashboard-kpi-card bg-gradient-to-br from-accent/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Purchase Value</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatedValue 
              value={totalPurchaseValue} 
              formatFn={formatCurrency}
              className="text-responsive-2xl font-bold text-foreground tracking-tight"
            />
            <motion.div 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium space-y-0.5"
              key={purchaseInvoices.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div>{purchaseInvoices.length} invoices</div>
              {Object.entries(purchaseVolumeByUnit).map(([unit, qty]) => (
                <div key={unit}>{qty.toFixed(3)} {unit}</div>
              ))}
            </motion.div>
          </CardContent>
        </AnimatedCard>

        <AnimatedCard className="dashboard-kpi-card bg-gradient-to-br from-success/8 to-transparent rounded-lg border border-border/60 bg-card text-card-foreground shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="dashboard-kpi-header pb-3">
            <CardTitle className="text-responsive-sm font-semibold text-muted-foreground tracking-tight">Inventory Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-responsive-2xl font-bold text-foreground tracking-tight">
              {items.length}
            </div>
            <motion.p 
              className="text-responsive-xs text-muted-foreground mt-1 font-medium"
              key={items.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              Items in catalog
            </motion.p>
          </CardContent>
        </AnimatedCard>
      </div>

      <CDExpiryAlert
        purchaseInvoices={purchaseInvoices}
        payments={payments}
        suppliers={suppliers}
        onNavigateToReport={() => onNavigateToReport('cd-risk')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-responsive-lg">
        <Card className="shadow-md border-border/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-responsive-base font-semibold tracking-tight">Sales vs Purchase</CardTitle>
            <CardDescription className="text-responsive-xs font-medium">Last 6 months trend (in Lakhs)</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesVsPurchaseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: 'hsl(var(--foreground))'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '12px' }}
                  iconType="circle"
                  formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                />
                <Bar dataKey="Sales" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Purchase" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/60">
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-responsive-base font-semibold tracking-tight">Expense Distribution</CardTitle>
            <CardDescription className="text-responsive-xs font-medium">Top 5 expense categories</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={280}>
              {expenseDistribution.length > 0 ? (
                <PieChart>
                  <Pie
                    data={expenseDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {expenseDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      color: 'hsl(var(--foreground))'
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '12px' }}
                    iconType="circle"
                    formatter={(value) => <span style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>{value}</span>}
                  />
                </PieChart>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No expense data available
                </div>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-border/60">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-responsive-base font-semibold tracking-tight">Recent Transactions</CardTitle>
          <CardDescription className="text-responsive-xs font-medium">Last 10 transactions across all modules</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-responsive-xs font-semibold">Date</TableHead>
                  <TableHead className="text-responsive-xs font-semibold">Type</TableHead>
                  <TableHead className="text-responsive-xs font-semibold">Description</TableHead>
                  <TableHead className="text-right text-responsive-xs font-semibold">Amount</TableHead>
                  <TableHead className="text-right text-responsive-xs font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {recentTransactions.length > 0 ? (
                    recentTransactions.map((txn, idx) => (
                      <motion.tr 
                        key={`${txn.date}-${txn.type}-${idx}`}
                        className="border-b border-border/50 transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ 
                          delay: idx * 0.03,
                          duration: 0.2,
                          ease: "easeOut"
                        }}
                        layout
                      >
                        <TableCell className="font-mono text-responsive-xs font-medium">
                          {new Date(txn.date).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-responsive-xs font-medium">
                            {txn.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-responsive-xs font-medium">{txn.description}</TableCell>
                        <TableCell className="text-right font-mono text-responsive-sm font-semibold">
                          {formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge 
                            variant={txn.status === 'Credit' ? 'default' : 'secondary'}
                            className={cn(
                              "font-semibold shadow-sm",
                              txn.status === 'Credit' && 'bg-success/15 text-success border-success/30',
                              txn.status === 'Debit' && 'bg-destructive/15 text-destructive border-destructive/30'
                            )}
                          >
                            {txn.status}
                          </Badge>
                        </TableCell>
                      </motion.tr>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8 font-medium">
                        No transactions available
                      </TableCell>
                    </TableRow>
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
