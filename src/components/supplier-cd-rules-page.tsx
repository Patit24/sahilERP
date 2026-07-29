import { useState, useEffect } from 'react'
import { Supplier, PaymentCDRule, InvoiceCloseCDRule } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tag, CalendarBlank, Trash, UserPlus, Info, CheckCircle, Percent } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/calculations'
import { toast } from 'sonner'

interface SupplierCDRulesPageProps {
  suppliers: Supplier[]
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void
  isLocked?: boolean
}

const availableUnits = [
  { value: 'MT', label: 'MT' },
  { value: 'PCS', label: 'PCS' },
  { value: 'BOX', label: 'BOX' },
  { value: 'PKT', label: 'PKT' },
  { value: 'BTL', label: 'BTL' },
  { value: 'JAR', label: 'JAR' },
  { value: 'TIN', label: 'TIN' },
  { value: 'KG', label: 'KG' },
]

export default function SupplierCDRulesPage({ suppliers, setSuppliers, isLocked }: SupplierCDRulesPageProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  
  // State for CD Rules Form
  const [effectiveFromDate, setEffectiveFromDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [advanceCDPercentage, setAdvanceCDPercentage] = useState<string>('')
  const [paymentCDRules, setPaymentCDRules] = useState<PaymentCDRule[]>([])
  const [invoiceCloseCDRules, setInvoiceCloseCDRules] = useState<InvoiceCloseCDRule[]>([])
  const [targetMT, setTargetMT] = useState<string>('')
  const [targetRatePerMT, setTargetRatePerMT] = useState<string>('')
  const [changeReason, setChangeReason] = useState<string>('')

  // Add Tier Inline Inputs
  const [newPayMinDays, setNewPayMinDays] = useState<string>('')
  const [newPayMaxDays, setNewPayMaxDays] = useState<string>('')
  const [newPayRate, setNewPayRate] = useState<string>('')

  // Add Invoice Close Rule Inline Inputs
  const [newCloseMinDays, setNewCloseMinDays] = useState<string>('')
  const [newCloseMaxDays, setNewCloseMaxDays] = useState<string>('')
  const [newCloseRate, setNewCloseRate] = useState<string>('')
  const [newCloseUnit, setNewCloseUnit] = useState<string>('MT')

  // Auto-select first supplier if available
  useEffect(() => {
    if (suppliers.length > 0 && !selectedSupplierId) {
      setSelectedSupplierId(suppliers[0].id)
    }
  }, [suppliers, selectedSupplierId])

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

  // Load supplier CD rules when selection changes
  useEffect(() => {
    if (selectedSupplier) {
      setAdvanceCDPercentage(selectedSupplier.advanceCDPercentage !== undefined ? String(selectedSupplier.advanceCDPercentage) : '')
      setPaymentCDRules(selectedSupplier.paymentCDRules || [])
      setInvoiceCloseCDRules(selectedSupplier.invoiceCloseCDRules || [])
      setTargetMT(selectedSupplier.annualTarget?.targetMT !== undefined ? String(selectedSupplier.annualTarget.targetMT) : '')
      setTargetRatePerMT(selectedSupplier.annualTarget?.ratePerMT !== undefined ? String(selectedSupplier.annualTarget.ratePerMT) : '')
      setEffectiveFromDate(selectedSupplier.cdRuleVersions?.[0]?.effectiveFrom || new Date().toISOString().split('T')[0])
      setChangeReason('')
    } else {
      setAdvanceCDPercentage('')
      setPaymentCDRules([])
      setInvoiceCloseCDRules([])
      setTargetMT('')
      setTargetRatePerMT('')
    }
  }, [selectedSupplierId, selectedSupplier])

  const handleAddPaymentCDTier = () => {
    const min = parseInt(newPayMinDays)
    const max = parseInt(newPayMaxDays)
    const rate = parseFloat(newPayRate)

    if (isNaN(min) || isNaN(max) || isNaN(rate)) {
      toast.error('Please enter valid numbers for Payment CD tier')
      return
    }

    if (min < 0 || max < min) {
      toast.error('Invalid day range (Min Days must be <= Max Days)')
      return
    }

    setPaymentCDRules((prev) => [...prev, { minDays: min, maxDays: max, percentageRate: rate }])
    setNewPayMinDays('')
    setNewPayMaxDays('')
    setNewPayRate('')
    toast.success('Payment CD tier added')
  }

  const handleAddInvoiceCloseRule = () => {
    const min = parseInt(newCloseMinDays)
    const max = parseInt(newCloseMaxDays)
    const rate = parseFloat(newCloseRate)

    if (isNaN(min) || isNaN(max) || isNaN(rate)) {
      toast.error('Please enter valid numbers for Invoice Closed CD rule')
      return
    }

    if (min < 0 || max < min) {
      toast.error('Invalid day range (Min Days must be <= Max Days)')
      return
    }

    setInvoiceCloseCDRules((prev) => [...prev, { minDays: min, maxDays: max, ratePerMT: rate, unit: newCloseUnit }])
    setNewCloseMinDays('')
    setNewCloseMaxDays('')
    setNewCloseRate('')
    toast.success('Invoice Closed CD rule added')
  }

  const handleSaveCDRules = () => {
    if (!selectedSupplier) {
      toast.error('Please select a supplier first')
      return
    }

    const advNum = parseFloat(advanceCDPercentage) || 0
    const targetMTNum = parseFloat(targetMT) || 0
    const targetRateNum = parseFloat(targetRatePerMT) || 0

    const currentVersions = selectedSupplier.cdRuleVersions || []
    const newVersionNumber = currentVersions.length + 1
    const versionId = `${selectedSupplier.id}-v${newVersionNumber}`

    const newVersion = {
      id: versionId,
      version: newVersionNumber,
      ruleName: `CD Rules v${newVersionNumber}`,
      effectiveFrom: effectiveFromDate || new Date().toISOString().split('T')[0],
      paymentCDRules,
      invoiceCloseCDRules,
      advanceCDPercentage: advNum > 0 ? advNum : undefined,
      annualTarget: (targetMTNum > 0 || targetRateNum > 0) ? { targetMT: targetMTNum, ratePerMT: targetRateNum } : undefined,
      approvalStatus: 'Approved' as const,
      changedBy: 'Master Admin',
      changedAt: new Date().toISOString(),
      reason: changeReason || `Updated CD rules v${newVersionNumber}`
    }

    const updatedVersions = [newVersion, ...currentVersions]

    const newLogEntry = {
      id: `log-${Date.now()}`,
      versionId,
      version: newVersionNumber,
      ruleName: `CD Rules v${newVersionNumber}`,
      effectiveFrom: effectiveFromDate || new Date().toISOString().split('T')[0],
      changedBy: 'Master Admin',
      changedAt: new Date().toISOString(),
      reason: changeReason || `Updated CD rules v${newVersionNumber}`,
      fieldChanges: [
        { fieldName: 'Advance CD', oldValue: `${selectedSupplier.advanceCDPercentage || 0}%`, newValue: `${advNum}%` },
        { fieldName: 'Payment CD Rules', oldValue: `${selectedSupplier.paymentCDRules?.length || 0} rules`, newValue: `${paymentCDRules.length} rules` },
        { fieldName: 'Invoice Close CD Rules', oldValue: `${selectedSupplier.invoiceCloseCDRules?.length || 0} rules`, newValue: `${invoiceCloseCDRules.length} rules` },
      ]
    }

    const updatedChangeLogs = [newLogEntry, ...(selectedSupplier.cdRuleChangeLog || [])]

    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === selectedSupplier.id
          ? {
              ...s,
              advanceCDPercentage: advNum > 0 ? advNum : undefined,
              paymentCDRules,
              invoiceCloseCDRules,
              annualTarget: (targetMTNum > 0 || targetRateNum > 0) ? { targetMT: targetMTNum, ratePerMT: targetRateNum } : undefined,
              cdRuleVersions: updatedVersions,
              cdRuleChangeLog: updatedChangeLogs
            }
          : s
      )
    )

    toast.success(`Discount & CD rules updated for ${selectedSupplier.name}!`)
  }

  const totalConfiguredRulesCount = paymentCDRules.length + invoiceCloseCDRules.length + (parseFloat(advanceCDPercentage) > 0 ? 1 : 0) + (parseFloat(targetMT) > 0 || parseFloat(targetRatePerMT) > 0 ? 1 : 0)

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Percent className="h-6 w-6 text-[#0256e8]" weight="duotone" />
            Supplier Discount & CD Rules Configuration
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Select a supplier to manage their Payment CD Rules, Invoice Closed CD Rules, and Annual Target
          </p>
        </div>

        {selectedSupplier && (
          <Button
            onClick={handleSaveCDRules}
            disabled={isLocked}
            className="bg-[#0256e8] hover:bg-[#0046cd] text-white font-bold rounded-xl px-5 h-9 text-xs shadow-2xs gap-1.5"
          >
            <CheckCircle className="h-4 w-4" weight="bold" />
            Save CD Rules Configuration
          </Button>
        )}
      </div>

      {/* Supplier Selector Bar */}
      <Card className="border border-slate-200/80 shadow-2xs">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 w-full sm:w-80">
            <Label className="text-xs font-bold text-slate-700">Select Supplier *</Label>
            <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
              <SelectTrigger className="h-10 text-xs bg-white font-semibold text-slate-900 border-slate-300">
                <SelectValue placeholder="Choose a supplier..." />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs font-medium">
                    {s.name} {s.city ? `(${s.city})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSupplier && (
            <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-400 font-medium">GSTIN:</span>{' '}
                <span className="font-mono font-bold text-slate-800">{selectedSupplier.gstin || 'N/A'}</span>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-400 font-medium">Mobile:</span>{' '}
                <span className="font-bold text-slate-800">{selectedSupplier.phone || 'N/A'}</span>
              </div>
              <div className="text-slate-300">|</div>
              <div>
                <span className="text-slate-400 font-medium">Rules Version:</span>{' '}
                <Badge variant="outline" className="bg-blue-50 text-[#0256e8] border-blue-200 font-extrabold text-[10px]">
                  v{selectedSupplier.cdRuleVersions?.length || 1}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedSupplier ? (
        <Card className="p-12 text-center border-dashed border-slate-300 bg-slate-50/50">
          <Info className="h-10 w-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No Supplier Selected</h3>
          <p className="text-xs text-slate-500 mt-1">Please select a supplier from the dropdown above to edit CD rules.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form Column (8/12) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
              
              {/* Header & Effective Date Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-[#0256e8]" weight="duotone" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Discount & CD Rules Configuration</h3>
                    <p className="text-xs text-slate-500">Configure Payment CD Rules, Invoice Closed CD Rules, and Annual Target</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-blue-50/80 p-2 rounded-xl border border-blue-100/90 shrink-0">
                  <CalendarBlank className="h-4 w-4 text-[#0256e8]" weight="bold" />
                  <Label className="text-xs font-bold text-slate-700 whitespace-nowrap">Effective From *</Label>
                  <Input
                    type="date"
                    value={effectiveFromDate}
                    onChange={(e) => setEffectiveFromDate(e.target.value)}
                    className="h-8 text-xs bg-white font-mono font-bold text-slate-900 w-36 shadow-2xs"
                    required
                  />
                </div>
              </div>

              {/* 3 Sub-Cards Container */}
              <div className="space-y-6">
                
                {/* SUB-CARD 1: Payment CD Rules */}
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0256e8] flex items-center gap-2">
                      <span>1. Payment CD Rules</span>
                    </h4>
                    <Badge variant="outline" className="bg-blue-50 text-[#0256e8] border-blue-200 text-[10px] font-bold">
                      Tier Discount
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Advance CD Percentage (%)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="2.5"
                        value={advanceCDPercentage}
                        onChange={(e) => setAdvanceCDPercentage(e.target.value)}
                        className="h-8 text-xs font-bold bg-white"
                      />
                    </div>
                  </div>

                  {/* Tiers Table */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Prompt CD Days Tiers</Label>
                    {paymentCDRules.length === 0 ? (
                      <p className="text-xs text-slate-400 py-1 font-medium">No payment CD tiers configured. Add one below.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {paymentCDRules.map((rule, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              {rule.minDays} to {rule.maxDays} Days ➔ <span className="font-bold text-[#0256e8]">{rule.percentageRate}% CD</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPaymentCDRules((prev) => prev.filter((_, i) => i !== idx))}
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Tier Inline Form */}
                    <div className="flex items-center gap-2 pt-2">
                      <Input
                        type="number"
                        placeholder="Min Days"
                        value={newPayMinDays}
                        onChange={(e) => setNewPayMinDays(e.target.value)}
                        className="h-8 text-xs w-24 bg-white"
                      />
                      <span className="text-slate-400 text-xs">to</span>
                      <Input
                        type="number"
                        placeholder="Max Days"
                        value={newPayMaxDays}
                        onChange={(e) => setNewPayMaxDays(e.target.value)}
                        className="h-8 text-xs w-24 bg-white"
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder="CD %"
                        value={newPayRate}
                        onChange={(e) => setNewPayRate(e.target.value)}
                        className="h-8 text-xs w-24 bg-white font-bold text-[#0256e8]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddPaymentCDTier}
                        className="h-8 bg-[#0256e8] text-white text-xs font-bold rounded-lg px-3"
                      >
                        + Add Tier
                      </Button>
                    </div>
                  </div>
                </div>

                {/* SUB-CARD 2: Invoice Closed CD Rules */}
                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                      <span>2. Invoice Closed CD Rules</span>
                    </h4>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold">
                      Closing Rate / Unit
                    </Badge>
                  </div>

                  {/* Tiers Table */}
                  <div className="space-y-2">
                    {invoiceCloseCDRules.length === 0 ? (
                      <p className="text-xs text-slate-400 py-1 font-medium">No invoice closing CD rules configured. Add one below.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {invoiceCloseCDRules.map((rule, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              {rule.minDays} to {rule.maxDays} Days ➔ <span className="font-bold text-indigo-700">{formatCurrency(rule.ratePerMT)} / {rule.unit || 'MT'}</span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setInvoiceCloseCDRules((prev) => prev.filter((_, i) => i !== idx))}
                              className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Closing Rule Form */}
                    <div className="flex items-center gap-2 pt-2">
                      <Input
                        type="number"
                        placeholder="Min Days"
                        value={newCloseMinDays}
                        onChange={(e) => setNewCloseMinDays(e.target.value)}
                        className="h-8 text-xs w-24 bg-white"
                      />
                      <span className="text-slate-400 text-xs">to</span>
                      <Input
                        type="number"
                        placeholder="Max Days"
                        value={newCloseMaxDays}
                        onChange={(e) => setNewCloseMaxDays(e.target.value)}
                        className="h-8 text-xs w-24 bg-white"
                      />
                      <Input
                        type="number"
                        step="any"
                        placeholder="Rate"
                        value={newCloseRate}
                        onChange={(e) => setNewCloseRate(e.target.value)}
                        className="h-8 text-xs w-20 bg-white font-bold text-indigo-700"
                      />
                      <select
                        value={newCloseUnit}
                        onChange={(e) => setNewCloseUnit(e.target.value)}
                        className="h-8 text-xs min-w-[80px] rounded-md border border-input bg-white px-2 font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {availableUnits.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddInvoiceCloseRule}
                        className="h-8 bg-indigo-600 text-white text-xs font-bold rounded-lg px-3"
                      >
                        + Add Rule
                      </Button>
                    </div>
                  </div>
                </div>

                {/* SUB-CARD 3: Annual Target */}
                <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-2">
                      <span>3. Annual Target</span>
                    </h4>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      Target Scheme
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Target Volume (MT)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="1000"
                        value={targetMT}
                        onChange={(e) => setTargetMT(e.target.value)}
                        className="h-8 text-xs font-bold bg-white text-slate-900"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-slate-700">Target Rate per MT (₹)</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="50"
                        value={targetRatePerMT}
                        onChange={(e) => setTargetRatePerMT(e.target.value)}
                        className="h-8 text-xs font-bold bg-white text-emerald-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Optional Change Reason */}
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs font-bold text-slate-700">Reason for Change / Note</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Revised CD terms per annual supplier agreement"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="h-9 text-xs bg-white"
                  />
                </div>

              </div>
            </div>
          </div>

          {/* Right Summary Column (4/12) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-[#0256e8]" weight="bold" />
                  <span>Configured Summary</span>
                </h3>
                
                <Badge variant="outline" className="bg-blue-50 text-[#0256e8] border-blue-200 text-[10px] font-extrabold">
                  {totalConfiguredRulesCount} TOTAL RULES
                </Badge>
              </div>

              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-blue-100/80 pb-2">
                  <span>Effective: {effectiveFromDate}</span>
                  <span className="text-[10px] font-extrabold text-[#0256e8] uppercase">CURRENT ACTIVE</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold">ADVANCE CD</span>
                    <span className="font-extrabold text-slate-900">{advanceCDPercentage ? `${advanceCDPercentage}%` : 'Not set'}</span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-200/60 pb-1.5 gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold shrink-0">PROMPT CD</span>
                    <span className="font-extrabold text-slate-900 text-right">
                      {paymentCDRules.length > 0
                        ? paymentCDRules.map((r) => `${r.minDays}-${r.maxDays}d: ${r.percentageRate}%`).join(', ')
                        : 'Not configured'}
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-b border-slate-200/60 pb-1.5 gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold shrink-0">INVOICE CLOSED CD</span>
                    <span className="font-bold text-slate-800 text-right">
                      {invoiceCloseCDRules.length > 0
                        ? invoiceCloseCDRules.map((r) => `${r.minDays}-${r.maxDays}d: ₹${r.ratePerMT}/${r.unit || 'MT'}`).join(', ')
                        : 'Not configured'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 uppercase font-extrabold">ANNUAL TARGET</span>
                    <span className="font-bold text-emerald-700 text-right">
                      {parseFloat(targetMT) > 0 || parseFloat(targetRatePerMT) > 0
                        ? `${targetMT} MT @ ₹${targetRatePerMT}/MT`
                        : 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Version History Log */}
              {selectedSupplier.cdRuleVersions && selectedSupplier.cdRuleVersions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">VERSION HISTORY</p>
                  <div className="space-y-2">
                    {selectedSupplier.cdRuleVersions.map((ver) => (
                      <div key={ver.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>{ver.ruleName || `v${ver.version}`}</span>
                          <span className="text-[10px] font-mono text-slate-500">{ver.effectiveFrom}</span>
                        </div>
                        {ver.reason && <p className="text-[11px] text-slate-500 italic">{ver.reason}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
