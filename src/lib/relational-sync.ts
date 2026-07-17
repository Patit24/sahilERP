import { supabase } from './supabase-client'
import { canUseRemoteStorage, RemoteStorageUnavailableError } from './remote-storage'
import { TenantData } from './storage-utils'

type SupabaseErrorLike = { code?: string; message?: string; status?: number; details?: string } | null
type RelationalRow = Record<string, unknown> & { id?: string; raw_data?: unknown }

const emptyTenantData: TenantData = {
  suppliers: [],
  customers: [],
  items: [],
  invoices: [],
  payments: [],
  receivedDiscounts: [],
  salesInvoices: [],
  customerPayments: [],
  expenseTypes: [],
  expenseEntries: [],
  fixedSchemes: [],
  mtBookings: []
}

export class RelationalStorageNotReadyError extends Error {
  constructor(message = 'Relational ERP tables are not installed yet. Falling back to legacy snapshot storage.') {
    super(message)
    this.name = 'RelationalStorageNotReadyError'
  }
}

function normalizeTenantData(data: Partial<TenantData> | null | undefined): TenantData {
  return {
    suppliers: data?.suppliers || [],
    customers: data?.customers || [],
    items: data?.items || [],
    invoices: data?.invoices || [],
    payments: data?.payments || [],
    receivedDiscounts: data?.receivedDiscounts || [],
    salesInvoices: data?.salesInvoices || [],
    customerPayments: data?.customerPayments || [],
    expenseTypes: data?.expenseTypes || [],
    expenseEntries: data?.expenseEntries || [],
    fixedSchemes: data?.fixedSchemes || [],
    mtBookings: data?.mtBookings || []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rawDataOrFallback(row: RelationalRow, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...fallback,
    ...(isRecord(row.raw_data) ? row.raw_data : {})
  }
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function groupByInvoiceId(rows: RelationalRow[]): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>()
  rows.forEach((row) => {
    const invoiceId = stringValue(row.invoice_id)
    if (!invoiceId) return
    const item = rawDataOrFallback(row, {
      id: row.id,
      itemId: row.item_id,
      qty: numberValue(row.qty),
      basicRate: numberValue(row.basic_rate),
      rate: numberValue(row.rate),
      amount: numberValue(row.amount),
      gstRate: numberValue(row.gst_rate)
    })
    grouped.set(invoiceId, [...(grouped.get(invoiceId) || []), item])
  })
  return grouped
}

function isMissingRelationalSchema(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.status === 404 ||
    error.code === 'PGRST202' ||
    error.code === 'PGRST204' ||
    message.includes('could not find the function') ||
    message.includes('function public.get_relational_tenant') ||
    message.includes('function public.sync_relational_tenant') ||
    message.includes('relation "public.erp_')
  )
}

function isTransientSupabaseError(error: SupabaseErrorLike): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return (
    error.status === 503 ||
    error.status === 504 ||
    error.code === '503' ||
    error.code === '504' ||
    error.code === 'PGRST002' ||
    error.code === 'PGRST003' ||
    message.includes('service unavailable') ||
    message.includes('gateway timeout') ||
    message.includes('schema cache') ||
    message.includes('connection pool') ||
    message.includes('timed out acquiring') ||
    message.includes('fetch failed') ||
    message.includes('network')
  )
}

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new RemoteStorageUnavailableError('Supabase relational data request timed out.'))
    }, timeoutMs)

    Promise.resolve(promise)
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId))
  })
}

async function selectRelationalRows(table: string, companyId: string, fy?: string): Promise<RelationalRow[]> {
  if (!supabase) return []

  let query = supabase
    .from(table)
    .select('*')
    .eq('company_id', companyId)

  if (fy) {
    query = query.eq('fy', fy)
  }

  const { data, error } = await withTimeout(query)

  if (error) {
    if (isMissingRelationalSchema(error)) {
      throw new RelationalStorageNotReadyError()
    }
    if (isTransientSupabaseError(error)) {
      console.error(`Supabase relational table load temporarily unavailable for ${table}:`, error)
      throw new RemoteStorageUnavailableError('Supabase data load timed out. Saved data was not overwritten.')
    }
    console.error(`Supabase relational table load failed for ${table}:`, error)
    throw new Error(error.message)
  }

  return ((data || []) as RelationalRow[])
}

