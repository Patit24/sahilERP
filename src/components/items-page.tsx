import { useState } from 'react'
import { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Package, Trash, Pencil, Warning } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { ItemEditorDialog } from '@/components/item-editor-dialog'

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

  const handleSaveItem = (savedItem: Item) => {
    if (editingItem) {
      setItems((prev) => prev.map(item => item.id === savedItem.id ? savedItem : item))
      toast.success('Item updated successfully')
    } else {
      setItems((prev) => [...prev, savedItem])
      toast.success('Item added successfully')
    }
    setEditingItem(null)
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
        <Button onClick={handleAdd}>
          <Plus className="mr-2" size={18} />
          Add Item
        </Button>
        <ItemEditorDialog
          open={open}
          onOpenChange={handleDialogClose}
          item={editingItem}
          existingItems={items}
          onSave={handleSaveItem}
        />
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
