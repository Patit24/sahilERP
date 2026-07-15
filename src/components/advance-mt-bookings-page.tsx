import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { CalendarCheck, LockKey, Scales, ShieldCheck, Warning } from '@phosphor-icons/react'
import { Supplier } from '@/lib/types'
import { formatCurrency } from '@/lib/calculations'
import { supabase } from '@/lib/supabase-client'

type AdvanceBookingBalance = {
  company_id: string
  payment_id: string
  supplier_id: string
  supplier_name: string | null
  payment_date: string
  fy: string
  amount: number
  booking_mt: number
  picked_up_mt: number
  pending_mt: number
}

type DiscountLedgerEntry = {
  id: string
  source_type: string
  source_id: string
  supplier_id: string
  payment_id: string
  payment_date: string
  pickup_date: string
  quantity_mt: number
  payment_scheme_name: string | null
  payment_scheme_rate: number
  pickup_scheme_name: string | null
  pickup_scheme_rate: number
  applied_scheme_source: string
  applied_scheme_name: string | null
  applied_rate_per_mt: number
  discount_amount: number
  created_at: string
}

interface AdvanceMTBookingsPageProps {
  suppliers: Supplier[]
  activeCompanyId: string
  currentFY: string
  isLocked?: boolean
}

const toNumber = (value: unknown) => Number(value || 0)

