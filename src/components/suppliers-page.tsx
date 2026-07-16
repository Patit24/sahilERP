import { useState } from 'react'
import { Supplier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Plus, Trash, Building, Warning } from '@phosphor-icons/react'
import { formatCurrency } from '@/lib/calculations'
import { toast } from 'sonner'
import { PartyEditorDialog } from '@/components/party-editor-dialog'

interface SuppliersPageProps {
  suppliers: Supplier[]
  setSuppliers: (updater: (prev: Supplier[]) => Supplier[]) => void
  isLocked?: boolean
  changedBy?: string
}

export default function SuppliersPage({ suppliers, setSuppliers, isLocked = false, changedBy = 'Master Admin' }: SuppliersPageProps) {
  const [open, setOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

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

  const handleSaveSupplier = (supplier: Supplier) => {
    if (editingSupplier) {
      setSuppliers(prev => prev.map(s => s.id === supplier.id ? supplier : s))
      toast.success('Supplier updated successfully')
    } else {
      setSuppliers(prev => [...prev, supplier])
      toast.success('Supplier added successfully')
    }
    setEditingSupplier(null)
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
        <Button onClick={handleAdd} size="sm">
          <Plus className="mr-1.5" size={16} />
          Add Supplier
        </Button>
        <PartyEditorDialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) setEditingSupplier(null)
          }}
          type="supplier"
          party={editingSupplier}
          existingParties={suppliers}
          changedBy={changedBy}
          onSave={(party) => handleSaveSupplier(party as Supplier)}
        />
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

