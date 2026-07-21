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
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/50 pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Cash & Bank Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Real-time financial balances and transaction history
          </p>
        </div>
      </div>

      {/* Balances Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Liquid Assets Card */}
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-6">
            <span className="text-sm font-medium text-muted-foreground">Total Liquid Assets</span>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="h-4 w-4 text-primary" weight="bold" />
            </div>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-foreground">
            ₹{totalLiquid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Individual Counters */}
        {[...counters].sort((a, b) => {
          if (a.type === 'Bank' && b.type === 'Cash') return -1;
          if (a.type === 'Cash' && b.type === 'Bank') return 1;
          return 0;
        }).map(c => (
          <div 
            key={c.id} 
            className="bg-card border border-border rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-6">
              <span className="text-sm font-medium text-muted-foreground truncate pr-2">
                {c.name}
              </span>
              <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-xs font-medium text-muted-foreground">
                {c.type === 'Cash' ? <Coins className="h-3.5 w-3.5" /> : <Bank className="h-3.5 w-3.5" />}
                <span>{c.type}</span>
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight text-foreground">
              ₹{c.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Ledger Section */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters Toolbar */}
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 mr-auto">
              <Funnel className="h-4 w-4 text-muted-foreground" weight="bold" />
              <span className="text-sm font-medium text-muted-foreground">Filters</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Select value={filterCounter} onValueChange={setFilterCounter}>
                <SelectTrigger className="w-[160px] h-9 bg-background border-border shadow-sm">
                  <SelectValue placeholder="All Counters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counters</SelectItem>
                  {counters.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] h-9 bg-background border-border shadow-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="in">Cash In</SelectItem>
                  <SelectItem value="out">Cash Out</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 bg-background border border-border rounded-md shadow-sm px-2">
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 w-[120px] border-0 focus-visible:ring-0 shadow-none px-1 text-sm"
                />
                <span className="text-muted-foreground text-xs font-medium">to</span>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 w-[120px] border-0 focus-visible:ring-0 shadow-none px-1 text-sm"
                />
              </div>

              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="h-9 px-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader className="bg-transparent">
              <TableRow className="hover:bg-transparent border-b border-border/50">
                <TableHead className="font-medium text-muted-foreground w-[130px] pl-6 h-12">Date</TableHead>
                <TableHead className="font-medium text-muted-foreground h-12">Transaction Details</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right w-[160px] h-12">Amount</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right w-[160px] pr-6 h-12">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Wallet className="h-10 w-10 mb-3 opacity-20" weight="duotone" />
                      <p className="font-medium text-sm">No transactions found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                allTransactions.map((txn) => {
                  const isTransfer = txn.type === 'Transfer';
                  const isOut = txn.type === 'Out' || (isTransfer && txn.isTransferSide === 'out');
                  
                  let Icon = ArrowLeft;
                  let iconBgClass = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
                  
                  if (isTransfer) {
                    Icon = isOut ? ArrowRight : ArrowLeft;
                    iconBgClass = isOut 
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400' 
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
                  } else if (isOut) {
                    Icon = ArrowRight;
                    iconBgClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400';
                  }

                  return (
                    <TableRow key={txn.displayId} className="hover:bg-muted/40 border-b border-border/40 transition-colors">
                      <TableCell className="pl-6 align-middle py-4">
                        <div className="font-medium text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(txn.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      
                      <TableCell className="align-middle py-4">
                        <div className="flex items-center gap-4 w-max">
                          <div className={`flex shrink-0 items-center justify-center w-10 h-10 rounded-full ${iconBgClass}`}>
                            <Icon className="h-4 w-4" weight="bold" />
                          </div>
                          <div className="flex flex-col gap-1">
                            {isTransfer ? (
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground text-sm">
                                  {txn.isTransferSide === 'out' ? txn.counterName : txn.toCounterName}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" weight="bold" />
                                <span className="font-medium text-foreground text-sm">
                                  {txn.isTransferSide === 'out' ? txn.toCounterName : txn.counterName}
                                </span>
                              </div>
                            ) : (
                              <div className="font-medium text-foreground text-sm">
                                {txn.displayCounterName}
                              </div>
                            )}
                            
                            {txn.narration && (
                              <div className="text-sm text-muted-foreground max-w-[500px] truncate">
                                {txn.narration}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right align-middle py-4">
                        <div className={`font-semibold tracking-tight whitespace-nowrap ${isOut ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {isOut ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right pr-6 align-middle py-4">
                        <div className="font-mono text-sm font-medium text-muted-foreground whitespace-nowrap">
                          {txn.runningBalance !== undefined ? (
                            `₹${txn.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          ) : '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
