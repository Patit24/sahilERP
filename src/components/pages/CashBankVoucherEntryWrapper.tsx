import { useState, useEffect } from 'react'
import CashBankVoucherEntry from '@/components/cash-bank-voucher-entry'
import { isLocalCacheDisabled } from '@/lib/supabase-client'

interface CashBankVoucherEntryWrapperProps {
  activeCompanyId: string
  activeFY: string
  isLocked: boolean
}

export default function CashBankVoucherEntryWrapper({ 
  activeCompanyId, 
  activeFY, 
  isLocked 
}: CashBankVoucherEntryWrapperProps) {
  const [counters, setCounters] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const getStorageKey = () => `cashbank_${activeCompanyId}_${activeFY}`

  useEffect(() => {
    setCounters([])
    setTransactions([])
    if (isLocalCacheDisabled) return
    const storageKey = getStorageKey()
    const storedData = localStorage.getItem(storageKey)
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData)
        setCounters(parsedData.counters || [])
        setTransactions(parsedData.transactions || [])
      } catch (error) {
        console.error('Failed to load cash & bank data:', error)
      }
    }
  }, [activeCompanyId, activeFY])

  useEffect(() => {
    const storageKey = getStorageKey()
    const cashBankData = { counters, transactions }
    if (isLocalCacheDisabled) return
    localStorage.setItem(storageKey, JSON.stringify(cashBankData))
  }, [counters, transactions, activeCompanyId, activeFY])

  const handleUpdateAll = (updatedCounters: any[], updatedTransactions: any[]) => {
    setCounters(updatedCounters)
    setTransactions(updatedTransactions)
  }

  return (
    <CashBankVoucherEntry
      counters={counters}
      transactions={transactions}
      onUpdateAll={handleUpdateAll}
      isLocked={isLocked}
    />
  )
}
