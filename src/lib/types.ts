export interface Item {
  id: string
  name: string
  unit: 'MT' | 'KG' | 'PCS' | 'TON'
  description?: string
  openingStock?: number
  openingValue?: number
  category?: string
  purchasePrice?: number
  salesPrice?: number
  gstRate?: number
  itemCode?: string
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  address?: string
  state?: string
  pincode?: string
  city?: string
  shippingSameAsBilling?: boolean
  shippingAddress?: string
  shippingState?: string
  shippingPincode?: string
  shippingCity?: string
  gstin?: string
  paymentCDRules: PaymentCDRule[]
  invoiceCloseCDRules: InvoiceCloseCDRule[]
  advanceCDPercentage?: number
  cdRuleVersions?: SupplierCDRuleVersion[]
  cdRuleChangeLog?: CDRuleChangeLog[]
  annualTarget?: AnnualTarget
  openingBalance?: number
}

export interface PaymentCDRule {
  minDays: number
  maxDays: number
  percentageRate: number
}

export interface InvoiceCloseCDRule {
  minDays: number
  maxDays: number
  ratePerMT: number
}

export type RuleApprovalStatus = 'Pending' | 'Approved' | 'Rejected'

export interface SupplierCDRuleVersion {
  id: string
  version: number
  ruleName: string
  effectiveFrom: string
  effectiveTo?: string
  paymentCDRules: PaymentCDRule[]
  invoiceCloseCDRules: InvoiceCloseCDRule[]
  advanceCDPercentage?: number
  changedBy: string
  changedAt: string
  reason: string
  approvalStatus: RuleApprovalStatus
}

export interface CDRuleChangeLog {
  id: string
  supplierId: string
  ruleName: string
  ruleVersion: number
  previousValues: {
    paymentCDRules: PaymentCDRule[]
    invoiceCloseCDRules: InvoiceCloseCDRule[]
    advanceCDPercentage?: number
    effectiveFrom?: string
    effectiveTo?: string
  }
  newValues: {
    paymentCDRules: PaymentCDRule[]
    invoiceCloseCDRules: InvoiceCloseCDRule[]
    advanceCDPercentage?: number
    effectiveFrom: string
    effectiveTo?: string
  }
  effectiveDate: string
  changedBy: string
  changedAt: string
  reason: string
  approvalStatus: RuleApprovalStatus
}

export interface FixedScheme {
  id: string
  supplierId: string
  schemeName: string
  ratePerMT: number
  fromDate: string
  toDate: string
  applyInMTBooking?: boolean
  version?: number
  parentSchemeId?: string
  previousSchemeId?: string
  changedBy?: string
  changedAt?: string
  changeReason?: string
  approvalStatus?: RuleApprovalStatus
}

export interface AnnualTarget {
  targetMT: number
  ratePerMT: number
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  state?: string
  pincode?: string
  city?: string
  shippingSameAsBilling?: boolean
  shippingAddress?: string
  shippingState?: string
  shippingPincode?: string
  shippingCity?: string
  gstin?: string
  openingBalance?: number
}

export interface InvoiceItem {
  itemId: string
  quantityMT: number
  basicRate?: number
  rate: number
  amount: number
}

export interface PurchaseInvoice {
  id: string
  supplierId: string
  invoiceNo: string
  invoiceDate: string
  orderDate?: string
  items?: InvoiceItem[]
  quantityMT: number
  invoiceAmount: number
  additionalCost?: number
  additionalCostBasicRate?: number
  additionalCostRemarks?: string
  roundOffAdjustment?: number

  fy: string
  createdAt?: number
}

export interface Payment {
  id: string
  supplierId: string
  paymentDate: string
  amount: number
  paymentMode?: string
  isAdvance: boolean
  bookingMT?: number
  bookingMarketRate?: number
  mtBookingId?: string
  doNotApplyCD?: boolean
  fy: string
  createdAt?: number
  advanceCDSnapshot?: number
}

export interface PaymentAllocation {
  id: string
  paymentId: string
  invoiceId: string
  allocatedAmount: number
  fy: string
}

export interface PaymentAdvanceInfo {
  paymentId: string
  advanceAmount: number
  allocatedAmount: number
  outstandingAtPaymentTime: number
  allocationIsAdvanceMap: Map<string, boolean>
}

