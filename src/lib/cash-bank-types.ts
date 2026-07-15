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
