import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PurchaseInvoice, Payment, Supplier, PaymentAllocation } from '@/lib/types'
import { calculatePaymentAllocations, formatCurrency, formatMT } from '@/lib/calculations'
import { Warning, Clock, ArrowRight } from '@phosphor-icons/react'
import { format, differenceInDays } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'

interface CDExpiryAlertProps {
  purchaseInvoices: PurchaseInvoice[]
  payments: Payment[]
  suppliers: Supplier[]
  onNavigateToReport?: () => void
}

interface CDExpiryAlert {
  invoiceId: string
  invoiceNo: string
  invoiceDate: string
  supplierId: string
  supplierName: string
  pendingAmount: number
  pendingQuantityMT: number
  currentSlabDays: number
  currentSlabRate: number
  nextSlabDays: number
  nextSlabRate: number
  daysUntilNextSlab: number
  potentialLoss: number
  type: 'expiring' | 'moving'
  cdType: 'payment' | 'invoiceClose'
}

export default function CDExpiryAlert({
  purchaseInvoices,
  payments,
  suppliers,
  onNavigateToReport
}: CDExpiryAlertProps) {
  const { allocations: paymentAllocations, paymentAdvanceInfo } = useMemo(() => {
    return calculatePaymentAllocations(payments, purchaseInvoices)
  }, [payments, purchaseInvoices])

  const expiryAlerts = useMemo(() => {
    const alerts: CDExpiryAlert[] = []
    const today = new Date()
    
    purchaseInvoices.forEach(invoice => {
      const supplier = suppliers.find(s => s.id === invoice.supplierId)
      if (!supplier) return
      
      const allocatedAmount = paymentAllocations
        .filter(a => a.invoiceId === invoice.id)
        .reduce((sum, a) => sum + a.allocatedAmount, 0)
      
      const pendingAmount = invoice.invoiceAmount - allocatedAmount
      const invoiceDate = new Date(invoice.invoiceDate)
      const daysFromInvoice = differenceInDays(today, invoiceDate)
      
      if (supplier.paymentCDRules && supplier.paymentCDRules.length > 0 && pendingAmount > 0) {
        const sortedRules = [...supplier.paymentCDRules].sort((a, b) => a.minDays - b.minDays)
        
        let currentSlab: typeof sortedRules[0] | null = null
        let nextSlab: typeof sortedRules[0] | null = null
        
        for (let i = 0; i < sortedRules.length; i++) {
          const rule = sortedRules[i]
          if (daysFromInvoice >= rule.minDays && daysFromInvoice <= rule.maxDays) {
            currentSlab = rule
            if (i < sortedRules.length - 1) {
              nextSlab = sortedRules[i + 1]
            }
            break
          }
        }
        
        if (!currentSlab) {
          for (let i = sortedRules.length - 1; i >= 0; i--) {
            if (daysFromInvoice < sortedRules[i].minDays) {
              currentSlab = sortedRules[i]
              if (i < sortedRules.length - 1) {
                nextSlab = sortedRules[i + 1]
              }
            }
          }
        }
        
        if (currentSlab) {
          const daysUntilExpiry = currentSlab.maxDays - daysFromInvoice
          const daysUntilNextSlab = nextSlab ? (nextSlab.minDays - daysFromInvoice) : -1
          
          if (daysUntilExpiry >= 0 && daysUntilExpiry <= 2) {
            const currentCD = (pendingAmount * currentSlab.percentageRate) / 100
            const nextCD = nextSlab ? (pendingAmount * nextSlab.percentageRate) / 100 : 0
            const potentialLoss = currentCD - nextCD
            
            alerts.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              invoiceDate: invoice.invoiceDate,
              supplierId: supplier.id,
              supplierName: supplier.name,
              pendingAmount,
              pendingQuantityMT: invoice.quantityMT,
              currentSlabDays: currentSlab.maxDays,
              currentSlabRate: currentSlab.percentageRate,
              nextSlabDays: nextSlab ? nextSlab.minDays : -1,
              nextSlabRate: nextSlab ? nextSlab.percentageRate : 0,
              daysUntilNextSlab: daysUntilExpiry,
              potentialLoss,
              type: 'expiring',
              cdType: 'payment'
            })
          } else if (nextSlab && daysUntilNextSlab >= 0 && daysUntilNextSlab <= 2) {
            const currentCD = (pendingAmount * currentSlab.percentageRate) / 100
            const nextCD = (pendingAmount * nextSlab.percentageRate) / 100
            const potentialLoss = currentCD - nextCD
            
            alerts.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              invoiceDate: invoice.invoiceDate,
              supplierId: supplier.id,
              supplierName: supplier.name,
              pendingAmount,
              pendingQuantityMT: invoice.quantityMT,
              currentSlabDays: currentSlab.maxDays,
              currentSlabRate: currentSlab.percentageRate,
              nextSlabDays: nextSlab.minDays,
              nextSlabRate: nextSlab.percentageRate,
              daysUntilNextSlab,
              potentialLoss,
              type: 'moving',
              cdType: 'payment'
            })
          }
        }
      }
      
      if (supplier.invoiceCloseCDRules && supplier.invoiceCloseCDRules.length > 0) {
        const sortedRules = [...supplier.invoiceCloseCDRules].sort((a, b) => a.minDays - b.minDays)
        
        let currentSlab: typeof sortedRules[0] | null = null
        let nextSlab: typeof sortedRules[0] | null = null
        
        for (let i = 0; i < sortedRules.length; i++) {
          const rule = sortedRules[i]
          if (daysFromInvoice >= rule.minDays && daysFromInvoice <= rule.maxDays) {
            currentSlab = rule
            if (i < sortedRules.length - 1) {
              nextSlab = sortedRules[i + 1]
            }
            break
          }
        }
        
        if (!currentSlab) {
          for (let i = sortedRules.length - 1; i >= 0; i--) {
            if (daysFromInvoice < sortedRules[i].minDays) {
              currentSlab = sortedRules[i]
              if (i < sortedRules.length - 1) {
                nextSlab = sortedRules[i + 1]
              }
            }
          }
        }
        
        if (currentSlab) {
          const daysUntilExpiry = currentSlab.maxDays - daysFromInvoice
          const daysUntilNextSlab = nextSlab ? (nextSlab.minDays - daysFromInvoice) : -1
          
          if (daysUntilExpiry >= 0 && daysUntilExpiry <= 2) {
            const currentCD = invoice.quantityMT * currentSlab.ratePerMT
            const nextCD = nextSlab ? (invoice.quantityMT * nextSlab.ratePerMT) : 0
            const potentialLoss = currentCD - nextCD
            
            alerts.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              invoiceDate: invoice.invoiceDate,
              supplierId: supplier.id,
              supplierName: supplier.name,
              pendingAmount,
              pendingQuantityMT: invoice.quantityMT,
              currentSlabDays: currentSlab.maxDays,
              currentSlabRate: currentSlab.ratePerMT,
              nextSlabDays: nextSlab ? nextSlab.minDays : -1,
              nextSlabRate: nextSlab ? nextSlab.ratePerMT : 0,
              daysUntilNextSlab: daysUntilExpiry,
              potentialLoss,
              type: 'expiring',
              cdType: 'invoiceClose'
            })
          } else if (nextSlab && daysUntilNextSlab >= 0 && daysUntilNextSlab <= 2) {
            const currentCD = invoice.quantityMT * currentSlab.ratePerMT
            const nextCD = invoice.quantityMT * nextSlab.ratePerMT
            const potentialLoss = currentCD - nextCD
            
            alerts.push({
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              invoiceDate: invoice.invoiceDate,
              supplierId: supplier.id,
              supplierName: supplier.name,
              pendingAmount,
              pendingQuantityMT: invoice.quantityMT,
              currentSlabDays: currentSlab.maxDays,
              currentSlabRate: currentSlab.ratePerMT,
              nextSlabDays: nextSlab.minDays,
              nextSlabRate: nextSlab.ratePerMT,
              daysUntilNextSlab,
              potentialLoss,
              type: 'moving',
              cdType: 'invoiceClose'
            })
          }
        }
      }
    })
    
    return alerts.sort((a, b) => b.potentialLoss - a.potentialLoss)
  }, [purchaseInvoices, payments, paymentAllocations, suppliers])

  const totalPotentialLoss = useMemo(() => {
    return expiryAlerts.reduce((sum, alert) => sum + alert.potentialLoss, 0)
  }, [expiryAlerts])

  if (expiryAlerts.length === 0) return null

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
              <Warning className="h-5 w-5 text-warning" weight="fill" />
            </div>
            <div>
              <CardTitle className="text-lg">CD Expiry Alerts</CardTitle>
              <CardDescription>
                {expiryAlerts.length} invoice{expiryAlerts.length > 1 ? 's' : ''} with CDs expiring/moving to next slab within 2 days
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Potential Loss</p>
            <p className="text-xl font-mono font-semibold text-warning">
              {formatCurrency(totalPotentialLoss)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px]">
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {expiryAlerts.map((alert, index) => (
                <motion.div
                  key={alert.invoiceId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {alert.invoiceNo}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {alert.supplierName}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={alert.cdType === 'payment' ? 'text-xs bg-[oklch(0.65_0.20_160)]/10 text-[oklch(0.65_0.20_160)] border-[oklch(0.65_0.20_160)]' : 'text-xs bg-[oklch(0.75_0.15_280)]/10 text-[oklch(0.75_0.15_280)] border-[oklch(0.75_0.15_280)]'}
                        >
                          {alert.cdType === 'payment' ? 'Payment CD' : 'Invoice Close CD'}
                        </Badge>
                        {alert.type === 'expiring' ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Clock className="h-3 w-3" />
                            Expiring in {alert.daysUntilNextSlab} day{alert.daysUntilNextSlab !== 1 ? 's' : ''}
                          </Badge>
                        ) : (
                          <Badge className="text-xs gap-1 bg-warning text-warning-foreground">
                            <ArrowRight className="h-3 w-3" />
                            Moving to next slab in {alert.daysUntilNextSlab} day{alert.daysUntilNextSlab !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div>
                          <span className="text-muted-foreground">Invoice Date:</span>
                          <span className="ml-2 font-medium">{format(new Date(alert.invoiceDate), 'dd MMM yyyy')}</span>
                        </div>
                        {alert.cdType === 'payment' ? (
                          <div>
                            <span className="text-muted-foreground">Pending:</span>
                            <span className="ml-2 font-mono font-medium">{formatCurrency(alert.pendingAmount)}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-muted-foreground">Quantity:</span>
                            <span className="ml-2 font-mono font-medium">{formatMT(alert.pendingQuantityMT)}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Current CD:</span>
                          <span className="ml-2 font-mono font-medium text-success">
                            {alert.cdType === 'payment' ? `${alert.currentSlabRate}%` : `₹${alert.currentSlabRate}/MT`}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Next CD:</span>
                          <span className="ml-2 font-mono font-medium text-destructive">
                            {alert.nextSlabRate > 0 ? (alert.cdType === 'payment' ? `${alert.nextSlabRate}%` : `₹${alert.nextSlabRate}/MT`) : 'No CD'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Loss if delayed</p>
                      <p className="text-lg font-mono font-semibold text-destructive">
                        {formatCurrency(alert.potentialLoss)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
        
        {onNavigateToReport && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={onNavigateToReport}
            >
              <Warning className="h-4 w-4" />
              View Full CD at Risk Report
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