export interface ReceivedDiscount {
  id: string
  supplierId: string
  discountReceivedDate: string
  amount: number
  notes: string
  status: 'Allocated' | 'Advance'
  type: 'wallet' | 'annual'
  fy: string
  allocateToDiscountType?: 'paymentCD' | 'invoiceCloseCD' | 'fixedScheme' | 'advanceCD'
  allocateToSchemeName?: string
}

export interface DiscountAllocation {
  id: string
  receivedDiscountId: string
  expectedDiscountId: string
  allocatedAmount: number
}

export interface ExpectedDiscount {
  id: string
  supplierId: string
  invoiceId?: string
  schemeId?: string
  paymentId?: string
  ruleVersionId?: string
  ruleVersion?: number
  ruleName?: string
  type: 'paymentCD' | 'invoiceCloseCD' | 'fixedScheme' | 'annual' | 'advanceCD'
  earnedDate: string
  invoiceDate?: string
  eligibleQuantityMT: number
  ratePerMT: number
  expectedAmount: number
  invoiceNo?: string
  schemeName?: string
  mtBookingId?: string
  mtBookingRuleSource?: 'current' | 'previous'
  marketRateComparison?: 'currentLower' | 'currentHigher' | 'equal' | 'legacy'
  bookedMarketRate?: number
  currentMarketRate?: number
}

export interface ExpectedAnnualDiscount {
  id: string
  supplierId: string
  supplierName: string
  targetMT: number
  achievedMT: number
  ratePerMT: number
  expectedAmount: number
}

export interface PendingDiscount extends ExpectedDiscount {
  receivedAmount: number
  pendingAmount: number
  status: 'Pending' | 'Partially Received' | 'Received'
}

export interface PendingAnnualDiscount extends ExpectedAnnualDiscount {
  receivedAmount: number
  pendingAmount: number
  status: 'Pending' | 'Partially Received' | 'Received'
}

export type DiscountCategory = 'paymentCD' | 'invoiceCloseCD' | 'fixedScheme' | 'advanceCD' | 'annual' | 'all'

export interface SalesInvoice {
  id: string
  customerId: string
  invoiceNo: string
  invoiceDate: string
  items?: InvoiceItem[]
  quantityMT: number
  invoiceAmount: number
  additionalCost?: number
  additionalCostBasicRate?: number
  additionalCostRemarks?: string
  roundOffAdjustment?: number

  fy: string
}

export interface CustomerPayment {
  id: string
  customerId: string
  paymentDate: string
  amount: number
  notes?: string
  counterId: string
  counterName: string
  fy: string
}

export interface LedgerEntry {
  date: string
  description: string
  invoiceNo?: string
  debit: number
  credit: number
  balance: number
  type: 'invoice' | 'payment'
  refId: string
}

export interface ExpenseType {
  id: string
  name: string
  description?: string
  linkType: 'invoice' | 'netprofit'
}

export interface ExpenseEntry {
  id: string
  supplierId?: string
  expenseTypeId: string
  expenseDate: string
  amount: number
  linkedInvoiceId?: string
  originalInvoiceNumber?: string
  paymentMode?: string
  expenseWithGst?: boolean
  notes?: string
  fy: string
}

export interface LockedScheme {
  schemeId: string
  schemeName: string
  ratePerMT: number
  ruleVersionId?: string
  ruleVersion?: number
  effectiveFrom?: string
  effectiveTo?: string
}

export type MTBookingTieBreakPreference = 'current' | 'previous' | 'highestBenefit' | 'manual'

export interface MTBooking {
  id: string
  supplierId: string
  orderDate: string
  consumeStartDate: string
  bookedMT: number
  notes?: string
  fy: string
  rateMode: 'auto' | 'manual'
  lockedSchemes?: LockedScheme[]
  totalLockedRate?: number
  manualRate?: number
  bookedMarketRate?: number
  tieBreakPreference?: MTBookingTieBreakPreference
  manualSelection?: 'current' | 'previous'
}

export interface MTBookingConsumption {
  bookingId: string
  invoiceId: string
  consumedMT: number
  lockedCDRate: number
  lockedSchemeName: string
}
