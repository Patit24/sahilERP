import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpenseType, ExpenseEntry } from '@/lib/types'
import { Plus, Trash, Receipt, LinkSimple, TrendDown, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ExpenseTypesPageProps {
  expenseTypes: ExpenseType[]
  setExpenseTypes: (updater: (prev: ExpenseType[]) => ExpenseType[]) => void
  expenseEntries: ExpenseEntry[]
  isLocked?: boolean
}

export default function ExpenseTypesPage({ expenseTypes, setExpenseTypes, expenseEntries, isLocked = false }: ExpenseTypesPageProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [expenseTypeToDelete, setExpenseTypeToDelete] = useState<ExpenseType | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [linkType, setLinkType] = useState<'invoice' | 'netprofit'>('netprofit')

  const handleAddExpenseType = () => {
    if (isLocked) {
      toast.error('Cannot save in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    
    if (!name.trim()) {
      toast.error('Please enter expense type name')
      return
    }

    const newExpenseType: ExpenseType = {
      id: `exp-type-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      linkType
    }

    setExpenseTypes((prev) => [...prev, newExpenseType])
    
    setName('')
    setDescription('')
    setLinkType('netprofit')
    setIsAddDialogOpen(false)
    toast.success('Expense type added successfully')
  }

  const getExpenseEntriesCount = (expenseTypeId: string) => {
    return expenseEntries.filter(entry => entry.expenseTypeId === expenseTypeId).length
  }

  const handleDeleteClick = (expenseType: ExpenseType) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    
    const entriesCount = getExpenseEntriesCount(expenseType.id)
    
    if (entriesCount > 0) {
      setExpenseTypeToDelete(expenseType)
      setDeleteAlertOpen(true)
    } else {
      handleDeleteExpenseType(expenseType.id)
    }
  }

  const handleDeleteExpenseType = (id: string) => {
    setExpenseTypes((prev) => prev.filter(et => et.id !== id))
    toast.success('Expense type deleted')
    setDeleteAlertOpen(false)
    setExpenseTypeToDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/20">
            <Receipt className="text-accent" weight="duotone" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Expense Types</h2>
            <p className="text-sm text-muted-foreground">Manage expense categories for cost tracking</p>
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              if (isLocked) {
                toast.error('Cannot add in locked mode', {
                  description: 'Unlock the data in Settings to make changes'
                })
                return
              }
              setIsAddDialogOpen(true)
            }}>
              <Plus className="mr-2" size={18} weight="bold" />
              Add Expense Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense Type</DialogTitle>
              <DialogDescription>Create a new expense category</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Expense Type Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Transportation, Labour, Commission"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-3">
                <Label>Link Type *</Label>
                <Tabs value={linkType} onValueChange={(v) => setLinkType(v as 'invoice' | 'netprofit')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="netprofit">
                      <TrendDown className="mr-2" size={16} />
                      Reduce from Net Profit
                    </TabsTrigger>
                    <TabsTrigger value="invoice">
                      <LinkSimple className="mr-2" size={16} />
                      Link to Invoice
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="netprofit" className="mt-3">
                    <p className="text-sm text-muted-foreground">
                      Expenses will be deducted from net profit calculations
                    </p>
                  </TabsContent>
                  <TabsContent value="invoice" className="mt-3">
                    <p className="text-sm text-muted-foreground">
                      Expenses will be linked to specific purchase invoices for item costing
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddExpenseType}>
                Add Expense Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Types List</CardTitle>
          <CardDescription>All configured expense categories</CardDescription>
        </CardHeader>
        <CardContent>
          {expenseTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt size={48} className="mx-auto mb-4 opacity-50" />
              <p>No expense types created yet</p>
              <p className="text-sm mt-1">Add expense types to track costs</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense Type</TableHead>
                    <TableHead>Link Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseTypes.map((expenseType) => {
                    const entriesCount = getExpenseEntriesCount(expenseType.id)
                    return (
                      <TableRow key={expenseType.id}>
                        <TableCell className="font-medium">{expenseType.name}</TableCell>
                        <TableCell>
                          {expenseType.linkType === 'invoice' ? (
                            <Badge variant="outline" className="gap-1">
                              <LinkSimple size={14} />
                              Linked to Invoice
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <TrendDown size={14} />
                              Reduce from Net Profit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {expenseType.description || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entriesCount > 0 ? "default" : "outline"}>
                            {entriesCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(expenseType)}
                          >
                            <Trash size={16} className="text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <Warning className="text-destructive" weight="duotone" size={24} />
              </div>
              <AlertDialogTitle>Cannot Delete Expense Type</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3">
              <p>
                The expense type <strong>"{expenseTypeToDelete?.name}"</strong> cannot be deleted because it has{' '}
                <strong>{expenseTypeToDelete ? getExpenseEntriesCount(expenseTypeToDelete.id) : 0} expense entries</strong>{' '}
                associated with it.
              </p>
              <p className="text-foreground font-medium">
                To delete this expense type:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to the Expense Entries tab</li>
                <li>Delete all entries using this expense type</li>
                <li>Return here to delete the expense type</li>
              </ol>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteAlertOpen(false)
              setExpenseTypeToDelete(null)
            }}>
              Close
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