async function loadRelationalTablesDirect(companyId: string, fy: string): Promise<TenantData> {
  const [
    suppliers,
    customers,
    items,
    purchaseInvoices,
    purchaseInvoiceItems,
    payments,
    salesInvoices,
    salesInvoiceItems,
    customerPayments,
    expenseTypes,
    expenseEntries,
    fixedSchemes,
    mtBookings,
    receivedDiscounts
  ] = await Promise.all([
    selectRelationalRows('erp_suppliers', companyId),
    selectRelationalRows('erp_customers', companyId),
    selectRelationalRows('erp_items', companyId),
    selectRelationalRows('erp_purchase_invoices', companyId, fy),
    selectRelationalRows('erp_purchase_invoice_items', companyId, fy),
    selectRelationalRows('erp_supplier_payments', companyId, fy),
    selectRelationalRows('erp_sales_invoices', companyId, fy),
    selectRelationalRows('erp_sales_invoice_items', companyId, fy),
    selectRelationalRows('erp_customer_payments', companyId, fy),
    selectRelationalRows('erp_expense_types', companyId),
    selectRelationalRows('erp_expense_entries', companyId, fy),
    selectRelationalRows('erp_fixed_schemes', companyId),
    selectRelationalRows('erp_mt_bookings', companyId, fy),
    selectRelationalRows('erp_received_discounts', companyId, fy)
  ])

  const purchaseItemsByInvoice = groupByInvoiceId(purchaseInvoiceItems)
  const salesItemsByInvoice = groupByInvoiceId(salesInvoiceItems)

  return normalizeTenantData({
    suppliers: suppliers.map((row) => rawDataOrFallback(row, {
      id: row.id,
      name: row.name,
      phone: row.phone,
      openingBalance: numberValue(row.opening_balance)
    })),
    customers: customers.map((row) => rawDataOrFallback(row, {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      openingBalance: numberValue(row.opening_balance)
    })),
    items: items.map((row) => rawDataOrFallback(row, {
      id: row.id,
      name: row.name,
      unit: row.unit,
      purchasePrice: numberValue(row.purchase_price),
      salesPrice: numberValue(row.sales_price),
      gstRate: numberValue(row.gst_rate),
      openingStock: numberValue(row.opening_stock)
    })),
    invoices: purchaseInvoices.map((row) => rawDataOrFallback(row, {
      id: row.id,
      invoiceNo: row.invoice_no,
      supplierId: row.supplier_id,
      date: row.invoice_date,
      items: purchaseItemsByInvoice.get(stringValue(row.id)) || [],
      totalAmount: numberValue(row.total_amount),
      paidAmount: numberValue(row.paid_amount),
      status: row.status
    })),
    payments: payments.map((row) => rawDataOrFallback(row, {
      id: row.id,
      supplierId: row.supplier_id,
      date: row.payment_date,
      amount: numberValue(row.amount),
      type: row.payment_type,
      bookingQuantity: numberValue(row.booking_quantity)
    })),
    receivedDiscounts: receivedDiscounts.map((row) => rawDataOrFallback(row, {
      id: row.id,
      supplierId: row.supplier_id,
      date: row.discount_date,
      amount: numberValue(row.amount)
    })),
    salesInvoices: salesInvoices.map((row) => rawDataOrFallback(row, {
      id: row.id,
      invoiceNo: row.invoice_no,
      customerId: row.customer_id,
      date: row.invoice_date,
      items: salesItemsByInvoice.get(stringValue(row.id)) || [],
      totalAmount: numberValue(row.total_amount),
      receivedAmount: numberValue(row.received_amount),
      status: row.status
    })),
    customerPayments: customerPayments.map((row) => rawDataOrFallback(row, {
      id: row.id,
      customerId: row.customer_id,
      date: row.payment_date,
      amount: numberValue(row.amount)
    })),
    expenseTypes: expenseTypes.map((row) => rawDataOrFallback(row, { id: row.id, name: row.name })),
    expenseEntries: expenseEntries.map((row) => rawDataOrFallback(row, {
      id: row.id,
      expenseTypeId: row.expense_type_id,
      date: row.expense_date,
      amount: numberValue(row.amount)
    })),
    fixedSchemes: fixedSchemes.map((row) => rawDataOrFallback(row, { id: row.id, name: row.name })),
    mtBookings: mtBookings.map((row) => rawDataOrFallback(row, {
      id: row.id,
      supplierId: row.supplier_id,
      itemId: row.item_id,
      bookingDate: row.booking_date,
      bookedQuantity: numberValue(row.booked_quantity),
      pendingQuantity: numberValue(row.pending_quantity)
    }))
  })
}

export async function loadRelationalTenantData(companyId: string, fy: string): Promise<TenantData | null> {
  if (!canUseRemoteStorage() || !supabase) return null

  const { data, error } = await withTimeout(
    supabase.rpc('get_relational_tenant', {
      p_company_id: companyId,
      p_fy: fy
    })
  )

  if (error) {
    if (isMissingRelationalSchema(error)) {
      return loadRelationalTablesDirect(companyId, fy)
    }
    if (isTransientSupabaseError(error)) {
      console.error('Supabase relational load temporarily unavailable:', error)
      throw new RemoteStorageUnavailableError('Supabase data load timed out. Saved data was not overwritten.')
    }
    console.error('Supabase relational load failed:', error)
    throw new Error(error.message)
  }

  return normalizeTenantData((data as Partial<TenantData>) || emptyTenantData)
}

export async function saveRelationalTenantData(
  companyId: string,
  fy: string,
  payload: TenantData
): Promise<void> {
  if (!canUseRemoteStorage() || !supabase) return

  const { error } = await withTimeout(
    supabase.rpc('sync_relational_tenant', {
      p_company_id: companyId,
      p_fy: fy,
      p_payload: payload
    })
  )

  if (error) {
    if (isMissingRelationalSchema(error)) {
      throw new RelationalStorageNotReadyError()
    }
    if (isTransientSupabaseError(error)) {
      console.error('Supabase relational save temporarily unavailable:', error)
      throw new RemoteStorageUnavailableError()
    }
    console.error('Supabase relational save failed:', error)
    throw new Error(error.message)
  }
}

export async function syncRelationalTenantData(
  companyId: string,
  fy: string,
  payload: TenantData
): Promise<void> {
  await saveRelationalTenantData(companyId, fy, payload)
}
