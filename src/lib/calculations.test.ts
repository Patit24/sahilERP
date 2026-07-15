import { describe, expect, it } from 'vitest'
import {
  calculateExpectedAnnualDiscounts,
  calculatePaymentAllocations,
  formatCurrency
} from './calculations'
import { Payment, PurchaseInvoice, Supplier } from './types'

function invoice(overrides: Partial<PurchaseInvoice>): PurchaseInvoice {
  return {
    id: 'inv-1',
    supplierId: 'sup-1',
    invoiceNo: 'PI-001',
    invoiceDate: '2026-04-01',
    quantityMT: 10,
    invoiceAmount: 1000,
    fy: 'FY2026-27',
    createdAt: new Date('2026-04-01T08:00:00Z').getTime(),
    ...overrides
  }
}

function payment(overrides: Partial<Payment>): Payment {
  return {
    id: 'pay-1',
    supplierId: 'sup-1',
    paymentDate: '2026-04-02',
    amount: 1000,
    isAdvance: false,
    fy: 'FY2026-27',
    createdAt: new Date('2026-04-02T08:00:00Z').getTime(),
    ...overrides
  }
}

describe('calculatePaymentAllocations', () => {
  it('allocates supplier payments FIFO across older invoices first', () => {
    const invoices = [
      invoice({ id: 'inv-old', invoiceDate: '2026-04-01', invoiceAmount: 700 }),
      invoice({ id: 'inv-new', invoiceDate: '2026-04-03', invoiceAmount: 500 })
    ]
    const payments = [payment({ id: 'pay-main', paymentDate: '2026-04-04', amount: 900 })]

    const { allocations } = calculatePaymentAllocations(payments, invoices)

    expect(allocations).toEqual([
      expect.objectContaining({ paymentId: 'pay-main', invoiceId: 'inv-old', allocatedAmount: 700 }),
      expect.objectContaining({ paymentId: 'pay-main', invoiceId: 'inv-new', allocatedAmount: 200 })
    ])
  })

  it('uses same-day createdAt timestamps to keep invoice/payment order stable', () => {
    const sameDay = '2026-04-01'
    const invoices = [
      invoice({
        id: 'inv-same-day',
        invoiceDate: sameDay,
        invoiceAmount: 500,
        createdAt: new Date('2026-04-01T09:00:00Z').getTime()
      })
    ]
    const payments = [
      payment({
        id: 'pay-before-invoice',
        paymentDate: sameDay,
        amount: 500,
        createdAt: new Date('2026-04-01T08:00:00Z').getTime()
      })
    ]

    const { allocations, paymentAdvanceInfo } = calculatePaymentAllocations(payments, invoices)

    expect(allocations).toHaveLength(1)
    expect(allocations[0]).toEqual(expect.objectContaining({
      paymentId: 'pay-before-invoice',
      invoiceId: 'inv-same-day',
      allocatedAmount: 500
    }))
    expect(paymentAdvanceInfo.get('pay-before-invoice')?.advanceAmount).toBe(500)
  })

  it('tracks the advance portion when payment exceeds current outstanding', () => {
    const invoices = [invoice({ id: 'inv-small', invoiceAmount: 300 })]
    const payments = [payment({ id: 'pay-large', amount: 1000 })]

    const { paymentAdvanceInfo } = calculatePaymentAllocations(payments, invoices)

    expect(paymentAdvanceInfo.get('pay-large')).toEqual(expect.objectContaining({
      allocatedAmount: 300,
      advanceAmount: 700,
      outstandingAtPaymentTime: 300
    }))
  })
})

describe('annual discount calculations', () => {
  it('calculates annual expected discount from supplier target rate and achieved MT', () => {
    const suppliers: Supplier[] = [
      {
        id: 'sup-1',
        name: 'Supplier One',
        paymentCDRules: [],
        invoiceCloseCDRules: [],
        annualTarget: { targetMT: 100, ratePerMT: 25 }
      }
    ]
    const invoices = [
      invoice({ id: 'inv-a', quantityMT: 40 }),
      invoice({ id: 'inv-b', quantityMT: 10 })
    ]

    const result = calculateExpectedAnnualDiscounts(invoices, suppliers)

    expect(result).toEqual([
      expect.objectContaining({
        supplierId: 'sup-1',
        achievedMT: 50,
        expectedAmount: 1250
      })
    ])
  })
})

describe('formatCurrency', () => {
  it('formats Indian currency values consistently', () => {
    expect(formatCurrency(123456.78)).toContain('1,23,456.78')
  })
})
