export interface Counter {
  id: string
  name: string
  type: 'Cash' | 'Bank'
  openingBalance: number
  currentBalance: number
}

export interface CashBankTransaction {
  id: string
  date: string
  counterId: string
  counterName: string
  type: 'In' | 'Out' | 'Transfer'
  amount: number
  narration: string
  toCounterId?: string
  toCounterName?: string
}

export interface CashBankData {
  counters: Counter[]
  transactions: CashBankTransaction[]
}

export function isManualCounterTransaction(t: CashBankTransaction): boolean {
  if (!t) return false
  const id = (t.id || '').toLowerCase()
  const narration = (t.narration || '').toLowerCase()

  // External synced module transactions from Payments, Expenses, or Invoices
  if (
    id.startsWith('txn-cp-') ||
    id.startsWith('txn-sp-') ||
    id.startsWith('txn-exp-') ||
    id.startsWith('purchase-invoice-payment-') ||
    id.startsWith('sales-invoice-payment-')
  ) {
    return false
  }

  if (
    narration.includes('customer payment') ||
    narration.includes('supplier payment') ||
    narration.startsWith('expense:')
  ) {
    return false
  }

  return true
}

