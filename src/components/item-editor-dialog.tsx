import { useEffect, useState } from 'react'
import { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ItemEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: Item | null
  existingItems?: Item[]
  onSave: (item: Item) => void
}

export function ItemEditorDialog({
  open,
  onOpenChange,
  item,
  existingItems = [],
  onSave
}: ItemEditorDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [gstRate, setGstRate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salesPrice, setSalesPrice] = useState('')
  const [unit, setUnit] = useState<Item['unit']>('MT')
  const [openingStock, setOpeningStock] = useState('')

  useEffect(() => {
    if (!open) return
    setName(item?.name || '')
    setCategory(item?.category || '')
    setGstRate(item?.gstRate?.toString() || '')
    setPurchasePrice(item?.purchasePrice?.toString() || '')
    setSalesPrice(item?.salesPrice?.toString() || '')
    setUnit(item?.unit || 'MT')
    setOpeningStock(item?.openingStock?.toString() || '')
  }, [open, item])

  const handleSave = () => {
    const cleanName = name.trim()

    if (!cleanName) {
      toast.error('Item name is required')
      return
    }

    const duplicate = existingItems.some((candidate) => (
      candidate.id !== item?.id &&
      candidate.name.trim().toLowerCase() === cleanName.toLowerCase()
    ))

    if (duplicate) {
      toast.error('Item already exists')
      return
    }

    onSave({
      ...(item || {}),
      id: item?.id || `item-${Date.now()}`,
      name: cleanName,
      unit,
      category: category.trim() || undefined,
      purchasePrice: parseFloat(purchasePrice) || undefined,
      salesPrice: parseFloat(salesPrice) || undefined,
      gstRate: parseFloat(gstRate) || undefined,
      openingStock: parseFloat(openingStock) || undefined,
      openingValue: item?.openingValue
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(720px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package size={22} className="text-primary" weight="duotone" />
            {item ? 'Edit Item' : 'Create New Item'}
          </DialogTitle>
        </DialogHeader>

        <div className="border-b border-border p-6">
          <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
            Basic Details *
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sharedItemCategory">Category</Label>
                <Input
                  id="sharedItemCategory"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Search Categories"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemName">Item Name <span className="text-destructive">*</span></Label>
                <Input
                  id="sharedItemName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ex: TMT Bar"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemGstRate">GST Tax Rate(%)</Label>
                <Input
                  id="sharedItemGstRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={gstRate}
                  onChange={(event) => setGstRate(event.target.value)}
                  placeholder="None"
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemPurchasePrice">Purchase Price</Label>
                <Input
                  id="sharedItemPurchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(event) => setPurchasePrice(event.target.value)}
                  placeholder="ex: ₹200"
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemSalesPrice">Sales Price</Label>
                <Input
                  id="sharedItemSalesPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salesPrice}
                  onChange={(event) => setSalesPrice(event.target.value)}
                  placeholder="ex: ₹250"
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemUnit">Measuring Unit</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as Item['unit'])}>
                  <SelectTrigger id="sharedItemUnit" className="h-11">
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
                <Label htmlFor="sharedItemOpeningStock">Opening Stock</Label>
                <Input
                  id="sharedItemOpeningStock"
                  type="number"
                  step="0.001"
                  min="0"
                  value={openingStock}
                  onChange={(event) => setOpeningStock(event.target.value)}
                  placeholder={`ex: 150 ${unit}`}
                  className="h-11 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {item ? 'Update Item' : 'Save Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
