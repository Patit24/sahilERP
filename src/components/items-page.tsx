import { useState } from 'react'
import { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Package, Trash, Pencil, Warning, SquaresFour, Scales } from '@phosphor-icons/react'
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

  // Direct Category & Unit Creation Modals
  const [addCatDialogOpen, setAddCatDialogOpen] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const [addUnitDialogOpen, setAddUnitDialogOpen] = useState(false)
  const [newUnitCode, setNewUnitCode] = useState('')
  const [newUnitLabel, setNewUnitLabel] = useState('')

  const [selectedCategory, setSelectedCategory] = useState<string>('all')

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

  const handleCreateCategory = () => {
    const clean = newCatName.trim()
    if (!clean) return
    const saved = localStorage.getItem('custom_item_categories')
    const current = saved ? JSON.parse(saved) : []
    if (!current.includes(clean)) {
      const updated = [...current, clean]
      localStorage.setItem('custom_item_categories', JSON.stringify(updated))
    }
    setNewCatName('')
    setAddCatDialogOpen(false)
    toast.success(`Category "${clean}" created! You can now assign it to items.`)
  }

  const handleCreateUnit = () => {
    const code = newUnitCode.trim().toUpperCase()
    const label = newUnitLabel.trim() || code
    if (!code) return
    const saved = localStorage.getItem('custom_item_units')
    const current = saved ? JSON.parse(saved) : []
    if (!current.some((u: { value: string }) => u.value === code)) {
      const updated = [...current, { value: code, label: `${label} (${code})` }]
      localStorage.setItem('custom_item_units', JSON.stringify(updated))
    }
    setNewUnitCode('')
    setNewUnitLabel('')
    setAddUnitDialogOpen(false)
    toast.success(`Unit "${code}" created! You can now assign it when creating items.`)
  }

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean)))

  const filteredItems = selectedCategory === 'all'
    ? items
    : items.filter(i => i.category === selectedCategory)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Item Master</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage all steel products, categories, pricing, and custom measuring units
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setAddCatDialogOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
          >
            <SquaresFour className="mr-1.5 h-4 w-4 text-blue-600" />
            Add Category
          </Button>
          <Button
            variant="outline"
            onClick={() => setAddUnitDialogOpen(true)}
            className="border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold"
          >
            <Scales className="mr-1.5 h-4 w-4 text-emerald-600" />
            Add Unit
          </Button>
          <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-2xs">
            <Plus className="mr-2" size={18} weight="bold" />
            Add Item
          </Button>
        </div>

        <ItemEditorDialog
          open={open}
          onOpenChange={handleDialogClose}
          item={editingItem}
          existingItems={items}
          onSave={handleSaveItem}
        />
      </div>

      {/* Category Filter Pills & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Items</div>
            <div className="text-3xl font-extrabold text-slate-900 font-mono">{items.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Categories</div>
            <div className="text-3xl font-extrabold text-blue-600 font-mono">{categories.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category Filter</div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm font-semibold bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none"
              >
                <option value="all">All Categories ({items.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat!}>
                    {cat} ({items.filter(i => i.category === cat).length})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredItems.length === 0 ? (
        <Card className="bg-white border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package size={48} className="text-slate-300 mb-4" />
            <p className="text-slate-500 text-center font-medium">
              No items found in this category. Click "+ Add Item" to create one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border-slate-200 overflow-hidden shadow-2xs">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">Item Name</TableHead>
                  <TableHead className="font-bold text-slate-700">Category</TableHead>
                  <TableHead className="font-bold text-slate-700">Measuring Unit & Conversion</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Purchase Price</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Sales Price</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">GST %</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">Opening Stock</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                          {item.category || 'General'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-bold text-slate-800">
                            {item.unit}
                            {item.alternativeUnit && item.alternativeUnit !== 'NONE' ? ` / ${item.alternativeUnit}` : ''}
                          </span>
                          {item.alternativeUnit && item.alternativeUnit !== 'NONE' && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              1 {item.unit} = {item.conversionFactor ? item.conversionFactor.toLocaleString() : (item.unit === 'MT' ? '1,000' : '1')} {item.alternativeUnit}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {item.purchasePrice ? `₹${item.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-emerald-700">
                        {item.salesPrice ? `₹${item.salesPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.gstRate ? `${item.gstRate}%` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {item.openingStock ? `${item.openingStock.toFixed(3)} ${item.unit}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8 p-0"
                          >
                            <Pencil size={16} weight="bold" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClick(item)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
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

      {/* CREATE NEW CATEGORY DIALOG */}
      <Dialog open={addCatDialogOpen} onOpenChange={setAddCatDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquaresFour size={20} className="text-blue-600" />
              Add New Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="newCategoryNamePage">Category Name</Label>
            <Input
              id="newCategoryNamePage"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="ex: Structural Steel"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateCategory()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCategory} className="bg-blue-600 text-white font-bold">Add Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE NEW UNIT DIALOG */}
      <Dialog open={addUnitDialogOpen} onOpenChange={setAddUnitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scales size={20} className="text-emerald-600" />
              Add Custom Measuring Unit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="newUnitCodePage">Unit Code (Short symbol) *</Label>
              <Input
                id="newUnitCodePage"
                value={newUnitCode}
                onChange={(e) => setNewUnitCode(e.target.value)}
                placeholder="ex: BAG, BUNDLE, BOX, LTR"
                className="font-mono uppercase"
              />
            </div>
            <div>
              <Label htmlFor="newUnitLabelPage">Unit Display Name</Label>
              <Input
                id="newUnitLabelPage"
                value={newUnitLabel}
                onChange={(e) => setNewUnitLabel(e.target.value)}
                placeholder="ex: Cement Bag, Steel Bundle"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUnitDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUnit} className="bg-emerald-600 text-white font-bold">Add Unit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
