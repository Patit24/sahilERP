import { useState, useMemo } from 'react'
import { SupplierDebitNote, Supplier } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Plus, Trash, PencilSimple, CaretUpDown, Check } from '@phosphor-icons/react'
import { formatCurrency, getFYMonths, isDateInFY } from '@/lib/calculations'
import { startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SupplierDebitNotePageProps {
  debitNotes: SupplierDebitNote[]
  setDebitNotes: (updater: (prev: SupplierDebitNote[]) => SupplierDebitNote[]) => void
  suppliers: Supplier[]
  currentFY: string
  isLocked?: boolean
}

export default function SupplierDebitNotePage({ debitNotes, setDebitNotes, suppliers, currentFY, isLocked = false }: SupplierDebitNotePageProps) {
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SupplierDebitNote | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<SupplierDebitNote | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [selectedEntity, setSelectedEntity] = useState<string>('all')
  const [selectedEntityInForm, setSelectedEntityInForm] = useState<string>('')
  const [entityComboboxOpen, setEntityComboboxOpen] = useState(false)

  const fyItems = debitNotes.filter(p => p.fy === currentFY)
  const fyMonths = getFYMonths(currentFY)
  
  const filteredItems = useMemo(() => {
    let result = fyItems
    
    if (selectedMonth !== 'all') {
      const monthStart = startOfMonth(parseISO(selectedMonth + '-01'))
      const monthEnd = endOfMonth(parseISO(selectedMonth + '-01'))
      
      result = result.filter(p => {
        const pDate = parseISO(p.date)
        return isWithinInterval(pDate, { start: monthStart, end: monthEnd })
      })
    }
    
    if (selectedEntity !== 'all') {
      result = result.filter(p => p.supplierId === selectedEntity)
    }
    
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [fyItems, selectedMonth, selectedEntity])
  
  const totalAmount = filteredItems.reduce((sum, p) => sum + p.amount, 0)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (isLocked) {
      toast.error('Cannot save in locked mode', { description: 'Unlock the data in Settings to make changes' })
      return
    }
    
    const formData = new FormData(e.currentTarget)
    const date = formData.get('date') as string
    const amount = parseFloat(formData.get('amount') as string)
    const remarks = formData.get('remarks') as string

    if (!selectedEntityInForm) {
      toast.error('Select a supplier')
      return
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    if (!isDateInFY(date, currentFY)) {
      toast.error('Invalid date', { description: `Date must be within ${currentFY}` })
      return
    }

    if (editingItem) {
      const updated: SupplierDebitNote = {
        ...editingItem,
        supplierId: selectedEntityInForm,
        date,
        amount,
        remarks,
      }
      setDebitNotes((prev) => prev.map(p => p.id === editingItem.id ? updated : p))
      toast.success('Debit Note updated')
    } else {
      const newItem: SupplierDebitNote = {
        id: crypto.randomUUID(),
        supplierId: selectedEntityInForm,
        date,
        amount,
        remarks,
        fy: currentFY,
        createdAt: Date.now()
      }
      setDebitNotes((prev) => [...prev, newItem])
      toast.success('Debit Note added')
    }

    setOpen(false)
    setEditingItem(null)
    setSelectedEntityInForm('')
  }

  const handleDelete = () => {
    if (isLocked || !itemToDelete) return
    setDebitNotes((prev) => prev.filter(p => p.id !== itemToDelete.id))
    setDeleteDialogOpen(false)
    setItemToDelete(null)
    toast.success('Debit Note deleted')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Debit Notes</h1>
          <p className="text-muted-foreground">Manage debit notes for {currentFY}</p>
        </div>
        
        <Dialog open={open} onOpenChange={(v) => {
          setOpen(v)
          if (!v) { setEditingItem(null); setSelectedEntityInForm('') }
        }}>
          <DialogTrigger asChild>
            <Button disabled={isLocked}>
              <Plus className="mr-2 h-4 w-4" /> Add Debit Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Debit Note</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 flex flex-col">
                <Label>Supplier</Label>
                <Popover open={entityComboboxOpen} onOpenChange={setEntityComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={entityComboboxOpen}
                      className="justify-between"
                    >
                      {selectedEntityInForm
                        ? suppliers.find((c) => c.id === selectedEntityInForm)?.name
                        : "Select supplier..."}
                      <CaretUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search supplier..." />
                      <CommandList>
                        <CommandEmpty>No supplier found.</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setSelectedEntityInForm(c.id)
                                setEntityComboboxOpen(false)
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selectedEntityInForm === c.id ? "opacity-100" : "opacity-0")} />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={editingItem?.date || format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editingItem?.amount}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  name="remarks"
                  defaultValue={editingItem?.remarks}
                  placeholder="Optional notes"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-[200px]">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {fyMonths.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[250px]">
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger>
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No debit notes found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const entity = suppliers.find(c => c.id === item.supplierId)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{format(parseISO(item.date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="font-medium">{entity?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{item.remarks || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingItem(item)
                            setSelectedEntityInForm(item.supplierId)
                            setOpen(true)
                          }}
                          disabled={isLocked}
                        >
                          <PencilSimple className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setItemToDelete(item)
                            setDeleteDialogOpen(true)
                          }}
                          disabled={isLocked}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Debit Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this debit note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
