import { useEffect, useState } from 'react'
import { Customer, Supplier, SupplierCDRuleVersion, CDRuleChangeLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { UserPlus } from '@phosphor-icons/react'
import { toast } from 'sonner'

type PartyType = 'supplier' | 'customer'
type Party = Supplier | Customer

interface PartyEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PartyType
  party?: Party | null
  existingParties?: Party[]
  changedBy?: string
  onSave: (party: Party) => void
}

function isSupplier(type: PartyType, party?: Party | null): party is Supplier {
  return type === 'supplier' && !!party
}

function trimOrUndefined(value: string) {
  return value.trim() || undefined
}

function makeSupplierRuleVersion(
  supplierId: string,
  version: number,
  advanceCDPercentage: number | undefined,
  changedBy: string,
  reason: string
): SupplierCDRuleVersion {
  return {
    id: `${supplierId}-cd-version-${version}-${Date.now()}`,
    version,
    ruleName: 'Supplier CD Rules',
    effectiveFrom: new Date().toISOString().split('T')[0],
    paymentCDRules: [],
    invoiceCloseCDRules: [],
    advanceCDPercentage,
    changedBy,
    changedAt: new Date().toISOString(),
    reason,
    approvalStatus: 'Approved'
  }
}

export function PartyEditorDialog({
  open,
  onOpenChange,
  type,
  party,
  existingParties = [],
  changedBy = 'Master Admin',
  onSave
}: PartyEditorDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [city, setCity] = useState('')
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true)
  const [shippingAddress, setShippingAddress] = useState('')
  const [shippingState, setShippingState] = useState('')
  const [shippingPincode, setShippingPincode] = useState('')
  const [shippingCity, setShippingCity] = useState('')
  const [gstin, setGstin] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [advanceCD, setAdvanceCD] = useState('')
  const [targetMT, setTargetMT] = useState('')
  const [targetRate, setTargetRate] = useState('')

  useEffect(() => {
    if (!open) return

    setName(party?.name || '')
    setPhone(party?.phone || '')
    setEmail(('email' in (party || {}) ? (party as Customer).email : '') || '')
    setAddress(party?.address || '')
    setState(party?.state || '')
    setPincode(party?.pincode || '')
    setCity(party?.city || '')
    setShippingSameAsBilling(party?.shippingSameAsBilling ?? true)
    setShippingAddress(party?.shippingAddress || '')
    setShippingState(party?.shippingState || '')
    setShippingPincode(party?.shippingPincode || '')
    setShippingCity(party?.shippingCity || '')
    setGstin(party?.gstin || '')
    setOpeningBalance(party?.openingBalance?.toString() || '')
    setAdvanceCD(isSupplier(type, party) ? party.advanceCDPercentage?.toString() || '' : '')
    setTargetMT(isSupplier(type, party) ? party.annualTarget?.targetMT?.toString() || '' : '')
    setTargetRate(isSupplier(type, party) ? party.annualTarget?.ratePerMT?.toString() || '' : '')
  }, [open, party, type])

  const clearAddress = () => {
    setAddress('')
    setState('')
    setPincode('')
    setCity('')
    setShippingAddress('')
    setShippingState('')
    setShippingPincode('')
    setShippingCity('')
    setShippingSameAsBilling(true)
  }

  const handleSave = () => {
    const cleanName = name.trim()

    if (!cleanName) {
      toast.error('Party name is required')
      return
    }

    const duplicate = existingParties.some((candidate) => (
      candidate.id !== party?.id &&
      candidate.name.trim().toLowerCase() === cleanName.toLowerCase()
    ))

    if (duplicate) {
      toast.error(`${type === 'supplier' ? 'Supplier' : 'Customer'} already exists`)
      return
    }

    const cleanShippingAddress = shippingSameAsBilling ? address : shippingAddress
    const cleanShippingState = shippingSameAsBilling ? state : shippingState
    const cleanShippingPincode = shippingSameAsBilling ? pincode : shippingPincode
    const cleanShippingCity = shippingSameAsBilling ? city : shippingCity
    const openingBalanceValue = parseFloat(openingBalance) || 0

    if (type === 'supplier') {
      const supplier = party as Supplier | null | undefined
      const supplierId = supplier?.id || `supplier-${Date.now()}`
      const advanceCDValue = parseFloat(advanceCD) || 0
      const targetMTValue = parseFloat(targetMT) || 0
      const targetRateValue = parseFloat(targetRate) || 0
      const existingVersions = supplier?.cdRuleVersions || []
      const cdChanged = (supplier?.advanceCDPercentage || 0) !== advanceCDValue
      const nextVersion = Math.max(0, ...existingVersions.map((version) => version.version)) + 1
      const initialVersion = existingVersions.length > 0
        ? undefined
        : makeSupplierRuleVersion(supplierId, 1, advanceCDValue || undefined, changedBy, 'Initial supplier rule setup')
      const changedVersion = supplier && cdChanged
        ? makeSupplierRuleVersion(supplierId, nextVersion, advanceCDValue || undefined, changedBy, 'Supplier profile update')
        : undefined
      const changedAt = new Date().toISOString()
      const changeLog: CDRuleChangeLog | undefined = supplier && cdChanged ? {
        id: `${supplierId}-cd-change-${Date.now()}`,
        supplierId,
        ruleName: 'Supplier CD Rules',
        ruleVersion: changedVersion?.version || nextVersion,
        previousValues: {
          paymentCDRules: supplier.paymentCDRules || [],
          invoiceCloseCDRules: supplier.invoiceCloseCDRules || [],
          advanceCDPercentage: supplier.advanceCDPercentage
        },
        newValues: {
          paymentCDRules: supplier.paymentCDRules || [],
          invoiceCloseCDRules: supplier.invoiceCloseCDRules || [],
          advanceCDPercentage: advanceCDValue || undefined,
          effectiveFrom: new Date().toISOString().split('T')[0]
        },
        effectiveDate: new Date().toISOString().split('T')[0],
        changedBy,
        changedAt,
        reason: 'Supplier profile update',
        approvalStatus: 'Approved'
      } : undefined

      onSave({
        ...(supplier || {}),
        id: supplierId,
        name: cleanName,
        phone: trimOrUndefined(phone),
        address: trimOrUndefined(address),
        state: trimOrUndefined(state),
        pincode: trimOrUndefined(pincode),
        city: trimOrUndefined(city),
        shippingSameAsBilling,
        shippingAddress: trimOrUndefined(cleanShippingAddress),
        shippingState: trimOrUndefined(cleanShippingState),
        shippingPincode: trimOrUndefined(cleanShippingPincode),
        shippingCity: trimOrUndefined(cleanShippingCity),
        gstin: trimOrUndefined(gstin.toUpperCase()),
        openingBalance: openingBalanceValue !== 0 ? openingBalanceValue : undefined,
        advanceCDPercentage: advanceCDValue > 0 ? advanceCDValue : undefined,
        annualTarget: targetMTValue > 0 || targetRateValue > 0 ? {
          targetMT: targetMTValue,
          ratePerMT: targetRateValue
        } : undefined,
        paymentCDRules: supplier?.paymentCDRules || [],
        invoiceCloseCDRules: supplier?.invoiceCloseCDRules || [],
        cdRuleVersions: [
          ...existingVersions,
          ...(initialVersion ? [initialVersion] : []),
          ...(changedVersion ? [changedVersion] : [])
        ],
        cdRuleChangeLog: [
          ...(supplier?.cdRuleChangeLog || []),
          ...(changeLog ? [changeLog] : [])
        ]
      } satisfies Supplier)
    } else {
      const customer = party as Customer | null | undefined
      onSave({
        ...(customer || {}),
        id: customer?.id || `customer-${Date.now()}`,
        name: cleanName,
        phone: trimOrUndefined(phone),
        email: trimOrUndefined(email),
        address: trimOrUndefined(address),
        state: trimOrUndefined(state),
        pincode: trimOrUndefined(pincode),
        city: trimOrUndefined(city),
        shippingSameAsBilling,
        shippingAddress: trimOrUndefined(cleanShippingAddress),
        shippingState: trimOrUndefined(cleanShippingState),
        shippingPincode: trimOrUndefined(cleanShippingPincode),
        shippingCity: trimOrUndefined(cleanShippingCity),
        gstin: trimOrUndefined(gstin.toUpperCase()),
        openingBalance: openingBalanceValue !== 0 ? openingBalanceValue : undefined
      } satisfies Customer)
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(720px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserPlus size={22} className="text-primary" weight="duotone" />
            {party ? `Edit ${type === 'supplier' ? 'Supplier' : 'Customer'}` : 'Create New Party'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="sharedPartyName">Party Name <span className="text-destructive">*</span></Label>
            <Input
              id="sharedPartyName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter name"
              className="h-11"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sharedPartyPhone">Mobile Number</Label>
              <Input
                id="sharedPartyPhone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Enter Mobile Number"
                className="h-11"
              />
            </div>
            {type === 'customer' && (
              <div className="space-y-2">
                <Label htmlFor="sharedPartyEmail">Email</Label>
                <Input
                  id="sharedPartyEmail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter Email"
                  className="h-11"
                />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-muted/20">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="font-semibold">Address (Optional)</div>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={clearAddress}>
                Remove
              </Button>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <Label htmlFor="sharedPartyAddress" className="text-xs uppercase text-muted-foreground">
                  Billing Address
                </Label>
                <Textarea
                  id="sharedPartyAddress"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Enter billing address"
                  rows={3}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sharedPartyState" className="text-xs uppercase text-muted-foreground">State</Label>
                  <Input id="sharedPartyState" value={state} onChange={(event) => setState(event.target.value)} placeholder="Enter State" className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sharedPartyPincode" className="text-xs uppercase text-muted-foreground">Pincode</Label>
                  <Input id="sharedPartyPincode" value={pincode} onChange={(event) => setPincode(event.target.value)} placeholder="Enter Pincode" className="h-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sharedPartyCity" className="text-xs uppercase text-muted-foreground">City</Label>
                <Input id="sharedPartyCity" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Enter City" className="h-10" />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={shippingSameAsBilling}
                  onChange={(event) => setShippingSameAsBilling(event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Shipping address same as billing address
              </label>
              {!shippingSameAsBilling && (
                <div className="space-y-4 rounded-lg border border-border bg-background/70 p-4">
                  <div className="font-semibold">Shipping Address</div>
                  <div className="space-y-2">
                    <Label htmlFor="sharedPartyShippingAddress" className="text-xs uppercase text-muted-foreground">
                      Shipping Address
                    </Label>
                    <Textarea
                      id="sharedPartyShippingAddress"
                      value={shippingAddress}
                      onChange={(event) => setShippingAddress(event.target.value)}
                      placeholder="Enter shipping address"
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sharedPartyShippingState" className="text-xs uppercase text-muted-foreground">State</Label>
                      <Input id="sharedPartyShippingState" value={shippingState} onChange={(event) => setShippingState(event.target.value)} placeholder="Enter State" className="h-10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sharedPartyShippingPincode" className="text-xs uppercase text-muted-foreground">Pincode</Label>
                      <Input id="sharedPartyShippingPincode" value={shippingPincode} onChange={(event) => setShippingPincode(event.target.value)} placeholder="Enter Pincode" className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sharedPartyShippingCity" className="text-xs uppercase text-muted-foreground">City</Label>
                    <Input id="sharedPartyShippingCity" value={shippingCity} onChange={(event) => setShippingCity(event.target.value)} placeholder="Enter City" className="h-10" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="font-semibold">GSTIN (Optional)</div>
              <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setGstin('')}>
                Remove
              </Button>
            </div>
            <div className="space-y-2 p-4">
              <Label htmlFor="sharedPartyGstin" className="text-xs uppercase text-muted-foreground">GSTIN</Label>
              <Input
                id="sharedPartyGstin"
                value={gstin}
                onChange={(event) => setGstin(event.target.value.toUpperCase())}
                placeholder="ex: 29XXXXX9438X1XX"
                className="h-10"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="mb-3 font-semibold">Accounting Details</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sharedPartyOpeningBalance">Opening Balance (₹)</Label>
                <Input
                  id="sharedPartyOpeningBalance"
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(event) => setOpeningBalance(event.target.value)}
                  placeholder="0.00"
                  className="h-10 font-mono"
                />
              </div>
              {type === 'supplier' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sharedSupplierAdvanceCD">Advance CD (%)</Label>
                    <Input
                      id="sharedSupplierAdvanceCD"
                      type="number"
                      step="0.01"
                      value={advanceCD}
                      onChange={(event) => setAdvanceCD(event.target.value)}
                      placeholder="0.00"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sharedSupplierTargetMT">Annual Target MT</Label>
                    <Input
                      id="sharedSupplierTargetMT"
                      type="number"
                      step="0.001"
                      value={targetMT}
                      onChange={(event) => setTargetMT(event.target.value)}
                      placeholder="0.000"
                      className="h-10 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sharedSupplierTargetRate">Target Rate/MT (₹)</Label>
                    <Input
                      id="sharedSupplierTargetRate"
                      type="number"
                      step="0.01"
                      value={targetRate}
                      onChange={(event) => setTargetRate(event.target.value)}
                      placeholder="0.00"
                      className="h-10 font-mono"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {party ? 'Save Changes' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
