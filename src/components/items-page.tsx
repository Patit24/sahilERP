import { useState } from 'react'
import { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Package, Trash, Pencil, Warning } from '@phosphor-icons/react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface ItemsPageProps {
  items: Item[]
  setItems: (updater: (prev: Item[]) => Item[]) => void
  isLocked?: boolean
}

export default function ItemsPage({ items, setItems, isLocked = false }: ItemsPageProps) {
  const [open, setOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const openingStock = parseFloat(formData.get('openingStock') as string) || 0
    const openingValue = parseFloat(formData.get('openingValue') as string) || 0

    if (editingItem) {
      const updatedItem: Item = {
        ...editingItem,
        name: formData.get('name') as string,
        unit: formData.get('unit') as 'MT' | 'KG' | 'PCS' | 'TON',
        description: formData.get('description') as string || undefined,
        openingStock: openingStock > 0 ? openingStock : undefined,
        openingValue: openingValue > 0 ? openingValue : undefined
      }

      setItems((prev) => prev.map(item => item.id === editingItem.id ? updatedItem : item))
      toast.success('Item updated successfully')
    } else {
      const item: Item = {
        id: `item-${Date.now()}`,
        name: formData.get('name') as string,
        unit: formData.get('unit') as 'MT' | 'KG' | 'PCS' | 'TON',
        description: formData.get('description') as string || undefined,
        openingStock: openingStock > 0 ? openingStock : undefined,
        openingValue: openingValue > 0 ? openingValue : undefined
      }

      setItems((prev) => [...prev, item])
      toast.success('Item added successfully')
    }

    setOpen(false)
    setEditingItem(null)
  }

  const handleDeleteClick = (item: Item) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setItemToDelete(item)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (itemToDelete) {
      setItems((prev) => prev.filter(item => item.id !== itemToDelete.id))
      toast.success('Item deleted successfully')
      setDeleteDialogOpen(false)
      setItemToDelete(null)
    }
  }

  const handleAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingItem(null)
    setOpen(true)
  }

  const handleEdit = (item: Item) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingItem(item)
    setOpen(true)
  }

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setEditingItem(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Item Master</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all steel products and items
          </p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="mr-2" size={18} />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input 
                  id="name" 
                  name="name" 
                  placeholder="e.g., HR Coil 2.5mm"
                  defaultValue={editingItem?.name}
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select name="unit" required defaultValue={editingItem?.unit || "MT"}>
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MT">MT (Metric Ton)</SelectItem>
                    <SelectItem value="KG">KG (Kilogram)</SelectItem>
                    <SelectItem value="TON">TON (Ton)</SelectItem>
                    <SelectItem value="PCS">PCS (Pieces)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea 
                  id="description" 
                  name="description" 
                  placeholder="Additional details about this item"
                  rows={3}
                  defaultValue={editingItem?.description}
                />
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="text-sm font-semibold text-foreground">Opening Stock (Optional)</div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="openingStock">Opening Quantity</Label>
                    <Input 
                      id="openingStock" 
                      name="openingStock" 
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      className="font-mono"
                      defaultValue={editingItem?.openingStock}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openingValue">Opening Value (₹)</Label>
                    <Input 
                      id="openingValue" 
                      name="openingValue" 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="font-mono"
                      defaultValue={editingItem?.openingValue}
                    />
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Set opening stock balance at the start of the financial year
                </p>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingItem ? 'Update Item' : 'Add Item'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground mb-1">Total Items</div>
          <div className="text-2xl font-mono font-semibold">{items.length}</div>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package size={48} className="text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              No items yet. Add your first steel product or item.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Opening Stock</TableHead>
                  <TableHead className="text-right">Opening Value</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.openingStock ? item.openingStock.toFixed(3) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.openingValue ? `₹${item.openingValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(item)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Pencil size={16} weight="bold" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClick(item)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash size={16} weight="bold" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Item
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone and will affect all related invoices and reports.
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
