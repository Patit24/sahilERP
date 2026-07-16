import { useState } from 'react'
import { Supplier, PaymentCDRule, InvoiceCloseCDRule, SupplierCDRuleVersion, CDRuleChangeLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash, Building, Warning, UserPlus } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/calculations'
import { toast } from 'sonner'

interface SuppliersPageProps {
  suppliers: Supplier[]
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void
  isLocked?: boolean
  changedBy?: string
}

function addDays(date: string, days: number): string {
  const value = new Date(date)
  value.setDate(value.getDate() + days)
  return value.toISOString().split('T')[0]
}

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function rulesChanged(
  supplier: Supplier,
  paymentCDRules: PaymentCDRule[],
  invoiceCloseCDRules: InvoiceCloseCDRule[],
  advanceCDPercentage?: number
): boolean {
  return JSON.stringify({
    paymentCDRules: supplier.paymentCDRules || [],
    invoiceCloseCDRules: supplier.invoiceCloseCDRules || [],
    advanceCDPercentage: supplier.advanceCDPercentage || 0
  }) !== JSON.stringify({
    paymentCDRules,
    invoiceCloseCDRules,
    advanceCDPercentage: advanceCDPercentage || 0
  })
}

function makeInitialVersion(supplier: Supplier, effectiveTo?: string): SupplierCDRuleVersion {
  return {
    id: `${supplier.id}-cd-version-1`,
    version: 1,
    ruleName: 'Supplier CD Rules',
    effectiveFrom: '1900-01-01',
    effectiveTo,
    paymentCDRules: supplier.paymentCDRules || [],
    invoiceCloseCDRules: supplier.invoiceCloseCDRules || [],
    advanceCDPercentage: supplier.advanceCDPercentage,
    changedBy: 'System migration',
    changedAt: new Date().toISOString(),
    reason: 'Historical rule baseline',
    approvalStatus: 'Approved'
  }
}

