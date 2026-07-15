import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CashBankCountersMaster from '@/components/cash-bank-counters-master'
import CashBankVoucherEntry from '@/components/cash-bank-voucher-entry'
import CashBankBookReport from '@/components/cash-bank-book-report'
import { Counter, CashBankTransaction, CashBankData } from '@/lib/cash-bank-types'

interface CashBankManagementProps {
  activeCompanyId: string
  activeFY: string
  isLocked?: boolean
}

export default function CashBankManagement({ 
  activeCompanyId, 
  activeFY,
  isLocked = false 
}: CashBankManagementProps) {
  const [counters, setCounters] = useState<Counter[]>([])
  const [transactions, setTransactions] = useState<CashBankTransaction[]>([])

  const getStorageKey = () => `cashbank_${activeCompanyId}_${activeFY}`

  useEffect(() => {
    setCounters([])
    setTransactions([])

    const storageKey = getStorageKey()
    const storedData = localStorage.getItem(storageKey)

    if (storedData) {
      try {
        const parsedData: CashBankData = JSON.parse(storedData)
        setCounters(parsedData.counters || [])
        setTransactions(parsedData.transactions || [])
      } catch (error) {
        console.error('Failed to load cash & bank data:', error)
      }
    }
  }, [activeCompanyId, activeFY])

  useEffect(() => {
    const storageKey = getStorageKey()
    const cashBankData: CashBankData = {
      counters,
      transactions
    }
    localStorage.setItem(storageKey, JSON.stringify(cashBankData))
  }, [counters, transactions, activeCompanyId, activeFY])

  const handleUpdateCounters = (updatedCounters: Counter[]) => {
    setCounters(updatedCounters)
  }

  const handleUpdateAll = (updatedCounters: Counter[], updatedTransactions: CashBankTransaction[]) => {
    setCounters(updatedCounters)
    setTransactions(updatedTransactions)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="master" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="master" className="text-sm font-semibold">
            Master Setup
          </TabsTrigger>
          <TabsTrigger value="voucher" className="text-sm font-semibold">
            Voucher Entry
          </TabsTrigger>
          <TabsTrigger value="report" className="text-sm font-semibold">
            Book Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="master" className="mt-6">
          <CashBankCountersMaster
            counters={counters}
            onUpdateCounters={handleUpdateCounters}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="voucher" className="mt-6">
          <CashBankVoucherEntry
            counters={counters}
            transactions={transactions}
            onUpdateAll={handleUpdateAll}
            isLocked={isLocked}
          />
        </TabsContent>

        <TabsContent value="report" className="mt-6">
          <CashBankBookReport
            counters={counters}
            transactions={transactions}
            customerPayments={[]}
            onUpdateAll={handleUpdateAll}
            isLocked={isLocked}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