export default function AdvanceMTBookingsPage({
  suppliers,
  activeCompanyId,
  currentFY,
  isLocked = false
}: AdvanceMTBookingsPageProps) {
  const [balances, setBalances] = useState<AdvanceBookingBalance[]>([])
  const [ledger, setLedger] = useState<DiscountLedgerEntry[]>([])
  const [selectedPaymentId, setSelectedPaymentId] = useState('')
  const [pickupDate, setPickupDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [quantityMT, setQuantityMT] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [setupError, setSetupError] = useState('')

  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])), [suppliers])
  const selectedBalance = balances.find((balance) => balance.payment_id === selectedPaymentId)
  const totalBooked = balances.reduce((sum, balance) => sum + toNumber(balance.booking_mt), 0)
  const totalPicked = balances.reduce((sum, balance) => sum + toNumber(balance.picked_up_mt), 0)
  const totalPending = balances.reduce((sum, balance) => sum + toNumber(balance.pending_mt), 0)
  const totalDiscount = ledger.reduce((sum, entry) => sum + toNumber(entry.discount_amount), 0)

  const loadServerData = async () => {
    if (!supabase) {
      setSetupError('Supabase is not configured. Add the environment variables and restart the app.')
      return
    }

    setLoading(true)
    setSetupError('')

    const [balancesResult, ledgerResult] = await Promise.all([
      supabase
        .from('advance_booking_balances')
        .select('*')
        .eq('company_id', activeCompanyId)
        .eq('fy', currentFY)
        .order('payment_date', { ascending: false }),
      supabase
        .from('discount_ledger_entries')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false })
        .limit(100)
    ])

    setLoading(false)

    if (balancesResult.error || ledgerResult.error) {
      const message = balancesResult.error?.message || ledgerResult.error?.message || 'Unable to load advance booking data.'
      setSetupError(`${message}. Run supabase-advance-booking.sql in Supabase SQL Editor.`)
      return
    }

    setBalances((balancesResult.data || []) as AdvanceBookingBalance[])
    setLedger((ledgerResult.data || []) as DiscountLedgerEntry[])
  }

  useEffect(() => {
    loadServerData()
  }, [activeCompanyId, currentFY])

  const handleRecordPickup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLocked) {
      toast.error('Cannot record pickup in locked mode')
      return
    }

    if (!supabase) {
      toast.error('Supabase is not configured')
      return
    }

    const qty = Number(quantityMT)
    if (!selectedPaymentId || !pickupDate || !Number.isFinite(qty) || qty <= 0) {
      toast.error('Select an advance and enter pickup quantity')
      return
    }

    setSaving(true)
    const { error } = await supabase.rpc('record_advance_pickup', {
      p_company_id: activeCompanyId,
      p_payment_id: selectedPaymentId,
      p_pickup_date: pickupDate,
      p_quantity_mt: qty,
      p_notes: notes.trim() || null
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Pickup recorded and discount ledger generated')
    setQuantityMT('')
    setNotes('')
    await loadServerData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck size={15} weight="duotone" />
            Server calculated
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Advance MT Booking</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Advance payments become bookings. Pickup discounts use max benefit logic and a locked discount ledger.
          </p>
        </div>
        <Button variant="outline" onClick={loadServerData} disabled={loading}>
          Refresh
        </Button>
      </div>

      {setupError && (
        <Alert variant="destructive">
          <Warning />
          <AlertTitle>Server workflow is not installed</AlertTitle>
          <AlertDescription>{setupError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Booked MT</p>
            <p className="mt-2 font-mono text-2xl font-bold">{totalBooked.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Picked Up MT</p>
            <p className="mt-2 font-mono text-2xl font-bold">{totalPicked.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending MT</p>
            <p className="mt-2 font-mono text-2xl font-bold text-primary">{totalPending.toFixed(3)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Ledger Discount</p>
            <p className="mt-2 font-mono text-2xl font-bold">{formatCurrency(totalDiscount)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pickup" className="space-y-5">
        <TabsList>
          <TabsTrigger value="pickup">Record Pickup</TabsTrigger>
          <TabsTrigger value="balances">Advance Balances</TabsTrigger>
          <TabsTrigger value="ledger">Discount Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="pickup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck size={20} weight="duotone" />
                Material Pickup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRecordPickup} className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Advance Payment</Label>
                    <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select advance booking" />
                      </SelectTrigger>
                      <SelectContent>
                        {balances.filter((balance) => toNumber(balance.pending_mt) > 0).map((balance) => (
                          <SelectItem key={balance.payment_id} value={balance.payment_id}>
                            {balance.supplier_name || supplierMap.get(balance.supplier_id) || 'Supplier'} - {new Date(balance.payment_date).toLocaleDateString('en-IN')} - {toNumber(balance.pending_mt).toFixed(3)} MT pending
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="pickup-date">Pickup Date</Label>
                      <Input id="pickup-date" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity-mt">Pickup Quantity (MT)</Label>
                      <Input id="quantity-mt" type="number" step="0.001" min="0.001" value={quantityMT} onChange={(event) => setQuantityMT(event.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickup-notes">Notes</Label>
                    <Textarea id="pickup-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Truck, slip, or pickup reference" />
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 font-semibold">
                    <Scales size={18} weight="duotone" />
                    Max Benefit Logic
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Supabase compares the fixed scheme on payment date with the fixed scheme on pickup date, then applies the higher rate.
                  </p>
                  <Separator className="my-4" />
                  {selectedBalance ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>Booked</span><strong>{toNumber(selectedBalance.booking_mt).toFixed(3)} MT</strong></div>
                      <div className="flex justify-between"><span>Picked up</span><strong>{toNumber(selectedBalance.picked_up_mt).toFixed(3)} MT</strong></div>
                      <div className="flex justify-between"><span>Pending</span><strong>{toNumber(selectedBalance.pending_mt).toFixed(3)} MT</strong></div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Select an advance booking to preview the balance.</p>
                  )}
                  <Button type="submit" className="mt-5 w-full" disabled={saving || isLocked}>
                    {saving ? 'Recording...' : 'Record Pickup'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">Booked MT</TableHead>
                    <TableHead className="text-right">Picked MT</TableHead>
                    <TableHead className="text-right">Pending MT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.payment_id}>
                      <TableCell>{balance.supplier_name || supplierMap.get(balance.supplier_id) || 'Supplier'}</TableCell>
                      <TableCell>{new Date(balance.payment_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(toNumber(balance.amount))}</TableCell>
                      <TableCell className="text-right font-mono">{toNumber(balance.booking_mt).toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono">{toNumber(balance.picked_up_mt).toFixed(3)}</TableCell>
                      <TableCell className="text-right font-mono">{toNumber(balance.pending_mt).toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                  {balances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No advance bookings found. Add Booking MT on a supplier payment.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKey size={20} weight="duotone" />
                Locked Discount Ledger
                <Badge variant="secondary">Read only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead>Payment Scheme</TableHead>
                    <TableHead>Pickup Scheme</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.created_at).toLocaleString('en-IN')}</TableCell>
                      <TableCell>{supplierMap.get(entry.supplier_id) || entry.supplier_id}</TableCell>
                      <TableCell>{toNumber(entry.quantity_mt).toFixed(3)} MT on {new Date(entry.pickup_date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell>{entry.payment_scheme_name || '-'} ({formatCurrency(toNumber(entry.payment_scheme_rate))}/MT)</TableCell>
                      <TableCell>{entry.pickup_scheme_name || '-'} ({formatCurrency(toNumber(entry.pickup_scheme_rate))}/MT)</TableCell>
                      <TableCell>{entry.applied_scheme_name || 'No scheme'} <Badge variant="outline">{entry.applied_scheme_source}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(toNumber(entry.discount_amount))}</TableCell>
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No server-generated discount entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