export default function SuppliersPage({ suppliers, setSuppliers, isLocked = false, changedBy = 'Master Admin' }: SuppliersPageProps) {
  const [open, setOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const paymentCDRules: PaymentCDRule[] = []
    const paymentCDCount = parseInt(formData.get('paymentCDCount') as string) || 0
    for (let i = 0; i < paymentCDCount; i++) {
      paymentCDRules.push({
        minDays: parseInt(formData.get(`paymentCD${i}MinDays`) as string) || 0,
        maxDays: parseInt(formData.get(`paymentCD${i}MaxDays`) as string) || 0,
        percentageRate: parseFloat(formData.get(`paymentCD${i}Rate`) as string) || 0
      })
    }

    const invoiceCloseCDRules: InvoiceCloseCDRule[] = []
    const invoiceCloseCDCount = parseInt(formData.get('invoiceCloseCDCount') as string) || 0
    for (let i = 0; i < invoiceCloseCDCount; i++) {
      invoiceCloseCDRules.push({
        minDays: parseInt(formData.get(`invoiceCloseCD${i}MinDays`) as string) || 0,
        maxDays: parseInt(formData.get(`invoiceCloseCD${i}MaxDays`) as string) || 0,
        ratePerMT: parseFloat(formData.get(`invoiceCloseCD${i}Rate`) as string) || 0
      })
    }

    const annualTargetMT = parseFloat(formData.get('annualTargetMT') as string) || 0
    const annualTargetRate = parseFloat(formData.get('annualTargetRate') as string) || 0
    const openingBalance = parseFloat(formData.get('openingBalance') as string) || 0
    const advanceCDPercentage = parseFloat(formData.get('advanceCDPercentage') as string) || 0
    const effectiveDate = (formData.get('effectiveDate') as string) || todayKey()
    const changeReason = ((formData.get('changeReason') as string) || '').trim() || (editingSupplier ? 'Supplier CD rule update' : 'Initial supplier CD rule setup')
    const normalizedAdvanceCD = advanceCDPercentage > 0 ? advanceCDPercentage : undefined
    const changedAt = new Date().toISOString()
    const supplierId = editingSupplier?.id || `supplier-${Date.now()}`

    const cdVersion: SupplierCDRuleVersion = {
      id: `${supplierId}-cd-version-${Date.now()}`,
      version: 1,
      ruleName: 'Supplier CD Rules',
      effectiveFrom: effectiveDate,
      paymentCDRules,
      invoiceCloseCDRules,
      advanceCDPercentage: normalizedAdvanceCD,
      changedBy,
      changedAt,
      reason: changeReason,
      approvalStatus: 'Approved'
    }

    const supplier: Supplier = {
      id: supplierId,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string || undefined,
      address: formData.get('address') as string || undefined,
      state: formData.get('state') as string || undefined,
      pincode: formData.get('pincode') as string || undefined,
      city: formData.get('city') as string || undefined,
      gstin: formData.get('gstin') as string || undefined,
      paymentCDRules,
      invoiceCloseCDRules,
      advanceCDPercentage: normalizedAdvanceCD,
      cdRuleVersions: editingSupplier?.cdRuleVersions,
      cdRuleChangeLog: editingSupplier?.cdRuleChangeLog,
      annualTarget: annualTargetMT > 0 ? {
        targetMT: annualTargetMT,
        ratePerMT: annualTargetRate
      } : undefined,
      openingBalance: openingBalance !== 0 ? openingBalance : undefined
    }

    if (editingSupplier) {
      const hasRuleChange = rulesChanged(editingSupplier, paymentCDRules, invoiceCloseCDRules, normalizedAdvanceCD)
      if (hasRuleChange) {
        const previousEffectiveTo = addDays(effectiveDate, -1)
        const existingVersions = editingSupplier.cdRuleVersions?.length
          ? editingSupplier.cdRuleVersions
          : [makeInitialVersion(editingSupplier, previousEffectiveTo)]
        const closedVersions = existingVersions.map((version, index) => {
          if (index !== existingVersions.length - 1 || version.effectiveTo) return version
          return { ...version, effectiveTo: previousEffectiveTo }
        })
        const nextVersionNumber = Math.max(...closedVersions.map((version) => version.version), 0) + 1
        const newVersion: SupplierCDRuleVersion = {
          ...cdVersion,
          id: `${supplierId}-cd-version-${nextVersionNumber}-${Date.now()}`,
          version: nextVersionNumber
        }
        const previousVersion = closedVersions[closedVersions.length - 1]
        const changeLog: CDRuleChangeLog = {
          id: `${supplierId}-cd-change-${Date.now()}`,
          supplierId,
          ruleName: 'Supplier CD Rules',
          ruleVersion: nextVersionNumber,
          previousValues: {
            paymentCDRules: previousVersion?.paymentCDRules || editingSupplier.paymentCDRules || [],
            invoiceCloseCDRules: previousVersion?.invoiceCloseCDRules || editingSupplier.invoiceCloseCDRules || [],
            advanceCDPercentage: previousVersion?.advanceCDPercentage ?? editingSupplier.advanceCDPercentage,
            effectiveFrom: previousVersion?.effectiveFrom,
            effectiveTo: previousEffectiveTo
          },
          newValues: {
            paymentCDRules,
            invoiceCloseCDRules,
            advanceCDPercentage: normalizedAdvanceCD,
            effectiveFrom: effectiveDate
          },
          effectiveDate,
          changedBy,
          changedAt,
          reason: changeReason,
          approvalStatus: 'Approved'
        }
        supplier.cdRuleVersions = [...closedVersions, newVersion]
        supplier.cdRuleChangeLog = [...(editingSupplier.cdRuleChangeLog || []), changeLog]
      }
      setSuppliers((prev) => prev.map(s => s.id === editingSupplier.id ? supplier : s))
      toast.success(hasRuleChange ? 'Supplier updated with new CD rule version' : 'Supplier updated')
    } else {
      supplier.cdRuleVersions = [cdVersion]
      supplier.cdRuleChangeLog = [{
        id: `${supplierId}-cd-change-${Date.now()}`,
        supplierId,
        ruleName: 'Supplier CD Rules',
        ruleVersion: 1,
        previousValues: {
          paymentCDRules: [],
          invoiceCloseCDRules: [],
          advanceCDPercentage: undefined
        },
        newValues: {
          paymentCDRules,
          invoiceCloseCDRules,
          advanceCDPercentage: normalizedAdvanceCD,
          effectiveFrom: effectiveDate
        },
        effectiveDate,
        changedBy,
        changedAt,
        reason: changeReason,
        approvalStatus: 'Approved'
      }]
      setSuppliers((prev) => [...prev, supplier])
      toast.success('Supplier added with CD rule version 1')
    }

    setOpen(false)
    setEditingSupplier(null)
  }

  const handleDeleteClick = (supplier: Supplier) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setSupplierToDelete(supplier)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (supplierToDelete) {
      setSuppliers((prev) => prev.filter(s => s.id !== supplierToDelete.id))
      toast.success('Supplier deleted successfully')
      setDeleteDialogOpen(false)
      setSupplierToDelete(null)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingSupplier(supplier)
    setOpen(true)
  }

  const handleAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingSupplier(null)
    setOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Suppliers</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage supplier master data and discount configurations
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} size="sm">
              <Plus className="mr-1.5" size={16} />
              Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(760px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <UserPlus size={22} className="text-primary" weight="duotone" />
                {editingSupplier ? 'Edit Supplier' : 'Create New Party'}
              </DialogTitle>
            </DialogHeader>
            <SupplierForm 
              onSubmit={handleSubmit} 
              supplier={editingSupplier}
              onCancel={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {suppliers.length === 0 ? (
          <Card className="border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building size={40} className="text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground text-center">
                No suppliers yet. Add your first supplier to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          suppliers.map(supplier => (
            <Card key={supplier.id} className="border-border">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold">{supplier.name}</CardTitle>
                  </div>
                  <div className="flex gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleEdit(supplier)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteClick(supplier)}
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 space-y-3">
                {supplier.openingBalance !== undefined && supplier.openingBalance !== 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Opening Balance</h4>
                    <div className="text-xs font-mono text-foreground/80">
                      {formatCurrency(supplier.openingBalance)} {supplier.openingBalance > 0 ? '(Payable)' : '(Advance)'}
                    </div>
                  </div>
                )}
                
                {supplier.advanceCDPercentage !== undefined && supplier.advanceCDPercentage > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Advance Payment CD</h4>
                    <div className="text-xs font-mono text-foreground/80">
                      {supplier.advanceCDPercentage}% on advance amounts
                    </div>
                  </div>
                )}

                {supplier.cdRuleVersions && supplier.cdRuleVersions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">CD Rule Versions</h4>
                    <div className="space-y-1 text-xs">
                      {[...supplier.cdRuleVersions].sort((a, b) => b.version - a.version).map((version) => (
                        <div key={version.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1">
                          <span className="font-semibold">v{version.version}</span>
                          <span>{version.effectiveFrom} - {version.effectiveTo || 'Current'}</span>
                          <span className="text-muted-foreground">{version.approvalStatus}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {supplier.paymentCDRules && supplier.paymentCDRules.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Payment CD Rules (% on Payment Amount)</h4>
                    <div className="space-y-0.5 text-xs">
                      {supplier.paymentCDRules.map((rule, idx) => (
                        <div key={idx} className="text-foreground/80">
                          {rule.minDays}-{rule.maxDays} days: {rule.percentageRate}%
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {supplier.invoiceCloseCDRules && supplier.invoiceCloseCDRules.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Invoice Close CD Rules</h4>
                    <div className="space-y-0.5 text-xs">
                      {supplier.invoiceCloseCDRules.map((rule, idx) => (
                        <div key={idx} className="text-foreground/80">
                          {rule.minDays}-{rule.maxDays} days: {formatCurrency(rule.ratePerMT)}/MT
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {supplier.annualTarget && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Annual Target</h4>
                    <div className="text-xs text-foreground/80">
                      {supplier.annualTarget.targetMT} MT @ {formatCurrency(supplier.annualTarget.ratePerMT)}/MT
                    </div>
                  </div>
                )}

                {supplier.cdRuleChangeLog && supplier.cdRuleChangeLog.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">CD Rule Change Log</h4>
                    <div className="space-y-2">
                      {[...supplier.cdRuleChangeLog].sort((a, b) => b.ruleVersion - a.ruleVersion).slice(0, 4).map((log) => (
                        <div key={log.id} className="rounded border border-border bg-background/60 p-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{log.ruleName} v{log.ruleVersion}</span>
                            <span className="text-muted-foreground">{new Date(log.changedAt).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="rounded bg-muted/30 p-2">
                              <div className="font-medium">Old values</div>
                              <div>Advance CD: {log.previousValues.advanceCDPercentage || 0}%</div>
                              <div>Effective up to: {log.previousValues.effectiveTo || '-'}</div>
                            </div>
                            <div className="rounded bg-primary/5 p-2">
                              <div className="font-medium">New values</div>
                              <div>Advance CD: {log.newValues.advanceCDPercentage || 0}%</div>
                              <div>Effective from: {log.effectiveDate}</div>
                            </div>
                          </div>
                          <div className="mt-1 text-muted-foreground">Changed by {log.changedBy} · {log.reason} · {log.approvalStatus}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Supplier
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{supplierToDelete?.name}</strong>? This action cannot be undone and will affect all related invoices, payments, and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SupplierForm({ onSubmit, supplier, onCancel }: { onSubmit: (e: React.FormEvent<HTMLFormElement>) => void, supplier: Supplier | null, onCancel: () => void }) {
  const [paymentCDCount, setPaymentCDCount] = useState(supplier?.paymentCDRules?.length || 0)
  const [invoiceCloseCDCount, setInvoiceCloseCDCount] = useState(supplier?.invoiceCloseCDRules?.length || 0)

  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="paymentCDCount" value={paymentCDCount} />
      <input type="hidden" name="invoiceCloseCDCount" value={invoiceCloseCDCount} />

      <div className="space-y-5 px-6 py-5">
        <div className="space-y-2">
          <Label htmlFor="name">Party Name <span className="text-destructive">*</span></Label>
          <Input 
            id="name" 
            name="name" 
            placeholder="Enter name"
            defaultValue={supplier?.name}
            className="h-11"
            required 
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Mobile Number</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={supplier?.phone}
            placeholder="Enter Mobile Number"
            className="h-11"
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/20">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="font-semibold">Address (Optional)</div>
          </div>
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="address" className="text-xs uppercase text-muted-foreground">Billing Address</Label>
              <Textarea
                id="address"
                name="address"
                defaultValue={supplier?.address}
                placeholder="Enter billing address"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="state" className="text-xs uppercase text-muted-foreground">State</Label>
                <Input id="state" name="state" defaultValue={supplier?.state} placeholder="Enter State" className="h-10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pincode" className="text-xs uppercase text-muted-foreground">Pincode</Label>
                <Input id="pincode" name="pincode" defaultValue={supplier?.pincode} placeholder="Enter Pincode" className="h-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="text-xs uppercase text-muted-foreground">City</Label>
              <Input id="city" name="city" defaultValue={supplier?.city} placeholder="Enter City" className="h-10" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked readOnly className="h-4 w-4 accent-primary" />
              Shipping address same as billing address
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="font-semibold">GSTIN (Optional)</div>
          </div>
          <div className="space-y-2 p-4">
            <Label htmlFor="gstin" className="text-xs uppercase text-muted-foreground">GSTIN</Label>
            <Input
              id="gstin"
              name="gstin"
              defaultValue={supplier?.gstin}
              placeholder="ex: 29XXXXX9438X1XX"
              className="h-10 uppercase"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-3 font-semibold">Accounting Details</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="openingBalance">Opening Balance (₹)</Label>
              <Input 
                id="openingBalance" 
                name="openingBalance" 
                type="number"
                step="0.01"
                defaultValue={supplier?.openingBalance || 0}
                className="h-10 font-mono"
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                Positive = Amount payable to supplier | Negative = Advance paid
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="advanceCDPercentage">Advance CD (%)</Label>
              <Input 
                id="advanceCDPercentage" 
                name="advanceCDPercentage" 
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={supplier?.advanceCDPercentage || 0}
                className="h-10 font-mono"
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                CD% applied to advance payment amounts.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="mb-3 font-semibold">Rule Version Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">CD Rule Effective Date</Label>
              <Input
                id="effectiveDate"
                name="effectiveDate"
                type="date"
                defaultValue={todayKey()}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="changeReason">Reason for Change</Label>
              <Input
                id="changeReason"
                name="changeReason"
                defaultValue={supplier ? 'Supplier rule revision' : 'Initial rule setup'}
                className="h-10"
                placeholder="e.g. New supplier circular"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="font-semibold">Payment CD Rules (% on Payment Amount)</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">Payment CD is calculated as a percentage of the payment amount</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="h-9 px-3"
                onClick={() => setPaymentCDCount(paymentCDCount + 1)}
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>
            {Array.from({ length: paymentCDCount }).map((_, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-border bg-background/70 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Min Days</Label>
                  <Input 
                    name={`paymentCD${idx}MinDays`}
                    type="number"
                    className="h-9"
                    defaultValue={supplier?.paymentCDRules[idx]?.minDays}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Max Days</Label>
                  <Input 
                    name={`paymentCD${idx}MaxDays`}
                    type="number"
                    className="h-9"
                    defaultValue={supplier?.paymentCDRules[idx]?.maxDays}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Percentage (%)</Label>
                  <Input 
                    name={`paymentCD${idx}Rate`}
                    type="number"
                    step="0.01"
                    className="h-9"
                    defaultValue={supplier?.paymentCDRules[idx]?.percentageRate}
                  />
                </div>
                {paymentCDCount > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="mt-5 h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setPaymentCDCount(paymentCDCount - 1)}
                  >
                    <Trash size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="font-semibold">Invoice Close CD Rules (Optional)</Label>
                <p className="mt-1 text-[11px] text-muted-foreground">Invoice Close CD is calculated per MT based on days to close the invoice</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                className="h-9 px-3"
                onClick={() => setInvoiceCloseCDCount(invoiceCloseCDCount + 1)}
              >
                <Plus size={14} className="mr-1" />
                Add
              </Button>
            </div>
            {Array.from({ length: invoiceCloseCDCount }).map((_, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-border bg-background/70 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Min Days</Label>
                  <Input 
                    name={`invoiceCloseCD${idx}MinDays`}
                    type="number"
                    className="h-9"
                    defaultValue={supplier?.invoiceCloseCDRules[idx]?.minDays}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Max Days</Label>
                  <Input 
                    name={`invoiceCloseCD${idx}MaxDays`}
                    type="number"
                    className="h-9"
                    defaultValue={supplier?.invoiceCloseCDRules[idx]?.maxDays}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-medium">Rate/MT (₹)</Label>
                  <Input 
                    name={`invoiceCloseCD${idx}Rate`}
                    type="number"
                    step="0.01"
                    className="h-9"
                    defaultValue={supplier?.invoiceCloseCDRules[idx]?.ratePerMT}
                  />
                </div>
                {invoiceCloseCDCount > 1 && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    className="mt-5 h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setInvoiceCloseCDCount(invoiceCloseCDCount - 1)}
                  >
                    <Trash size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <Label className="font-semibold">Annual Target (Optional)</Label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-medium">Target MT</Label>
              <Input 
                name="annualTargetMT"
                type="number"
                step="0.01"
                className="h-10"
                defaultValue={supplier?.annualTarget?.targetMT}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-medium">Rate/MT (₹)</Label>
              <Input 
                name="annualTargetRate"
                type="number"
                step="0.01"
                className="h-10"
                defaultValue={supplier?.annualTarget?.ratePerMT}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {supplier ? 'Update Supplier' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
