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
import { Wallet, Funnel, X, ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownLeft, Coins, Bank } from '@phosphor-icons/react'
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
    <div className="space-y-10 max-w-[1400px] mx-auto animate-in fade-in duration-700 ease-out p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-zinc-50">
            Cash & Bank Ledger
          </h1>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Real-time financial balances and transaction history
          </p>
        </div>
      </div>

      {/* Balances Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Liquid Assets Card */}
        <div className="group relative overflow-hidden rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-7 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
          <div className="flex justify-between items-start mb-8">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Liquid Assets</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-transform duration-500 group-hover:scale-110">
              <Wallet className="h-4 w-4" weight="bold" />
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-semibold tracking-tighter text-zinc-900 dark:text-zinc-50">
              ₹{totalLiquid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
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
            className="group relative overflow-hidden rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 p-7 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none"
          >
            <div className="flex justify-between items-start mb-8">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate pr-2">
                {c.name}
              </span>
              <div className="flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
                {c.type}
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tighter text-zinc-900 dark:text-zinc-50">
              ₹{c.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Ledger Section */}
      <div className="rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] overflow-hidden flex flex-col dark:shadow-none">
        {/* Filters Toolbar */}
        <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4">
            <div className="flex items-center gap-3 mr-auto">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <Funnel className="h-4 w-4 text-zinc-600 dark:text-zinc-300" weight="bold" />
              </div>
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Filter Ledger</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Select value={filterCounter} onValueChange={setFilterCounter}>
                <SelectTrigger className="h-10 w-[160px] rounded-full border-zinc-200/80 dark:border-zinc-800 bg-transparent px-4 text-sm font-medium focus:ring-0 focus:ring-offset-0 dark:text-zinc-300">
                  <SelectValue placeholder="All Counters" />
                </SelectTrigger>
                <SelectContent className="rounded-[16px]">
                  <SelectItem value="all" className="rounded-[8px]">All Counters</SelectItem>
                  {counters.map(c => (
                    <SelectItem key={c.id} value={c.id} className="rounded-[8px]">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 w-[140px] rounded-full border-zinc-200/80 dark:border-zinc-800 bg-transparent px-4 text-sm font-medium focus:ring-0 focus:ring-offset-0 dark:text-zinc-300">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="rounded-[16px]">
                  <SelectItem value="all" className="rounded-[8px]">All Types</SelectItem>
                  <SelectItem value="in" className="rounded-[8px]">Cash In</SelectItem>
                  <SelectItem value="out" className="rounded-[8px]">Cash Out</SelectItem>
                  <SelectItem value="transfer" className="rounded-[8px]">Transfers</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 rounded-full border border-zinc-200/80 dark:border-zinc-800 px-3 h-10">
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 w-[110px] border-0 focus-visible:ring-0 shadow-none px-1 text-sm bg-transparent dark:text-zinc-300"
                />
                <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">to</span>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 w-[110px] border-0 focus-visible:ring-0 shadow-none px-1 text-sm bg-transparent dark:text-zinc-300"
                />
              </div>

              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="h-10 rounded-full px-4 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="w-full overflow-x-auto p-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="font-medium text-xs uppercase tracking-widest text-zinc-500 w-[140px] pl-6 h-14">Date</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-widest text-zinc-500 h-14">Transaction Details</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-widest text-zinc-500 text-right w-[160px] h-14">Amount</TableHead>
                <TableHead className="font-medium text-xs uppercase tracking-widest text-zinc-500 text-right w-[180px] pr-8 h-14">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allTransactions.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={4} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-zinc-400">
                      <Wallet className="h-8 w-8 mb-4 opacity-40" weight="light" />
                      <p className="font-medium text-sm">No transactions found</p>
                      <p className="text-xs opacity-60 mt-1">Adjust your filters to see more results</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                allTransactions.map((txn) => {
                  const isTransfer = txn.type === 'Transfer';
                  const isOut = txn.type === 'Out' || (isTransfer && txn.isTransferSide === 'out');
                  
                  let Icon = ArrowDownLeft;
                  
                  if (isTransfer) {
                    Icon = isOut ? ArrowUpRight : ArrowDownLeft;
                  } else if (isOut) {
                    Icon = ArrowUpRight;
                  }

                  return (
                    <TableRow key={txn.displayId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 transition-colors duration-200">
                      <TableCell className="pl-6 align-middle py-5">
                        <div className="font-medium text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(txn.date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      
                      <TableCell className="align-middle py-5">
                        <div className="flex items-center gap-4 w-max">
                          <div className="flex shrink-0 items-center justify-center w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            <Icon className="h-4 w-4" weight="bold" />
                          </div>
                          <div className="flex flex-col justify-center gap-1">
                            {isTransfer ? (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-sm">
                                  {txn.isTransferSide === 'out' ? txn.counterName : txn.toCounterName}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-zinc-400" weight="bold" />
                                <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-sm">
                                  {txn.isTransferSide === 'out' ? txn.toCounterName : txn.counterName}
                                </span>
                              </div>
                            ) : (
                              <div className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 text-sm">
                                {txn.displayCounterName}
                              </div>
                            )}
                            
                            {txn.narration && (
                              <div className="text-sm text-zinc-500 dark:text-zinc-400 max-w-[500px] truncate">
                                {txn.narration}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right align-middle py-5">
                        <div className={`font-semibold tracking-tighter text-[15px] whitespace-nowrap ${isOut ? 'text-zinc-900 dark:text-zinc-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {isOut ? '-' : '+'}₹{Math.abs(txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right pr-8 align-middle py-5">
                        <div className="font-mono text-sm font-medium text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
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
