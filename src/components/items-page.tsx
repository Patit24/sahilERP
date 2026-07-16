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
    const purchasePrice = parseFloat(formData.get('purchasePrice') as string) || 0
    const salesPrice = parseFloat(formData.get('salesPrice') as string) || 0
    const gstRate = parseFloat(formData.get('gstRate') as string) || 0

    if (editingItem) {
      const updatedItem: Item = {
        ...editingItem,
        name: formData.get('name') as string,
        unit: formData.get('unit') as 'MT' | 'KG' | 'PCS' | 'TON',
        category: formData.get('category') as string || undefined,
        purchasePrice: purchasePrice > 0 ? purchasePrice : undefined,
        salesPrice: salesPrice > 0 ? salesPrice : undefined,
        gstRate: gstRate > 0 ? gstRate : undefined,
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
        category: formData.get('category') as string || undefined,
        purchasePrice: purchasePrice > 0 ? purchasePrice : undefined,
        salesPrice: salesPrice > 0 ? salesPrice : undefined,
        gstRate: gstRate > 0 ? gstRate : undefined,
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
          <DialogContent className="max-w-[min(720px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Package size={22} className="text-primary" weight="duotone" />
                {editingItem ? 'Edit Item' : 'Create New Item'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit}>
              <div className="border-b border-border p-6">
                <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  Basic Details *
                </div>
                <div className="rounded-xl border border-border p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        name="category"
                        placeholder="Search Categories"
                        className="h-11"
                        defaultValue={editingItem?.category}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Item Name <span className="text-destructive">*</span></Label>
                      <Input 
                        id="name" 
                        name="name" 
                        placeholder="ex: TMT Bar"
                        className="h-11"
                        defaultValue={editingItem?.name}
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstRate">GST Tax Rate(%)</Label>
                      <Input
                        id="gstRate"
                        name="gstRate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="None"
                        className="h-11 font-mono"
                        defaultValue={editingItem?.gstRate}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchasePrice">Purchase Price</Label>
                      <Input
                        id="purchasePrice"
                        name="purchasePrice"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="ex: ₹200"
                        className="h-11 font-mono"
                        defaultValue={editingItem?.purchasePrice}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="salesPrice">Sales Price</Label>
                      <Input
                        id="salesPrice"
                        name="salesPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="ex: ₹250"
                        className="h-11 font-mono"
                        defaultValue={editingItem?.salesPrice}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit">Measuring Unit</Label>
                      <Select name="unit" required defaultValue={editingItem?.unit || "MT"}>
                        <SelectTrigger id="unit" className="h-11">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PCS">Pieces(PCS)</SelectItem>
                          <SelectItem value="MT">Metric Ton(MT)</SelectItem>
                          <SelectItem value="KG">Kilogram(KG)</SelectItem>
                          <SelectItem value="TON">Ton(TON)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="openingStock">Opening Stock</Label>
                      <Input 
                        id="openingStock" 
                        name="openingStock" 
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder={`ex: 150 ${editingItem?.unit || 'MT'}`}
                        className="h-11 font-mono"
                        defaultValue={editingItem?.openingStock}
                      />
                    </div>

                    <input type="hidden" name="openingValue" value={editingItem?.openingValue || 0} />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end px-6 py-4">
                <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingItem ? 'Update Item' : 'Save Item'}</Button>
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
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Purchase Price</TableHead>
                  <TableHead className="text-right">Sales Price</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Opening Stock</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.category || '-'}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {item.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.purchasePrice ? `₹${item.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.salesPrice ? `₹${item.salesPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.gstRate ? `${item.gstRate}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.openingStock ? item.openingStock.toFixed(3) : '-'}
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
