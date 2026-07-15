import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { 
  Wallet, 
  Coins, 
  Bank, 
  Pencil, 
  Trash,
  X,
  Check
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Counter, CashBankTransaction } from '@/lib/cash-bank-types'
import { CustomerPayment } from '@/lib/types'

interface CashBankBookReportProps {
  counters: Counter[]
  transactions: CashBankTransaction[]
  customerPayments: CustomerPayment[]
  onUpdateAll: (counters: Counter[], transactions: CashBankTransaction[]) => void
  isLocked?: boolean
}

export default function CashBankBookReport({
  counters,
  transactions,
  customerPayments,
  onUpdateAll,
  isLocked = false
}: CashBankBookReportProps) {
  const [editingTxnId, setEditingTxnId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editNarration, setEditNarration] = useState('')

  const allTransactions = useMemo(() => {
    const customerPaymentTransactions: CashBankTransaction[] = customerPayments.map(cp => ({
      id: `customer-payment-${cp.id}`,
      date: cp.paymentDate,
      counterId: cp.counterId,
      counterName: cp.counterName,
      type: 'In' as const,
      amount: cp.amount,
      narration: `Customer Payment${cp.notes ? `: ${cp.notes}` : ''}`
    }))

    return [...transactions, ...customerPaymentTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [transactions, customerPayments])

  const handleDeleteTxn = (txn: CashBankTransaction) => {
    if (isLocked) {
      toast.error('Data is locked. Please unlock to make changes.')
      return
    }

    const updatedCounters = counters.map(c => {
      if (txn.type === 'Transfer') {
        if (c.id === txn.counterId) {
          return {
            ...c,
            currentBalance: c.currentBalance + txn.amount
          }
        }
        if (c.id === txn.toCounterId) {
          return {
            ...c,
            currentBalance: c.currentBalance - txn.amount
          }
        }
      } else {
        if (c.id === txn.counterId) {
          return {
            ...c,
            currentBalance: txn.type === 'In' 
              ? c.currentBalance - txn.amount 
              : c.currentBalance + txn.amount
          }
        }
      }
      return c
    })

    const updatedTxns = transactions.filter(t => t.id !== txn.id)
    onUpdateAll(updatedCounters, updatedTxns)
    toast.success('Transaction deleted and balance recalculated')
  }

  const startEditTxn = (txn: CashBankTransaction) => {
    if (isLocked) {
      toast.error('Data is locked. Please unlock to make changes.')
      return
    }

    setEditingTxnId(txn.id)
    setEditAmount(txn.amount.toString())
    setEditNarration(txn.narration)
  }

  const cancelEdit = () => {
    setEditingTxnId(null)
    setEditAmount('')
    setEditNarration('')
  }

  const handleSaveEditTxn = (txn: CashBankTransaction) => {
    if (isLocked) {
      toast.error('Data is locked. Please unlock to make changes.')
      return
    }

    const newAmt = parseFloat(editAmount)
    
    if (isNaN(newAmt) || newAmt <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const updatedCounters = counters.map(c => {
      if (c.id === txn.counterId) {
        let revertedBal = txn.type === 'In' 
          ? c.currentBalance - txn.amount 
          : c.currentBalance + txn.amount
        
        let finalBal = txn.type === 'In' 
          ? revertedBal + newAmt 
          : revertedBal - newAmt
        
        return { ...c, currentBalance: finalBal }
      }
      return c
    })

    const updatedTxns = transactions.map(t => 
      t.id === txn.id 
        ? { ...t, amount: newAmt, narration: editNarration.trim() } 
        : t
    )

    onUpdateAll(updatedCounters, updatedTxns)
    setEditingTxnId(null)
    setEditAmount('')
    setEditNarration('')
    toast.success('Transaction updated and balance recalculated')
  }

  const totalCash = counters
    .filter(c => c.type === 'Cash')
    .reduce((sum, c) => sum + c.currentBalance, 0)

  const totalBank = counters
    .filter(c => c.type === 'Bank')
    .reduce((sum, c) => sum + c.currentBalance, 0)

  const totalLiquid = totalCash + totalBank

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" weight="duotone" />
          Cash & Bank Book Report
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live balance summary and detailed transaction ledger
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Live Financial Balances
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {counters.map(c => (
            <div 
              key={c.id} 
              className="bg-card border border-border rounded-xl p-4 flex flex-col justify-between min-h-[100px] hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground truncate pr-2">
                  {c.name}
                </span>
                <Badge 
                  variant="outline"
                  className={
                    c.type === 'Cash' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' 
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800'
                  }
                >
                  {c.type === 'Cash' ? (
                    <Coins className="h-3 w-3 mr-1" />
                  ) : (
                    <Bank className="h-3 w-3 mr-1" />
                  )}
                  {c.type}
                </Badge>
              </div>
              <div className="text-2xl font-extrabold text-foreground mt-3">
                ₹{c.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}

          <div className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 border-violet-200 dark:border-violet-800 border rounded-xl p-4 flex flex-col justify-between min-h-[100px]">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                Total Liquid Assets
              </span>
              <Wallet className="h-5 w-5 text-violet-600 dark:text-violet-400" weight="duotone" />
            </div>
            <div className="text-2xl font-extrabold text-violet-700 dark:text-violet-300 mt-3">
              ₹{totalLiquid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" weight="duotone" />
            Transaction Book Ledger
          </CardTitle>
          <CardDescription>
            Complete history of all cash and bank movements with edit/delete actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Counter</TableHead>
                  <TableHead className="font-semibold">Narration / Remarks</TableHead>
                  <TableHead className="text-right font-semibold">Cash In (Cr)</TableHead>
                  <TableHead className="text-right font-semibold">Cash Out (Dr)</TableHead>
                  <TableHead className="text-center font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No transactions recorded yet
                    </TableCell>
                  </TableRow>
                ) : (
                  allTransactions.map((txn) => {
                    const isCustomerPayment = txn.id.startsWith('customer-payment-')
                    return (
                      <TableRow key={txn.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-muted-foreground">
                          {new Date(txn.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          {txn.type === 'Transfer' ? (
                            <Badge 
                              variant="outline" 
                              className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800 font-medium"
                            >
                              {txn.counterName} ➔ {txn.toCounterName}
                            </Badge>
                          ) : (
                            <span className="font-semibold text-foreground">{txn.counterName}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingTxnId === txn.id && !isCustomerPayment ? (
                            <Input
                              type="text"
                              value={editNarration}
                              onChange={(e) => setEditNarration(e.target.value)}
                              className="h-8 text-sm"
                              placeholder="Enter narration"
                            />
                          ) : (
                            <span className="text-muted-foreground italic">
                              {txn.narration || '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingTxnId === txn.id && txn.type === 'In' && !isCustomerPayment ? (
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-8 text-sm text-right w-32 ml-auto"
                              step="0.01"
                              min="0.01"
                            />
                          ) : txn.type === 'In' ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            ''
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingTxnId === txn.id && txn.type === 'Out' && !isCustomerPayment ? (
                            <Input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              className="h-8 text-sm text-right w-32 ml-auto"
                              step="0.01"
                              min="0.01"
                            />
                          ) : txn.type === 'Out' ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            ''
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {isCustomerPayment ? (
                            <span className="text-xs text-muted-foreground italic">
                              Customer Payment
                            </span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              {editingTxnId === txn.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveEditTxn(txn)}
                                    disabled={isLocked}
                                    className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                  >
                                    <Check className="h-4 w-4" weight="bold" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={cancelEdit}
                                    disabled={isLocked}
                                    className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                                  >
                                    <X className="h-4 w-4" weight="bold" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditTxn(txn)}
                                    disabled={isLocked}
                                    className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isLocked}
                                        className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this transaction? The counter balance will be automatically recalculated. This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteTxn(txn)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Delete Transaction
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
