import { useState, useEffect } from 'react'
import CashBankBookReport from '@/components/cash-bank-book-report'
import { CustomerPayment } from '@/lib/types'
import { CashBankTransaction } from '@/lib/cash-bank-types'
import { isLocalCacheDisabled } from '@/lib/supabase-client'

interface CashBankBookReportWrapperProps {
  activeCompanyId: string
  activeFY: string
  isLocked: boolean
}

export default function CashBankBookReportWrapper({ 
  activeCompanyId, 
  activeFY, 
  isLocked 
}: CashBankBookReportWrapperProps) {
  const [counters, setCounters] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([])
  const getStorageKey = () => `cashbank_${activeCompanyId}_${activeFY}`

  useEffect(() => {
    setCounters([])
    setTransactions([])
    setCustomerPayments([])
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

    const tenantDataKey = `data_${activeCompanyId}_${activeFY}`
    const tenantData = localStorage.getItem(tenantDataKey)
    if (tenantData) {
      try {
        const parsedTenantData = JSON.parse(tenantData)
        setCustomerPayments(parsedTenantData.customerPayments || [])
      } catch (error) {
        console.error('Failed to load customer payments:', error)
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
    <CashBankBookReport
      counters={counters}
      transactions={transactions}
      customerPayments={customerPayments}
      onUpdateAll={handleUpdateAll}
      isLocked={isLocked}
    />
  )
}
