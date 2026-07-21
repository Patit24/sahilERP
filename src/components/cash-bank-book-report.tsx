import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { 
  Wallet, 
  Coins, 
  Bank,
  Funnel,
  X,
  ArrowRight,
  ArrowLeft
} from '@phosphor-icons/react'
import { Counter, CashBankTransaction } from '@/lib/cash-bank-types'

type DisplayTransaction = CashBankTransaction & {
  displayId: string;
  isTransferSide?: 'out' | 'in';
  displayCounterId: string;
  displayCounterName: string;
  runningBalance?: number;
  _index: number;
};

interface CashBankBookReportProps {
  counters: Counter[]
  transactions: CashBankTransaction[]
}

export default function CashBankBookReport({
  counters,
  transactions,
}: CashBankBookReportProps) {
  const [filterCounter, setFilterCounter] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const allTransactions = useMemo(() => {
    let expanded: DisplayTransaction[] = [];
    transactions.forEach((t, i) => {
      if (t.type === 'Transfer') {
        expanded.push({ 
          ...t, 
          displayId: `${t.id}-out`, 
          isTransferSide: 'out', 
          displayCounterId: t.counterId,
          displayCounterName: t.counterName,
          _index: i * 10
        });
        expanded.push({ 
          ...t, 
          displayId: `${t.id}-in`, 
          isTransferSide: 'in', 
          displayCounterId: t.toCounterId!,
          displayCounterName: t.toCounterName!,
          _index: i * 10 + 1
        });
      } else {
        expanded.push({ 
          ...t, 
          displayId: t.id, 
          displayCounterId: t.counterId,
          displayCounterName: t.counterName,
          _index: i * 10
        });
      }
    });

    // Sort ascending for balance calculation
    let expandedAscending = expanded.sort((a, b) => {
      const timeDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a._index - b._index;
    });

    // Filter by counter BEFORE calculating balance
    let filteredForBalance = expandedAscending;
    if (filterCounter !== 'all') {
      filteredForBalance = filteredForBalance.filter(t => t.displayCounterId === filterCounter);
    }
    
    let currentBalance = 0;
    if (filterCounter === 'all') {
      currentBalance = counters.reduce((sum, c) => sum + (c.openingBalance || 0), 0);
    } else {
      const counter = counters.find(c => c.id === filterCounter);
      if (counter) currentBalance = counter.openingBalance || 0;
    }
    
    const withBalance = filteredForBalance.map(t => {
      if (filterCounter !== 'all') {
        if (t.type === 'In' || t.isTransferSide === 'in') {
          currentBalance += t.amount;
        } else if (t.type === 'Out' || t.isTransferSide === 'out') {
          currentBalance -= t.amount;
        }
      } else {
        if (t.type === 'In') {
          currentBalance += t.amount;
        } else if (t.type === 'Out') {
          currentBalance -= t.amount;
        }
      }
      return { ...t, runningBalance: currentBalance };
    });

    // NOW apply the remaining filters
    let finalFiltered = withBalance;
    if (filterType !== 'all') {
      finalFiltered = finalFiltered.filter(t => t.type.toLowerCase() === filterType.toLowerCase())
    }
    if (dateFrom) {
      finalFiltered = finalFiltered.filter(t => new Date(t.date) >= new Date(dateFrom))
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      finalFiltered = finalFiltered.filter(t => new Date(t.date) <= to)
    }

    // Finally, sort descending for display
    return finalFiltered.sort((a, b) => {
      const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b._index - a._index;
    });
  }, [transactions, counters, filterCounter, filterType, dateFrom, dateTo])

  const clearFilters = () => {
    setFilterCounter('all')
    setFilterType('all')
    setDateFrom('')
    setDateTo('')
  }

  const activeFiltersCount = 
    (filterCounter !== 'all' ? 1 : 0) + 
    (filterType !== 'all' ? 1 : 0) + 
    (dateFrom ? 1 : 0) + 
    (dateTo ? 1 : 0)

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

          {[...counters].sort((a, b) => {
            if (a.type === 'Bank' && b.type === 'Cash') return -1;
            if (a.type === 'Cash' && b.type === 'Bank') return 1;
            return 0;
          }).map(c => (
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" weight="duotone" />
                Transaction Book Ledger
              </CardTitle>
              <CardDescription>
                Complete history of all cash and bank movements
              </CardDescription>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-muted/30 border border-border rounded-lg space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Funnel className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">Filter Transactions</h4>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} active
                </Badge>
              )}
              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="ml-auto h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3 mr-1" /> Clear Filters
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Counter</label>
                <Select value={filterCounter} onValueChange={setFilterCounter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Counters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Counters</SelectItem>
                    {counters.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="in">Cash In</SelectItem>
                    <SelectItem value="out">Cash Out</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">From Date</label>
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">To Date</label>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
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
                  <TableHead className="text-right font-semibold">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No transactions recorded or found with current filters
                    </TableCell>
                  </TableRow>
                ) : (
                  allTransactions.map((txn) => {
                    return (
                      <TableRow key={txn.displayId} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-muted-foreground whitespace-nowrap">
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
                              className={`font-medium w-[220px] p-0 overflow-hidden ${txn.isTransferSide === 'out' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'}`}
                            >
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full px-2 py-1 gap-1">
                                {txn.isTransferSide === 'out' ? (
                                  <>
                                    <span className="truncate text-right" title={txn.counterName}>{txn.counterName}</span>
                                    <ArrowRight weight="bold" className="shrink-0 mx-1" />
                                    <span className="truncate text-left" title={txn.toCounterName}>{txn.toCounterName}</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="truncate text-right" title={txn.toCounterName}>{txn.toCounterName}</span>
                                    <ArrowLeft weight="bold" className="shrink-0 mx-1" />
                                    <span className="truncate text-left" title={txn.counterName}>{txn.counterName}</span>
                                  </>
                                )}
                              </div>
                            </Badge>
                          ) : (
                            <span className="font-semibold text-foreground whitespace-nowrap">{txn.displayCounterName}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground italic line-clamp-2">
                            {txn.narration || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {txn.type === 'In' || (txn.type === 'Transfer' && txn.isTransferSide === 'in') ? (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            ''
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {txn.type === 'Out' || (txn.type === 'Transfer' && txn.isTransferSide === 'out') ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              ₹{txn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            ''
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap font-bold text-foreground">
                          ₹{(txn.runningBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
